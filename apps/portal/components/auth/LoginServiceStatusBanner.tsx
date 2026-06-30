"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, HardDrive, Server, Zap, type LucideIcon } from "lucide-react";
import {
  mapHealthApiResponse,
  type HealthApiResponse,
  type MappedTrayHealth,
  type TrayServiceStatus,
} from "~/lib/health/client";

const ROTATE_MS = 3_500;
const POLL_MS = 30_000;

type ServiceSlot = {
  id: string;
  label: string;
  icon: LucideIcon;
  resolveStatus: (_health: MappedTrayHealth) => TrayServiceStatus;
};

const SERVICE_SLOTS: ServiceSlot[] = [
  {
    id: "supabase",
    label: "Supabase",
    icon: Database,
    resolveStatus: (health) => health.db,
  },
  {
    id: "redis",
    label: "Redis",
    icon: HardDrive,
    resolveStatus: (health) => health.redis,
  },
  {
    id: "fuxa",
    label: "FUXA SCADA",
    icon: Zap,
    resolveStatus: (health) => health.fuxa,
  },
  {
    id: "auth-api",
    label: "Auth API",
    icon: Server,
    resolveStatus: (health) => {
      if (health.status === "healthy") return "ok";
      if (health.status === "degraded") return "degraded";
      return "unavailable";
    },
  },
];

const STATUS_LABEL: Record<TrayServiceStatus, string> = {
  ok: "Online",
  degraded: "Degraded",
  unavailable: "Offline",
  disabled: "Disabled",
};

function statusModifier(status: TrayServiceStatus | "loading"): string {
  if (status === "loading") return "login-card-service-banner--loading";
  return `login-card-service-banner--${status}`;
}

export function LoginServiceStatusBanner() {
  const [health, setHealth] = useState<MappedTrayHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotIndex, setSlotIndex] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health", { method: "GET", cache: "no-store" });
        const data = (await res.json()) as HealthApiResponse;
        if (!cancelled) {
          setHealth(mapHealthApiResponse(data));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHealth({
            status: "error",
            db: "unavailable",
            redis: "unavailable",
            fuxa: "unavailable",
            responseTime: 0,
            timestamp: "",
          });
          setLoading(false);
        }
      }
    };

    void fetchHealth();
    const pollId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchHealth();
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    const rotateId = setInterval(() => {
      setSlotIndex((index) => (index + 1) % SERVICE_SLOTS.length);
      setTick((value) => value + 1);
    }, ROTATE_MS);

    return () => clearInterval(rotateId);
  }, []);

  const activeSlot = SERVICE_SLOTS[slotIndex] ?? SERVICE_SLOTS[0];
  const activeStatus: TrayServiceStatus | "loading" = loading
    ? "loading"
    : health
      ? activeSlot.resolveStatus(health)
      : "unavailable";

  const statusLabel = useMemo(() => {
    if (activeStatus === "loading") return "Checking…";
    return STATUS_LABEL[activeStatus];
  }, [activeStatus]);

  const Icon = activeSlot.icon;

  return (
    <div
      className={`login-card-service-banner ${statusModifier(activeStatus)}`}
      role="status"
      aria-live="polite"
      aria-label={`${activeSlot.label} ${statusLabel}`}
    >
      <div key={tick} className="login-card-service-banner__track">
        <Icon className="login-card-service-banner__icon" strokeWidth={1.75} aria-hidden="true" />
        <span className="login-card-service-banner__service">{activeSlot.label}</span>
        <span className="login-card-service-banner__sep" aria-hidden="true">
          ·
        </span>
        <span className="login-card-service-banner__status">{statusLabel}</span>
        <span className="login-card-service-banner__dot" aria-hidden="true" />
      </div>
    </div>
  );
}

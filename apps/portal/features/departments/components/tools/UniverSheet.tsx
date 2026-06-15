"use client";

import { useEffect, useRef } from "react";
import {
  createUniver,
  LocaleType,
  mergeLocales,
  type IDisposable,
} from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";

import "@univerjs/preset-sheets-core/lib/index.css";

interface UniverSheetProps {
  id?: string;
  data?: object;
  // eslint-disable-next-line no-unused-vars
  onReady?: (api: unknown) => void;
}

export default function UniverSheet({ id, data, onReady }: UniverSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IDisposable | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
        }),
      ],
    });

    const workbook = univerAPI.createWorkbook(data ?? {});

    if (onReady) {
      onReady(workbook);
    }

    apiRef.current = univerAPI;

    return () => {
      univerAPI.dispose();
      apiRef.current = null;
    };
  }, [data, onReady]);

  return (
    <div
      ref={containerRef}
      id={id}
      className="w-full h-[600px] rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] overflow-hidden"
    />
  );
}

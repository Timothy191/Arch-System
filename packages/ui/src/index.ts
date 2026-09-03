// Canonical public API exports for @repo/ui

// Primitives & Core shadcn/Radix components
export * from "./components/ui/button";
export * from "./components/ui/card";
export * from "./components/ui/input";
export * from "./components/ui/dialog";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/tabs";
export * from "./components/ui/table";
export * from "./components/ui/badge";
export * from "./components/ui/separator";
export * from "./components/ui/scroll-area";
export * from "./components/ui/skeleton";
export * from "./components/ui/sonner";

// Composite & Industrial UI Primitives
export * from "./components/GlassCard";
export * from "./components/KPI";
export * from "./components/PageHeader";
export * from "./components/DepartmentLayout";
export * from "./components/ShiftToggle";
export * from "./components/Divider";
export * from "./components/BorderBox";
export * from "./components/Logo";
export * from "./components/EmptyState";
export * from "./components/CookieConsent";
export * from "./components/Clock";
export * from "./components/SecondaryButton";
export * from "./components/Checkbox";
export * from "./components/FormFields";
export * from "./components/AcknowledgeButton";
export * from "./components/TrustLogos";
export * from "./components/MacMenuBar";
export * from "./components/MacTitleBar";
export * from "./components/WorkflowBuilder";
export * from "./components/HeroRotator";
export * from "./components/HeroCardContent";

// Motion & Animated Components
export * from "./components/ui/animated-button";
export * from "./components/ui/animated-dialog";
export * from "./components/ui/animated-list";
export * from "./components/ui/animated-number";
export * from "./components/ui/bento-grid";
export * from "./components/ui/cyber-button";
export * from "./components/ui/dock";
export * from "./components/ui/freeze-toggle";
export * from "./components/ui/glass-skeleton";
export * from "./components/ui/hero-video-dialog";
export {
  LiquiButton,
  type LiquiButtonProps,
  liquiButtonVariants,
} from "./components/ui/liqui-button";
export * from "./components/ui/loader";
export * from "./components/ui/marquee";
export * from "./components/ui/number-ticker";
export * from "./components/ui/pagination";
export * from "./components/ui/reveal-loader";
export * from "./components/ui/shine-border";
export * from "./components/ui/action-confirm-dialog";
export * from "./components/ui/telemetry-chart";
export * from "./components/ui/data-grid";
export * from "./components/ui/PrecisionInput";

// Motion Primitives
export * from "./components/motion/AnimeNumber";
export * from "./components/motion/AnimeStagger";
export * from "./components/motion/AnimeTimeline";

// Topology Nodes & Edges
export * from "./components/nodes/PluginNode";
export * from "./components/nodes/TriggerNode";
export * from "./components/edges/FlowEdge";

// Utilities & Hooks
export * from "./lib/utils";
export * from "./hooks/useAutoSave";

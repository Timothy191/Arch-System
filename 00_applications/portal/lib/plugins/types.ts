import React from "react";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
}

export interface PluginEngine {
  /**
   * Run custom computations or statistical algorithms.
   * Can be invoked dynamically by the host application.
   */
  execute?: (_params?: Record<string, any>) => Promise<Record<string, any>>;
}

export interface PluginHooks {
  /**
   * Lifecycle trigger executing when a daily log is created/synced.
   */
  onLogCreated?: (_log: any) => Promise<void> | void;

  /**
   * Lifecycle trigger executing when a machinery breakdown is reported.
   */
  onBreakdownAdded?: (_breakdown: any) => Promise<void> | void;
}

export interface PluginWidget {
  /**
   * Unique name of the visual widget card.
   */
  id: string;

  /**
   * Preferred grid span styling for dashboard placements (e.g. 'col-span-1', 'col-span-2').
   */
  gridSpan?: string;

  /**
   * React component reference representing the custom UI card.
   */
  component: React.ComponentType<{ departmentId: string }>;
}

export interface PluginWorkflow {
  /**
   * Whether this plugin can be used in visual workflow builder.
   */
  canBuildWorkflow: boolean;

  /**
   * Default node configuration for the workflow builder.
   */
  defaultNode?: {
    type: string;
    data: Record<string, unknown>;
  };
}

export interface ArchPlugin {
  metadata: PluginMetadata;
  engine?: PluginEngine;
  hooks?: PluginHooks;
  widgets?: PluginWidget[];
  workflow?: PluginWorkflow;
}

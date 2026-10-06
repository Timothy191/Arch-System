import { vercelAdapter } from '@flags-sdk/vercel';
import { flag } from 'flags/next';
import { identify } from './identify';

/**
 * Feature Flags Configuration with Vercel Flags SDK
 * Each flag declares its key, adapter, and evaluation context via identify.
 */

export const exampleFlag = flag({
  key: 'example-flag',
  description: 'Example feature flag for testing rollout workflows and segment targeting',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
});

export const realtimeScadaV2 = flag({
  key: 'realtime-scada-v2',
  description: 'Next-generation WebSocket/SSE SCADA telemetry stream viewer',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
});

export const automatedDispatchWorkflow = flag({
  key: 'automated-dispatch-workflow',
  description: 'Automated BullMQ / Vercel Workflow execution dispatcher',
  adapter: vercelAdapter(),
  identify,
  defaultValue: true,
});

export const predictiveTireWearModel = flag({
  key: 'predictive-tire-wear-model',
  description: 'ML model inference for CAT 793F haul truck tire degradation',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
});

export const autonomousAiOperatorCopilot = flag({
  key: 'autonomous-ai-operator-copilot',
  description: 'Enables autonomous AI copilot recommendations for dragline and drill operators',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
});

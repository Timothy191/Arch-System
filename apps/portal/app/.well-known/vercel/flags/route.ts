import { createFlagsDiscoveryEndpoint } from 'flags/next';

export const GET = createFlagsDiscoveryEndpoint(async () => {
  return {
    definitions: {
      'autonomous-ai-operator-copilot': {
        description:
          'Enables autonomous AI copilot recommendations for dragline and drill operators',
        options: [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ],
      },

      'example-flag': {
        description: 'Example feature flag for testing rollout workflows and segment targeting',
        options: [
          { value: false, label: 'Off' },
          { value: true, label: 'On' },
        ],
      },
      'realtime-scada-v2': {
        description: 'Next-generation WebSocket/SSE SCADA telemetry stream viewer',
        options: [
          { value: false, label: 'Legacy Polling' },
          { value: true, label: 'Realtime Streaming' },
        ],
      },
      'automated-dispatch-workflow': {
        description: 'Automated BullMQ / Vercel Workflow execution dispatcher',
        options: [
          { value: false, label: 'Disabled' },
          { value: true, label: 'Enabled' },
        ],
      },
      'predictive-tire-wear-model': {
        description: 'ML model inference for CAT 793F haul truck tire degradation',
        options: [
          { value: false, label: 'Linear Threshold' },
          { value: true, label: 'Neural Fleet Predictor' },
        ],
      },
    },
  };
});

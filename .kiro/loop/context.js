#!/usr/bin/env node

const PRESSURE_THRESHOLDS = [
  { level: 'low', threshold: 0.3, action: 'load_full' },
  { level: 'medium', threshold: 0.5, action: 'load_critical' },
  { level: 'high', threshold: 0.7, action: 'compact_and_load' },
  { level: 'critical', threshold: 0.9, action: 'emergency_compact' }
];

module.exports = {
  estimatePressure(context) {
    const maxTokens = 100000;
    const estimatedUsed = context.length || context.tokens || 30000;
    const ratio = estimatedUsed / maxTokens;
    return ratio;
  },

  getPressureLevel(context) {
    const ratio = this.estimatePressure(context);
    for (const t of PRESSURE_THRESHOLDS) {
      if (ratio <= t.threshold) return t;
    }
    return PRESSURE_THRESHOLDS[PRESSURE_THRESHOLDS.length - 1];
  },

  shouldCompact(context) {
    const level = this.getPressureLevel(context);
    return level.action.includes('compact');
  },

  filterContext(context, priorityFiles) {
    const files = context.files || [];
    const steering = context.steering || [];

    const prioritized = files.filter(f => priorityFiles.includes(f.path));
    const deprioritized = files.filter(f => !priorityFiles.includes(f.path));

    return {
      files: prioritized.slice(0, 5),
      steering: steering.slice(0, 3),
      totalCompressed: deprioritized.length
    };
  }
};

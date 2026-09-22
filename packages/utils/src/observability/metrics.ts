import { Counter, Gauge, Registry } from 'prom-client';

export const registry = new Registry();

export const closeoutCounter = new Counter({
  name: 'control_room_shift_closeout_total',
  help: 'Total number of shift closeouts completed',
  labelNames: ['result'],
  registers: [registry],
});

export const outboxGauge = new Gauge({
  name: 'control_room_outbox_pending_total',
  help: 'Number of pending items in the degraded outbox',
  registers: [registry],
});

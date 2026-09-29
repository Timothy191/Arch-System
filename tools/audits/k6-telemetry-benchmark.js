import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '5s',
  thresholds: {
    checks: ['rate>0.99'],
  },
};

export default function () {
  // Simulate synthetic mining telemetry payload processing
  const smrPayload = JSON.stringify({
    equipmentId: 'EXCAVATOR-CAT-6020B',
    readingHours: 14250.5,
    fuelBurnRate: 184.2,
    payloadTonnage: 120.4,
    timestamp: new Date().toISOString(),
    status: 'OPTIMAL',
  });

  const parsed = JSON.parse(smrPayload);
  const isValid =
    parsed.equipmentId.startsWith('EXCAVATOR') &&
    parsed.readingHours > 0 &&
    parsed.payloadTonnage > 100;

  check(isValid, {
    'payload schema validation passed': (val) => val === true,
    'telemetry values within operating bounds': () => parsed.fuelBurnRate < 250,
  });

  sleep(0.1);
}

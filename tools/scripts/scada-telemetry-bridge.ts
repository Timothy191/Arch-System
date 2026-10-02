import { ModbusTcpStub } from '@repo/utils';

async function runBridge() {
  const bridge = new ModbusTcpStub({ host: '127.0.0.1', port: 502, unitId: 1, timeoutMs: 5000 });
  await bridge.connect();

  setInterval(async () => {
    try {
      const registers = await bridge.readHoldingRegisters(100, 5);
      // registers: [rpm, temp, pressure, vibration, depth]
      const payload = {
        machine_id: 'e8b3b754-0000-4000-8000-000000000000',
        engine_rpm: registers[0],
        engine_temp: registers[1],
        hydraulic_pressure: registers[2],
        vibration_level: registers[3],
        bit_depth: registers[4],
        timestamp: new Date().toISOString(),
      };

      await fetch('http://localhost:3000/api/telemetry/drilling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('Pushed real telemetry from Modbus to API', payload);
    } catch (e) {
      console.error('Bridge error:', e);
    }
  }, 1000);
}

runBridge();

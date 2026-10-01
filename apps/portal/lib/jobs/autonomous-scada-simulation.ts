import { createServiceRoleClient } from '@repo/supabase/service-role';
import { inngest } from '@repo/utils/inngest';
import { logError } from '@/lib/errors/error-logger';
import { recordJobExecution } from '@/lib/observability/simple-metrics';

/**
 * Autonomous SCADA Simulation
 *
 * Runs every 2 minutes to generate automated data for the system.
 * Simulates heavy machinery telemetry (dump trucks, excavators, drill rigs)
 * and automatically triggers SCADA push webhooks.
 */
export const autonomousScadaSimulationFn = inngest.createFunction(
  {
    id: 'autonomous-scada-simulation',
    triggers: [{ cron: '*/2 * * * *' }], // Every 2 minutes
  },
  async ({ step }) => {
    const start = performance.now();
    let success = true;

    try {
      const supabase = createServiceRoleClient();

      // Fetch active machines
      const { data: machines, error: mError } = await supabase
        .from('machines')
        .select('id, machine_type, name')
        .eq('active', true)
        .limit(10);

      if (mError || !machines || machines.length === 0) {
        return { success: true, message: 'No active machines to simulate' };
      }

      const operations = [];

      for (const machine of machines) {
        const payload = {
          machine_id: machine.id,
          engine_rpm: 1000 + Math.floor(Math.random() * 1000),
          engine_temp: 70 + Math.floor(Math.random() * 20),
          hydraulic_pressure: 200 + Math.floor(Math.random() * 50),
          vibration_level: 1 + Math.random() * 2,
          fuel_level: 20 + Math.floor(Math.random() * 80),
          bit_depth: machine.machine_type === 'drill_rig' ? Math.floor(Math.random() * 100) : null,
          recorded_at: new Date().toISOString(),
        };

        // Insert into scada_telemetry
        operations.push(
          supabase.from('scada_telemetry').insert({
            machine_id: payload.machine_id,
            timestamp: payload.recorded_at,
            sensor_id: `sys_gen_${machine.id}`,
            value: payload.engine_rpm,
            metadata: payload,
          })
        );
      }

      await Promise.allSettled(operations);

      return { success: true, simulated_count: operations.length };
    } catch (err: any) {
      success = false;
      logError(err, { context: 'autonomous_scada_simulation_fatal' });
      throw err;
    } finally {
      recordJobExecution('autonomous-scada-simulation', performance.now() - start, success);
    }
  }
);

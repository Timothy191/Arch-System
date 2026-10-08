import {
  buildHourlyLoadsGroupedMap,
  HOUR_PROP,
  HOURS_12,
  type HourlyLoad,
  type HourlyShift,
  loadKey,
  sumHourlyTotal,
} from './loads-utils';

self.addEventListener('message', (event) => {
  const { machines, loadsState, selectedShift, hourLabels, hasBinFactors } = event.data;

  const groupedLoadsByMachine = buildHourlyLoadsGroupedMap(loadsState);
  const rows: Record<string, any>[] = [];

  machines.forEach((machine: any) => {
    const machineLoads = (
      groupedLoadsByMachine.get(loadKey(machine.id, selectedShift)) || []
    ).slice();
    const binFactor = machine.bin_factor ?? 0;

    if (machineLoads.length === 0) {
      const virtualLoadId = `local-${machine.id}-${selectedShift}`;
      const row: Record<string, any> = {
        rowKey: `${machine.id}:${selectedShift}:default`,
        loadId: virtualLoadId,
        machineId: machine.id,
        machineName: machine.name,
        baseMachineName: machine.name,
        excavatorId: '',
        machineType: machine.machine_type,
        materialType: 'Waste',
        startHour: 1,
        endHour: 12,
        isLocked: false,
        isSplit: false,
        total: 0,
      };
      HOURS_12.forEach((_, index) => {
        row[HOUR_PROP(index)] = 0;
      });
      if (hasBinFactors) {
        row.binFactor = binFactor > 0 ? binFactor : '-';
        row.totalMaterial = '-';
      }
      rows.push(row);
    } else {
      machineLoads.sort((a, b) => (a.start_hour ?? 1) - (b.start_hour ?? 1));
      machineLoads.forEach((load) => {
        const startHour = load.start_hour ?? 1;
        const endHour = load.end_hour ?? 12;
        const isLocked = Boolean(load.is_locked);
        const isSplit = machineLoads.length > 1;
        const startLabel = hourLabels[startHour - 1] ?? '06';
        const endLabel = hourLabels[endHour - 1] ?? '17';
        const segmentLabel = isSplit
          ? `${machine.name} (${startLabel}:00 - ${endLabel}:59)`
          : machine.name;

        const totalLoads = load.total_loads ?? sumHourlyTotal(load);
        const row: Record<string, any> = {
          rowKey: load.id,
          loadId: load.id,
          machineId: machine.id,
          machineName: segmentLabel,
          baseMachineName: machine.name,
          excavatorId: load.excavator_id || '',
          machineType: machine.machine_type,
          materialType: load.material_type || 'Waste',
          startHour,
          endHour,
          isLocked,
          isSplit,
          total: totalLoads,
        };
        HOURS_12.forEach((_, index) => {
          row[HOUR_PROP(index)] = (load[HOUR_PROP(index) as keyof HourlyLoad] as number) || 0;
        });
        if (hasBinFactors) {
          row.binFactor = binFactor > 0 ? binFactor : '-';
          row.totalMaterial =
            binFactor > 0 && totalLoads > 0 ? Math.round(totalLoads * binFactor * 10) / 10 : '-';
        }
        rows.push(row);
      });
    }
  });

  self.postMessage({ rows, version: event.data.version });
});

function normalizeMachineType(type: string): { normalized: string; words: string[] } {
  const normalized = type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return { normalized, words: normalized.split(/\s+/) };
}

export interface HaulTruckClassificationOptions {
  /**
   * The server scan route excludes water trucks from ADT/haulage classification,
   * while the C66 client scanner historically includes them. Behaviour is preserved
   * per-caller until the business rule is confirmed (see consolidation walkthrough).
   */
  readonly includeWaterTrucks?: boolean;
}

export function isAdtOrDumpTruck(type: string, options?: HaulTruckClassificationOptions): boolean {
  const { normalized, words } = normalizeMachineType(type);
  if (!options?.includeWaterTrucks && normalized.includes('water')) return false;
  return (
    words.includes('adt') ||
    normalized.includes('dump') ||
    normalized.includes('truck') ||
    normalized.includes('articulated')
  );
}

export function isExcavator(type: string): boolean {
  const { normalized, words } = normalizeMachineType(type);
  return words.includes('ex') || normalized.includes('excavator');
}

export function isDozer(type: string): boolean {
  const { normalized, words } = normalizeMachineType(type);
  return words.includes('dz') || normalized.includes('dozer');
}

export function isDrill(type: string): boolean {
  const { normalized, words } = normalizeMachineType(type);
  return words.includes('dr') || normalized.includes('drill');
}

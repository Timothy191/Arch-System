import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface SlotRecipeConfig<TSlot extends string, TVariantKey extends string> {
  readonly slots: readonly TSlot[];
  readonly base: Readonly<Partial<Record<TSlot, string>>>;
  readonly variants?: Readonly<Record<TVariantKey, Readonly<Partial<Record<TSlot, string>>>>>;
}

export function defineSlotRecipe<TSlot extends string, TVariantKey extends string>(
  config: Readonly<SlotRecipeConfig<TSlot, TVariantKey>>
): (activeVariant?: TVariantKey) => Readonly<Record<TSlot, string>> {
  return (activeVariant?: TVariantKey) => {
    const resolvedSlots = {} as Record<TSlot, string>;
    const variantMap =
      activeVariant && config.variants ? config.variants[activeVariant] : undefined;
    for (const slotName of config.slots) {
      resolvedSlots[slotName] = cn(config.base[slotName], variantMap?.[slotName]);
    }
    return resolvedSlots;
  };
}

export type SurfaceTone = 'default' | 'green' | 'blue' | 'red' | 'cyan' | 'indigo' | 'alert';

const SURFACE_CONTRAST_PAIRINGS: Readonly<Record<SurfaceTone, string>> = {
  default: 'text-[var(--text-heading)]',
  green: 'text-accent-green',
  blue: 'text-dept-drilling',
  red: 'text-[var(--accent-red)]',
  cyan: 'text-[var(--accent-green)]',
  indigo: 'text-dept-engineering',
  alert: 'text-[var(--accent-red)]',
};

export function resolveSurfacePairing(tone: SurfaceTone): string {
  return SURFACE_CONTRAST_PAIRINGS[tone];
}

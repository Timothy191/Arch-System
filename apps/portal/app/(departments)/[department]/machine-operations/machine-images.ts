import { getMachineFleetImage, type MachineCategory } from './machine-operations-constants';

/**
 * Every accepted machine thumbnail path. All entries exist under
 * apps/portal/public/images/fleet/ and are reused from the fleet presets.
 */
export const MACHINE_FLEET_IMAGE_PATHS = [
  '/images/fleet/atlas-copco-drill.webp',
  '/images/fleet/caterpillar-dozer.webp',
  '/images/fleet/caterpillar-grader.webp',
  '/images/fleet/caterpillar-loader.webp',
  '/images/fleet/caterpillar-rdt.webp',
  '/images/fleet/hitachi-excavator.webp',
  '/images/fleet/komatsu-dozer.webp',
  '/images/fleet/komatsu-excavator.webp',
  '/images/fleet/komatsu-rdt.webp',
  '/images/fleet/mobile-crusher.webp',
  '/images/fleet/roller-compactor.webp',
  '/images/fleet/sany-grader.webp',
  '/images/fleet/service-bowser.webp',
  '/images/fleet/volvo-adt.webp',
  '/images/fleet/volvo-loader.webp',
  '/images/fleet/water-bowser.webp',
] as const;

export type MachineFleetImagePath = (typeof MACHINE_FLEET_IMAGE_PATHS)[number];

export const MACHINE_FLEET_FALLBACK_IMAGE: MachineFleetImagePath = '/images/fleet/volvo-adt.webp';

export const MACHINE_CATEGORY_IMAGE_PATHS: Readonly<
  Record<Exclude<MachineCategory, 'all'>, MachineFleetImagePath>
> = {
  adt: '/images/fleet/volvo-adt.webp',
  excavator: '/images/fleet/hitachi-excavator.webp',
  drill: '/images/fleet/atlas-copco-drill.webp',
  dozer: '/images/fleet/caterpillar-dozer.webp',
  ancillary: '/images/fleet/roller-compactor.webp',
};

const FLEET_IMAGE_PATH_SET: ReadonlySet<string> = new Set(MACHINE_FLEET_IMAGE_PATHS);
const HIDDEN_IMAGE_STYLE = 'hidden';

const FLEET_IMAGES = {
  atlasDrill: '/images/fleet/atlas-copco-drill.webp',
  caterpillarDozer: '/images/fleet/caterpillar-dozer.webp',
  caterpillarGrader: '/images/fleet/caterpillar-grader.webp',
  caterpillarLoader: '/images/fleet/caterpillar-loader.webp',
  caterpillarRdt: '/images/fleet/caterpillar-rdt.webp',
  hitachiExcavator: '/images/fleet/hitachi-excavator.webp',
  komatsuDozer: '/images/fleet/komatsu-dozer.webp',
  komatsuExcavator: '/images/fleet/komatsu-excavator.webp',
  komatsuRdt: '/images/fleet/komatsu-rdt.webp',
  mobileCrusher: '/images/fleet/mobile-crusher.webp',
  rollerCompactor: '/images/fleet/roller-compactor.webp',
  sanyGrader: '/images/fleet/sany-grader.webp',
  serviceBowser: '/images/fleet/service-bowser.webp',
  volvoAdt: '/images/fleet/volvo-adt.webp',
  volvoLoader: '/images/fleet/volvo-loader.webp',
  waterBowser: '/images/fleet/water-bowser.webp',
} as const satisfies Record<string, MachineFleetImagePath>;

const KOMATSU_PATTERN = /komatsu/i;
const CATERPILLAR_PATTERN = /caterpillar|\bcat\b/i;
const SANY_PATTERN = /sany/i;
const TOYOTA_PATTERN = /toyota hino|toyota/i;
const VOLVO_PATTERN = /volvo/i;

export interface MachineFleetImageOptions {
  readonly name?: string | null;
  readonly machineType?: string | null;
  readonly serialNumber?: string | null;
  readonly imageUrl?: string | null;
}

interface MachineIdentity {
  readonly id: string;
  readonly text: string;
  readonly type: string;
}

function isKnownImagePath(path: string): path is MachineFleetImagePath {
  return FLEET_IMAGE_PATH_SET.has(path);
}

function buildIdentity(options: MachineFleetImageOptions): MachineIdentity {
  const name = options.name?.trim() ?? '';
  const serialNumber = options.serialNumber?.trim() ?? '';
  const type = options.machineType?.trim().toLowerCase() ?? '';

  return {
    id: (name || serialNumber).toUpperCase(),
    text: [name, serialNumber, type].filter(Boolean).join(' ').toLowerCase(),
    type,
  };
}

function hasText(identity: MachineIdentity, tokens: readonly string[]): boolean {
  return tokens.some((token) => identity.text.includes(token));
}

function resolveTypeImage(identity: MachineIdentity): MachineFleetImagePath | null {
  const { id, text, type } = identity;

  if (id === 'FB-18') return FLEET_IMAGES.volvoAdt;
  if (id.startsWith('WB-') || type.includes('water') || text.includes('water bowser')) {
    return FLEET_IMAGES.waterBowser;
  }
  if (
    id === 'FB-16' ||
    type.includes('service bowser') ||
    type.includes('fuel bowser') ||
    TOYOTA_PATTERN.test(text)
  ) {
    return FLEET_IMAGES.serviceBowser;
  }
  if (id.startsWith('CR-') || hasText(identity, ['crusher', 'crushing'])) {
    return FLEET_IMAGES.mobileCrusher;
  }
  if (id.startsWith('CKN-') || id.startsWith('RL-') || hasText(identity, ['compactor', 'roller'])) {
    return FLEET_IMAGES.rollerCompactor;
  }
  if (id.startsWith('DR-') || type.includes('drill')) {
    return FLEET_IMAGES.atlasDrill;
  }
  if (id.startsWith('BD-') || id.startsWith('DZ-') || type.includes('dozer')) {
    return KOMATSU_PATTERN.test(text) ? FLEET_IMAGES.komatsuDozer : FLEET_IMAGES.caterpillarDozer;
  }
  if (id.startsWith('EX-') || type.includes('excavator')) {
    return KOMATSU_PATTERN.test(text)
      ? FLEET_IMAGES.komatsuExcavator
      : FLEET_IMAGES.hitachiExcavator;
  }
  if (id.startsWith('G-') || id.startsWith('GR-') || type.includes('grader')) {
    return SANY_PATTERN.test(text) ? FLEET_IMAGES.sanyGrader : FLEET_IMAGES.caterpillarGrader;
  }
  if (id.startsWith('L-') || id.startsWith('LD-') || type.includes('loader')) {
    return CATERPILLAR_PATTERN.test(text)
      ? FLEET_IMAGES.caterpillarLoader
      : FLEET_IMAGES.volvoLoader;
  }
  if (
    id.startsWith('DT-') ||
    id.startsWith('ADT') ||
    (hasText(identity, ['dump', 'dumper', 'haul', 'truck', 'adt', 'rdt']) &&
      !text.includes('bowser'))
  ) {
    if (KOMATSU_PATTERN.test(text)) return FLEET_IMAGES.komatsuRdt;
    if (CATERPILLAR_PATTERN.test(text)) return FLEET_IMAGES.caterpillarRdt;
    if (id.startsWith('DT-') || VOLVO_PATTERN.test(text)) return FLEET_IMAGES.volvoAdt;
    return FLEET_IMAGES.caterpillarRdt;
  }
  return null;
}

/**
 * Deterministically resolves a machine to a real fleet photograph. An explicit
 * database image is honored only when it is one of the known local assets;
 * unknown machines always receive the existing fallback asset.
 */
export function resolveMachineFleetImage(options: MachineFleetImageOptions): MachineFleetImagePath {
  const explicit = options.imageUrl?.trim();
  if (explicit && isKnownImagePath(explicit)) return explicit;

  const typedImage = resolveTypeImage(buildIdentity(options));
  if (typedImage) return typedImage;

  const legacyImage = getMachineFleetImage(
    options.name ?? undefined,
    options.machineType ?? undefined
  );
  return isKnownImagePath(legacyImage) ? legacyImage : MACHINE_FLEET_FALLBACK_IMAGE;
}

export function describeMachineImage(options: {
  readonly name?: string | null;
  readonly machineType?: string | null;
}): string {
  const name = options.name?.trim() || 'Unidentified machine';
  const type = options.machineType?.trim();
  return type ? `${name} (${type})` : name;
}

/** Keeps a failed thumbnail from retrying the same broken URL indefinitely. */
export function applyMachineImageFallback(event: {
  readonly currentTarget: HTMLImageElement;
}): void {
  const image = event.currentTarget;
  if (image.getAttribute('src') !== MACHINE_FLEET_FALLBACK_IMAGE) {
    image.setAttribute('src', MACHINE_FLEET_FALLBACK_IMAGE);
    return;
  }
  image.style.visibility = HIDDEN_IMAGE_STYLE;
}

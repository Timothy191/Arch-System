import packageJson from '../package.json';
import * as generated from './version.generated';

/**
 * Single Source of Truth for Portal Application Versioning.
 *
 * Values are baked at build time by tools/scripts/version-manager.mjs
 * and fall back to package.json and environment overrides gracefully.
 */
export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.PORTAL_VERSION ||
  generated.APP_VERSION ||
  packageJson.version ||
  '1.5.1';

export const GIT_COMMIT_SHA: string =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || generated.GIT_COMMIT_SHA || 'dev';

export const GIT_COMMIT_FULL: string =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || generated.GIT_COMMIT_FULL || 'dev';

export const BUILD_TIMESTAMP: string = generated.BUILD_TIMESTAMP || new Date().toISOString();

export const RELEASE_NAME: string =
  generated.RELEASE_NAME || `Arch OS v${APP_VERSION} // Industrial Command`;

export const SYSTEM_CODENAME: string = generated.SYSTEM_CODENAME || 'Industrial Telemetry Bus';

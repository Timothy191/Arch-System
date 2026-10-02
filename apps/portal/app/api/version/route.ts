import { NextResponse } from 'next/server';
import {
  APP_VERSION,
  BUILD_TIMESTAMP,
  GIT_COMMIT_FULL,
  GIT_COMMIT_SHA,
  RELEASE_NAME,
  SYSTEM_CODENAME,
} from '@/lib/version';

export async function GET() {
  return NextResponse.json(
    {
      status: 'nominal',
      name: 'Arch-System Portal',
      version: APP_VERSION,
      commit: GIT_COMMIT_SHA,
      commitFull: GIT_COMMIT_FULL,
      buildTimestamp: BUILD_TIMESTAMP,
      releaseName: RELEASE_NAME,
      systemCodename: SYSTEM_CODENAME,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-App-Version': APP_VERSION,
      },
    }
  );
}

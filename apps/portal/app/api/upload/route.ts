import { NextResponse } from 'next/server';

/**
 * This endpoint previously forwarded any anonymous request body to Vercel Blob
 * with public access. It had no authentication, MIME/size validation, or
 * server-generated filename and no in-repo consumers, so it is retired.
 *
 * If a file-upload capability is needed again, add it under an authenticated
 * route with a size/MIME allowlist, a server-generated key, and private access
 * with signed reads.
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'This endpoint has been retired.', code: 'GONE' },
    { status: 410 }
  );
}

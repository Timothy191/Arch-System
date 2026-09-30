import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { handleHelloWorkflow } from '@/workflows/hello-workflow';

export async function POST(request: Request) {
  const { name = 'World' } = await request.json().catch(() => ({}));

  // Executes asynchronously and doesn't block your app
  await start(handleHelloWorkflow, [name]);

  return NextResponse.json({
    message: 'Hello workflow started successfully',
    name,
  });
}

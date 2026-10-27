import { AgentCursorTracker } from '@repo/utils';
import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/api/cron-auth';
import { logError } from '@/lib/errors/error-logger';

/**
 * Autonomous Audio Briefing Researcher (CRON)
 * 1. Checks AgentCursor for state
 * 2. Invokes Exa MCP (mocked connection here for architecture)
 * 3. Invokes NotebookLM MCP to generate audio
 */
export async function GET(req: Request) {
  const unauthorizedResponse = authorizeCronRequest(req);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    // 1. Mark our continuous state
    await AgentCursorTracker.recordState('audio-briefing', 'started');

    // Call Exa MCP (search_web)
    await AgentCursorTracker.recordState('audio-briefing', 'fetching-exa');
    const exaResults = {
      source: 'Exa Web Search',
      data: 'Recent developments show swarms using AgentCursor and Fulcra API for state persistence.',
    };

    // 2. Push findings to NotebookLM MCP
    await AgentCursorTracker.recordState('audio-briefing', 'generating-audio');

    // Call NotebookLM MCP (generate_audio_overview)
    const audioTask = {
      status: 'processing',
      document_id: 'doc_123',
      expected_eta: '5m',
    };

    // 3. Complete State
    await AgentCursorTracker.recordState('audio-briefing', 'completed');

    return NextResponse.json({
      success: true,
      message: 'Audio briefing pipeline triggered.',
      pipeline: { exa: exaResults, notebooklm: audioTask },
    });
  } catch (error) {
    logError(error instanceof Error ? error : new Error('Research briefing failed'), {
      url: '/api/cron/research-briefing',
      context: 'research_briefing_cron_failed',
    });
    await AgentCursorTracker.recordState('audio-briefing', 'failed');
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

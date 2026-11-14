import type {
  GroundedCopilotResponse,
  PredictiveMaintenancePrediction,
  TelemetryAnomalyAlert,
} from '@repo/contract';

const MAX_CITATIONS_PER_SOURCE = 3;

export interface RagBreakdownMatch {
  readonly id: string;
  readonly fleetId: string;
  readonly reason: string;
  readonly repairNotes?: string;
  readonly score: number;
}

export interface RagShiftNoteMatch {
  readonly id: string;
  readonly shiftType: string;
  readonly noteDate: string;
  readonly content: string;
  readonly score: number;
}

export interface CopilotGroundingContext {
  readonly question: string;
  readonly dashboardContext?: Record<string, unknown>;
  readonly breakdownMatches: readonly RagBreakdownMatch[];
  readonly shiftNoteMatches: readonly RagShiftNoteMatch[];
  readonly fleetPredictions: readonly PredictiveMaintenancePrediction[];
  readonly telemetryAnomalies: readonly TelemetryAnomalyAlert[];
}

export interface ExecuteCopilotOptions {
  readonly grounding: CopilotGroundingContext;
  readonly llmResponder?: (prompt: string) => Promise<{
    readonly answer: string;
    readonly provider: 'groq' | 'openrouter';
    readonly model: string;
  } | null>;
}

type CitationItem = GroundedCopilotResponse['citations'][number];

function collectCitationsAndFacts(grounding: CopilotGroundingContext): {
  readonly citations: CitationItem[];
  readonly observedFacts: string[];
  readonly recommendations: string[];
} {
  const citations: CitationItem[] = [];
  const observedFacts: string[] = [];
  const recommendations: string[] = [];

  for (const match of grounding.breakdownMatches.slice(0, MAX_CITATIONS_PER_SOURCE)) {
    const summary = `${match.fleetId}: ${match.reason}${match.repairNotes ? ` (Resolution: ${match.repairNotes})` : ''}`;
    citations.push({ source: 'breakdown_rag', referenceId: match.id, summary });
    observedFacts.push(`Historical breakdown [${match.fleetId}]: ${match.reason}`);
  }

  for (const note of grounding.shiftNoteMatches.slice(0, MAX_CITATIONS_PER_SOURCE)) {
    citations.push({
      source: 'shift_note_rag',
      referenceId: note.id,
      summary: `${note.noteDate} ${note.shiftType}: ${note.content}`,
    });
    observedFacts.push(`Shift note (${note.noteDate} ${note.shiftType}): ${note.content}`);
  }

  for (const prediction of grounding.fleetPredictions.slice(0, MAX_CITATIONS_PER_SOURCE)) {
    citations.push({
      source: 'fleet_health',
      referenceId: prediction.machineId,
      summary: `${prediction.machineName} [${prediction.riskLevel}] RPN=${prediction.fmeaRpn}: ${prediction.reason}`,
    });
    observedFacts.push(
      `Fleet health [${prediction.machineName}]: ${prediction.riskLevel} risk (score ${prediction.riskScore}/100, RPN ${prediction.fmeaRpn}).`
    );
    recommendations.push(`${prediction.machineName}: ${prediction.recommendedAction}`);
  }

  for (const anomaly of grounding.telemetryAnomalies.slice(0, MAX_CITATIONS_PER_SOURCE)) {
    citations.push({
      source: 'telemetry_anomaly',
      referenceId: anomaly.machineId,
      summary: `${anomaly.metric} [${anomaly.severity}]: ${anomaly.reason}`,
    });
    observedFacts.push(`Telemetry [${anomaly.machineId}]: ${anomaly.reason}`);
  }

  return { citations, observedFacts, recommendations };
}

/**
 * Builds a grounded system/user prompt containing retrieved RAG matches, fleet risks, and telemetry anomalies.
 */
export function buildGroundedCopilotPrompt(grounding: CopilotGroundingContext): string {
  const { observedFacts, recommendations } = collectCitationsAndFacts(grounding);
  return [
    `Operator Request: ${grounding.question}`,
    `Observed Operational Facts (${observedFacts.length}):`,
    observedFacts.length > 0
      ? observedFacts.map((fact) => `- ${fact}`).join('\n')
      : '- None retrieved.',
    `Engine Recommendations (${recommendations.length}):`,
    recommendations.length > 0 ? recommendations.map((rec) => `- ${rec}`).join('\n') : '- None.',
    `Dashboard Context: ${JSON.stringify(grounding.dashboardContext ?? {})}`,
  ].join('\n\n');
}

/**
 * Executes the Grounded Operations Copilot with RAG + live fleet context and a deterministic zero-LLM fallback.
 */
export async function executeOperationsCopilot(
  options: ExecuteCopilotOptions
): Promise<GroundedCopilotResponse> {
  const { citations, observedFacts, recommendations } = collectCitationsAndFacts(options.grounding);
  const prompt = buildGroundedCopilotPrompt(options.grounding);

  if (options.llmResponder) {
    try {
      const llmResult = await options.llmResponder(prompt);
      if (llmResult && llmResult.answer.trim().length > 0) {
        return {
          answer: llmResult.answer.trim(),
          observedFacts,
          recommendations,
          citations,
          provider: llmResult.provider,
          model: llmResult.model,
          fallbackUsed: false,
        };
      }
    } catch {
      // Fall through to deterministic grounded summary.
    }
  }

  const fallbackLines: string[] = [
    `Deterministic Grounded Summary for: "${options.grounding.question}"`,
    observedFacts.length > 0
      ? `Observed Facts:\n${observedFacts.map((fact) => `- ${fact}`).join('\n')}`
      : 'Observed Facts: No matching breakdowns, shift notes, or active telemetry anomalies found.',
    recommendations.length > 0
      ? `Recommended Next Steps:\n${recommendations.map((rec) => `- ${rec}`).join('\n')}`
      : 'Recommended Next Steps: Verify live SCADA status and consult shift supervisor if escalation is needed.',
  ];

  return {
    answer: fallbackLines.join('\n\n'),
    observedFacts,
    recommendations,
    citations,
    provider: 'deterministic_fallback',
    model: 'arch-intelligence-deterministic-v1',
    fallbackUsed: true,
  };
}

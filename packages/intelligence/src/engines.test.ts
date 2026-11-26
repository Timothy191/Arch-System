/* cspell:words ewma flatline flatlined cusum */
import {
  buildGroundedCopilotPrompt,
  calculateFmeaRpn,
  detectSensorFlatline,
  evaluateFleetMaintenanceRisk,
  evaluateReconciliationCusum,
  evaluateTelemetryAnomalies,
  executeOperationsCopilot,
  forecastProductionSeries,
  linearForecast,
  synthesizeShiftHandoverBrief,
} from './index';

describe('TelemetryAnomalyEngine', () => {
  it('detects sudden temperature spike via Modified Z-Score', () => {
    const alerts = evaluateTelemetryAnomalies({
      machineId: 'EX-01',
      readings: [
        { machineId: 'EX-01', recordedAt: '2026-11-14T00:00:00Z', engineTempC: 78 },
        { machineId: 'EX-01', recordedAt: '2026-11-14T00:02:00Z', engineTempC: 79 },
        { machineId: 'EX-01', recordedAt: '2026-11-14T00:04:00Z', engineTempC: 77 },
        { machineId: 'EX-01', recordedAt: '2026-11-14T00:06:00Z', engineTempC: 78.5 },
        { machineId: 'EX-01', recordedAt: '2026-11-14T00:08:00Z', engineTempC: 112 },
      ],
    });

    expect(alerts.length).toBe(1);
    expect(alerts[0]?.metric).toBe('engine_temp');
    expect(alerts[0]?.severity).toBe('CRITICAL');
    expect(alerts[0]?.isFlatline).toBe(false);
  });

  it('detects flatlined sensor readings as SENSOR_FAULT', () => {
    expect(detectSensorFlatline([210, 210, 210, 210, 210])).toBe(true);
    expect(detectSensorFlatline([210, 212, 210, 210, 210])).toBe(false);
  });

  it('flags sustained positive tonnage drift via CUSUM', () => {
    const result = evaluateReconciliationCusum([6, 7, 8, 6]);
    expect(result.isDrifting).toBe(true);
    expect(result.direction).toBe('OVER_REPORTED');
  });
});

describe('PredictiveMaintenanceEngine', () => {
  it('ranks critical machines by combined breakdown, SMU, and anomaly risk', () => {
    const predictions = evaluateFleetMaintenanceRisk([
      {
        machineId: 'DR-01',
        machineName: 'Drill Rig 01',
        machineType: 'drill_rig',
        breakdownCount30d: 3,
        currentSmuHours: 1005,
        lastPmSmuHours: 750,
        anomalies: [
          {
            machineId: 'DR-01',
            metric: 'hydraulic_pressure',
            severity: 'CRITICAL',
            latestValue: 110,
            baselineMedian: 220,
            modifiedZScore: -4.2,
            ewmaValue: 165,
            isFlatline: false,
            reason: 'Hydraulic Pressure deviated',
            detectedAt: '2026-11-14T00:08:00Z',
          },
        ],
      },
      {
        machineId: 'DT-02',
        machineName: 'Dump Truck 02',
        machineType: 'dump_truck',
        breakdownCount30d: 0,
        currentSmuHours: 510,
        lastPmSmuHours: 500,
        anomalies: [],
      },
    ]);

    expect(predictions.length).toBe(1);
    expect(predictions[0]?.machineId).toBe('DR-01');
    expect(predictions[0]?.riskLevel).toBe('CRITICAL');
    expect(predictions[0]?.failureMode).toBe('HYDRAULIC');
    expect(predictions[0]?.fmeaRpn).toBe(
      calculateFmeaRpn({
        riskLevel: 'CRITICAL',
        breakdownCount30d: 3,
        failureMode: 'HYDRAULIC',
      })
    );
  });
});

describe('ProductionForecastEngine', () => {
  it('produces capacity-adjusted damped Holt forecast with 95% confidence bounds', () => {
    const result = forecastProductionSeries({
      history: [1000, 1050, 1100, 1140, 1180],
      periods: 3,
      fleetAvailabilityRatio: 0.9,
    });

    expect(result.method).toBe('holts_damped');
    expect(result.points).toHaveLength(3);
    expect(result.points[0]?.lowerBound95).toBeLessThanOrEqual(
      result.points[0]?.pointForecast ?? 0
    );
    expect(result.points[0]?.upperBound95).toBeGreaterThanOrEqual(
      result.points[0]?.pointForecast ?? 0
    );
  });

  it('preserves linearForecast compatibility', () => {
    const forecast = linearForecast([10, 20, 30], 2);
    expect(forecast).toEqual([40, 50]);
  });
});

describe('ShiftIntelligenceEngine', () => {
  it('synthesizes deterministic handover brief when no LLM enhancer is provided', async () => {
    const brief = await synthesizeShiftHandoverBrief({
      shiftDate: '2026-11-14',
      shiftType: 'night',
      completenessPct: 82,
      reconciliationDriftPct: 11.5,
      predictions: [],
      anomalies: [],
      delays: [{ category: 'Crusher Choke', totalMinutes: 45 }],
    });

    expect(brief.synthesisMode).toBe('deterministic_fallback');
    expect(brief.reconciliationStatus).toBe('moderate');
    expect(brief.priorityActions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('OperationsCopilotEngine', () => {
  it('returns grounded deterministic summary with citations when LLM fails', async () => {
    const response = await executeOperationsCopilot({
      grounding: {
        question: 'Why is Drill Rig 01 losing pressure?',
        breakdownMatches: [
          {
            id: 'bd-1',
            fleetId: 'DR-01',
            reason: 'Main pump seal wear',
            repairNotes: 'Replaced O-ring kit',
            score: 0.91,
          },
        ],
        shiftNoteMatches: [],
        fleetPredictions: [],
        telemetryAnomalies: [],
      },
      llmResponder: async () => {
        throw new Error('Provider unavailable');
      },
    });

    expect(response.fallbackUsed).toBe(true);
    expect(response.provider).toBe('deterministic_fallback');
    expect(response.citations).toHaveLength(1);
    expect(response.observedFacts[0]).toContain('Main pump seal wear');
  });

  it('builds a bounded prompt from grounded evidence and excludes tool catalog bloat', () => {
    const prompt = buildGroundedCopilotPrompt({
      question: 'Why is DR-01 losing pressure?',
      breakdownMatches: [
        {
          id: 'bd-1',
          fleetId: 'DR-01',
          reason: 'Main pump seal wear',
          repairNotes: 'Replaced O-ring kit',
          score: 91,
        },
      ],
      shiftNoteMatches: [],
      externalDocuments: [
        {
          id: 'doc-1',
          title: 'Hydraulic manual',
          source: 'oem',
          content: 'Verify relief valve setting before restart',
          score: 88,
        },
      ],
      fleetPredictions: [],
      telemetryAnomalies: [],
      dashboardContext: {
        availableIntegrationTools: [{ qualifiedName: 'tool.execute', description: 'write' }],
        region: 'North shaft',
        oversized: 'x'.repeat(4_000),
      },
    });

    expect(prompt).toContain('Grounded Evidence');
    expect(prompt).toContain('Reference document [Hydraulic manual]');
    expect(prompt).toContain('region: North shaft');
    expect(prompt).not.toContain('availableIntegrationTools');
    expect(prompt).not.toContain('tool.execute');
    expect(prompt.length).toBeLessThan(6_000);
  });

  it('rejects LLM answers that invent telemetry without grounding evidence', async () => {
    const response = await executeOperationsCopilot({
      grounding: {
        question: 'What is the current hydraulic pressure?',
        breakdownMatches: [],
        shiftNoteMatches: [],
        fleetPredictions: [],
        telemetryAnomalies: [],
      },
      llmResponder: async () => ({
        answer: 'Hydraulic pressure is 92% nominal across all drill rigs this shift.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
      }),
    });

    expect(response.fallbackUsed).toBe(true);
    expect(response.answer).toContain('No matching breakdowns');
  });

  it('rejects LLM answers that claim an action was executed', async () => {
    const response = await executeOperationsCopilot({
      grounding: {
        question: 'Should we restart DR-01?',
        breakdownMatches: [
          {
            id: 'bd-1',
            fleetId: 'DR-01',
            reason: 'Main pump seal wear',
            score: 91,
          },
        ],
        shiftNoteMatches: [],
        fleetPredictions: [],
        telemetryAnomalies: [],
      },
      llmResponder: async () => ({
        answer: 'We have restarted DR-01 and will monitor pressure.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
      }),
    });

    expect(response.fallbackUsed).toBe(true);
    expect(response.provider).toBe('deterministic_fallback');
  });

  it('accepts a concise grounded LLM answer', async () => {
    const response = await executeOperationsCopilot({
      grounding: {
        question: 'Why is DR-01 losing pressure?',
        breakdownMatches: [
          {
            id: 'bd-1',
            fleetId: 'DR-01',
            reason: 'Main pump seal wear',
            score: 91,
          },
        ],
        shiftNoteMatches: [],
        fleetPredictions: [],
        telemetryAnomalies: [],
      },
      llmResponder: async () => ({
        answer:
          'Observed facts: historical seal wear on DR-01. Recommendation: inspect the pump seal before restart.',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
      }),
    });

    expect(response.fallbackUsed).toBe(false);
    expect(response.answer).toContain('inspect the pump seal');
  });
});

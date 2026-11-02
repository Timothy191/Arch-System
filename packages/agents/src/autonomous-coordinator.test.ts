import {
  AutonomousCoordinator,
  type AutonomousPlan,
  type AutonomousSubtask,
  sequenceSubtasks,
} from './autonomous-coordinator';
import type { SubagentCoordinator } from './coordinator';

jest.mock('./langfuse', () => ({
  withAgentSpan: jest.fn((_name, _attributes, fn) => fn()),
}));

describe('sequenceSubtasks', () => {
  it('groups independent tasks into a single parallel stage', () => {
    const tasks: AutonomousSubtask[] = [
      { id: 'task-1', specialistRole: 'role1', instructions: 'inst1' },
      { id: 'task-2', specialistRole: 'role2', instructions: 'inst2' },
    ];

    const stages = sequenceSubtasks(tasks);
    expect(stages).toHaveLength(1);
    expect(stages[0]).toHaveLength(2);
  });

  it('sequences linear dependent tasks into ordered stages', () => {
    const tasks: AutonomousSubtask[] = [
      { id: 'task-1', specialistRole: 'role1', instructions: 'inst1' },
      {
        id: 'task-2',
        specialistRole: 'role2',
        instructions: 'inst2',
        dependsOn: ['task-1'],
      },
      {
        id: 'task-3',
        specialistRole: 'role3',
        instructions: 'inst3',
        dependsOn: ['task-2'],
      },
    ];

    const stages = sequenceSubtasks(tasks);
    expect(stages).toHaveLength(3);
    expect(stages[0]?.[0]?.id).toBe('task-1');
    expect(stages[1]?.[0]?.id).toBe('task-2');
    expect(stages[2]?.[0]?.id).toBe('task-3');
  });

  it('sequences diamond dependencies correctly', () => {
    // task-1 (root) -> task-2, task-3 (parallel) -> task-4 (converge)
    const tasks: AutonomousSubtask[] = [
      { id: 't1', specialistRole: 'role1', instructions: 'inst1' },
      { id: 't2', specialistRole: 'role2', instructions: 'inst2', dependsOn: ['t1'] },
      { id: 't3', specialistRole: 'role3', instructions: 'inst3', dependsOn: ['t1'] },
      { id: 't4', specialistRole: 'role4', instructions: 'inst4', dependsOn: ['t2', 't3'] },
    ];

    const stages = sequenceSubtasks(tasks);
    expect(stages).toHaveLength(3);
    expect(stages[0]?.map((t) => t.id)).toEqual(['t1']);
    expect(stages[1]?.map((t) => t.id).sort()).toEqual(['t2', 't3']);
    expect(stages[2]?.map((t) => t.id)).toEqual(['t4']);
  });
});

describe('AutonomousCoordinator', () => {
  let mockSubagentCoordinator: jest.Mocked<SubagentCoordinator>;

  beforeEach(() => {
    mockSubagentCoordinator = {
      executeSpecialist: jest.fn().mockResolvedValue('Specialist execution succeeded'),
      run: jest.fn().mockResolvedValue('Lead Orchestrator Final Synthesis'),
      evaluateArchitecturalPreFlight: jest.fn(),
    } as unknown as jest.Mocked<SubagentCoordinator>;
  });

  it('executes all plan stages and produces synthesized output', async () => {
    const coordinator = new AutonomousCoordinator({
      coordinator: mockSubagentCoordinator,
    });

    const plan: AutonomousPlan = {
      goalId: 'goal-101',
      mainGoal: 'Upgrade telemetry pipeline',
      subtasks: [
        {
          id: 'sub-1',
          specialistRole: 'Database Architect',
          instructions: 'Migrate SCADA tables',
          personaKey: 'databaseArchitect',
        },
        {
          id: 'sub-2',
          specialistRole: 'UI Engineer',
          instructions: 'Update dashboard chart',
          dependsOn: ['sub-1'],
        },
      ],
    };

    const result = await coordinator.executePlan(plan);

    expect(result.success).toBe(true);
    expect(result.goalId).toBe('goal-101');
    expect(result.stageCount).toBe(2);
    expect(result.subtaskResults).toHaveLength(2);
    expect(result.synthesis).toBe('Lead Orchestrator Final Synthesis');
    expect(mockSubagentCoordinator.executeSpecialist).toHaveBeenCalledTimes(2);
  });

  it('aborts subsequent stages when a critical subtask fails', async () => {
    mockSubagentCoordinator.executeSpecialist.mockRejectedValueOnce(
      new Error('Critical DB migration failed')
    );

    const coordinator = new AutonomousCoordinator({
      coordinator: mockSubagentCoordinator,
    });

    const plan: AutonomousPlan = {
      goalId: 'goal-102',
      mainGoal: 'Deploy critical patch',
      subtasks: [
        {
          id: 'sub-crit',
          specialistRole: 'DB Architect',
          instructions: 'Execute hazardous migration',
          priority: 'critical',
        },
        {
          id: 'sub-downstream',
          specialistRole: 'UI Engineer',
          instructions: 'Deploy UI',
          dependsOn: ['sub-crit'],
        },
      ],
    };

    const result = await coordinator.executePlan(plan);

    expect(result.success).toBe(false);
    expect(result.subtaskResults).toHaveLength(1);
    expect(result.subtaskResults[0]?.success).toBe(false);
    expect(result.subtaskResults[0]?.error).toContain('Critical DB migration failed');
    // Downstream task should never have been executed
    expect(mockSubagentCoordinator.executeSpecialist).toHaveBeenCalledTimes(1);
  });
});

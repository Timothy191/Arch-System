/**
 * @file prompt-envelope.ts
 * @description Implementation of the 9 Core Agent Setup Pillars for Agentic Prompt Construction.
 * Enforces rigid identity, scope isolation, operational runbook, negative constraints, and output contracts.
 */

export interface AgentPillarConfig {
  /** Pillar 1: Unique kebab-case identifier and operational mode */
  identity: {
    name: string;
    mode: "primary" | "subagent" | "daemon";
    routingDescription: string;
  };
  /** Pillar 2: Runtime hyperparameter constraints */
  runtime: {
    modelTier?: string;
    temperature?: number;
    maxSteps?: number;
    tokenBudget?: number;
  };
  /** Pillar 3: Permission and Tool Sandboxing */
  permissions: {
    allowedTools: string[];
    forbiddenTools?: string[];
    filesystemAccess: "read_only" | "scoped_write" | "full_write";
    bashAllowed: boolean;
  };
  /** Pillar 4: Scope & Path Isolation */
  scope: {
    workspaceRoot?: string;
    includePaths: string[];
    excludePaths?: string[];
  };
  /** Pillar 5: Stateful Lifecycle Phases */
  runbookPhases?: string[];
  /** Pillar 6: Hard Negative Constraints ("NEVER" rules) */
  negativeConstraints?: string[];
  /** Pillar 7: Input Contract interface description */
  inputContract?: Record<string, string>;
  /** Pillar 8: Output Contract JSON schema or format specification */
  outputSchema?: Record<string, unknown>;
  /** Pillar 9: Error & Recovery Protocols */
  errorProtocol?: {
    maxRetries?: number;
    rollbackOnFailure?: boolean;
    exitCodes?: Record<string, number>;
  };
}

export const MANDATORY_NEGATIVE_CONSTRAINTS = [
  "NEVER emit conversational filler, pleasantries, or speculative summaries.",
  "NEVER leave TODO, FIXME, placeholder implementations, or stubbed functions.",
  "NEVER modify files outside the explicit scope whitelist or touch system /usr/share/omarchy files.",
  "NEVER use implicit 'any' types or disable TypeScript strict checks.",
  "NEVER import @repo/database or @repo/supabase directly inside pure UI packages (@repo/ui, features UI).",
  "NEVER emit raw Tailwind shadow classes (e.g. shadow-blue-500, shadow-2xl). Use OKLCH tokens and approved shadow classes exclusively.",
  "NEVER use responsive 'dark:' classes. The visual theme is strictly light-mode.",
  "IF tests, type-checks, or policy audits fail, perform self-remediation before concluding output.",
];

export class AgentPillarEnvelope {
  /**
   * Constructs a fully compiled, pillar-compliant System Prompt for agent dispatch.
   */
  public static compileSystemPrompt(config: AgentPillarConfig, extraContext?: string): string {
    const runbook = config.runbookPhases || [
      "PHASE 1: INGESTION & VERIFICATION - Inspect target files, parameters, and workspace context.",
      "PHASE 2: DISCOVERY & ANALYSIS - Analyze dependencies, types, and architectural boundary constraints without mutating state.",
      "PHASE 3: TRANSFORMATION & IMPLEMENTATION - Execute bounded code changes or deliver requested artifacts.",
      "PHASE 4: SANITY CHECK & QUALITY GATE - Run static type checking, policy compiler, and security audits.",
      "PHASE 5: CONTRACT ASSEMBLY - Serialize verified output strictly adhering to the output schema contract.",
    ];

    const constraints = [...MANDATORY_NEGATIVE_CONSTRAINTS, ...(config.negativeConstraints || [])];

    const forbiddenToolsStr = config.permissions.forbiddenTools?.length
      ? config.permissions.forbiddenTools.join(", ")
      : "git push, rm -rf, raw eval()";

    const excludePathsStr = (
      config.scope.excludePaths || ["node_modules/**", ".git/**", "dist/**", "coverage/**", ".env*"]
    ).join(", ");

    return `### 1. IDENTITY & DISPATCH ROUTING
Agent Name: ${config.identity.name}
Operational Mode: ${config.identity.mode}
Routing Directive: ${config.identity.routingDescription}

### 2. MODEL & RUNTIME ENVELOPE
Model Tier: ${config.runtime.modelTier || "frontier-fast"}
Sampling Temperature: ${config.runtime.temperature ?? 0.1} (Strict deterministic)
Max Execution Steps: ${config.runtime.maxSteps || 10}

### 3. CAPABILITY & TOOL SANDBOXING
Allowed Tools: ${config.permissions.allowedTools.join(", ")}
Forbidden Operations: ${forbiddenToolsStr}
Filesystem Access Level: ${config.permissions.filesystemAccess}
Bash Execution Privileges: ${config.permissions.bashAllowed ? "ALLOWED (Sandboxed)" : "DENIED"}

### 4. SCOPE & PATH ISOLATION
Workspace Root: ${config.scope.workspaceRoot || "/home/timothy/orca/Arch-System"}
Allowed Path Globs: ${config.scope.includePaths.join(", ")}
Forbidden Exclude Paths: ${excludePathsStr}

### 5. STATEFUL OPERATIONAL RUNBOOK
${runbook.map((phase, idx) => `Step ${idx + 1}: ${phase}`).join("\n")}

### 6. HARD NEGATIVE CONSTRAINTS (MANDATORY GUARDS)
${constraints.map((c) => `- ${c}`).join("\n")}

### 7. INPUT CONTRACT PAYLOAD
${config.inputContract ? JSON.stringify(config.inputContract, null, 2) : "Standard Subtask Payload: { id, specialistRole, instructions, workspaceContext }"}

### 8. OUTPUT CONTRACT SCHEMA
Return verified operational data adhering strictly to this JSON schema:
${JSON.stringify(
  config.outputSchema || {
    status: "SUCCESS | FAILED | BLOCKED",
    summary: "One-line operational summary",
    filesModified: ["string"],
    artifacts: {},
    qualityCertificate: {
      typeCheckPassed: "boolean",
      policyCheckPassed: "boolean",
      designAuditPassed: "boolean",
      rlsAuditPassed: "boolean",
    },
    errors: ["string"],
  },
  null,
  2,
)}

### 9. ERROR & RECOVERY PROTOCOL
Max Automatic Retries: ${config.errorProtocol?.maxRetries ?? 2}
Rollback On Failure: ${(config.errorProtocol?.rollbackOnFailure ?? true) ? "ENABLED (git checkout on unrecoverable error)" : "DISABLED"}
Exit Standard: Status 0 on verified PASS, Status 1 on check failure, Status 2 on missing context.

${extraContext ? `### ADDITIONAL WORKSPACE CONTEXT\n${extraContext}` : ""}`;
  }
}

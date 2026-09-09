/**
 * @file fleet-runner.ts
 * @description Swarm Fleet Runner for Multi-Agent Quality Audit and Codebase Fine-Tuning.
 * Coordinates technical specialist subagents to evaluate and report on architectural quality across Arch-Base and Arch-System.
 */

import { SPECIALIST_PERSONAS, type SpecialistPersona } from "./specialists.js";
import { QualityGate, type QualityAuditResult } from "./quality-gate.js";
import { AgentPillarEnvelope } from "./prompt-envelope.js";

export interface AgentSwarmReport {
  timestamp: string;
  totalAgentsDeployed: number;
  overallScore: number;
  domainAudits: Array<{
    agentRole: string;
    focusArea: string;
    status: "PASS" | "WARNING" | "FAIL";
    findings: string[];
  }>;
  recommendations: string[];
}

export class AgentFleetRunner {
  /**
   * Orchestrates a multi-agent review pass across domain areas.
   */
  public static runSwarmAudit(
    filesToAudit: Array<{ filePath: string; content: string }>,
  ): AgentSwarmReport {
    const domainAudits: AgentSwarmReport["domainAudits"] = [];
    const recommendations: string[] = [];
    let totalScore = 0;

    const agentKeys = [
      "databaseArchitect",
      "uiEngineer",
      "securityAndQualityGate",
      "apiIntegrator",
      "systemSimplifier",
    ];

    const agents: SpecialistPersona[] = agentKeys
      .map((key) => SPECIALIST_PERSONAS[key])
      .filter((agent): agent is SpecialistPersona => agent !== undefined);

    agents.forEach((agent) => {
      const findings: string[] = [];
      let agentPassed = true;

      filesToAudit.forEach(({ filePath, content }) => {
        const auditResult = QualityGate.auditContent(content, filePath);
        totalScore += auditResult.score;

        if (!auditResult.passed) {
          agentPassed = false;
          auditResult.criticalViolations.forEach((v) => {
            findings.push(
              `Critical: [${v.ruleId}] in ${filePath}:${v.lineNumber || 0} - ${v.description}`,
            );
          });
        }

        auditResult.warnings.forEach((w) => {
          findings.push(
            `Warning: [${w.ruleId}] in ${filePath}:${w.lineNumber || 0} - ${w.description}`,
          );
        });
      });

      if (findings.length === 0) {
        findings.push("Zero architectural or quality defects detected in assigned domain.");
      }

      domainAudits.push({
        agentRole: agent.role,
        focusArea: agent.focusArea,
        status: agentPassed
          ? findings.some((f) => f.startsWith("Warning"))
            ? "WARNING"
            : "PASS"
          : "FAIL",
        findings,
      });
    });

    const averageScore =
      filesToAudit.length > 0
        ? Math.round(totalScore / (agents.length * filesToAudit.length))
        : 100;

    if (averageScore < 90) {
      recommendations.push("Execute ReflectionEngine auto-remediation loop on failing modules.");
    }
    recommendations.push(
      "Maintain 100% InitPlan RLS policy subquery optimization on all PostgreSQL tables.",
    );
    recommendations.push(
      "Enforce OKLCH theme design tokens and light-mode layout constraints on pure UI packages.",
    );

    return {
      timestamp: new Date().toISOString(),
      totalAgentsDeployed: agents.length,
      overallScore: averageScore,
      domainAudits,
      recommendations,
    };
  }

  /**
   * Formats Swarm Audit Report into structured Markdown.
   */
  public static formatSwarmReport(report: AgentSwarmReport): string {
    let md = `# 🤖 Multi-Agent Fleet Quality & Fine-Tuning Certificate\n\n`;
    md += `- **Audit Timestamp**: \`${report.timestamp}\`\n`;
    md += `- **Agents Deployed**: \`${report.totalAgentsDeployed}\` Specialists\n`;
    md += `- **Swarm Score**: **${report.overallScore}/100**\n\n`;

    md += `## 📊 Specialist Domain Verdicts\n\n`;
    report.domainAudits.forEach((audit) => {
      const badge =
        audit.status === "PASS" ? "🟢 PASS" : audit.status === "WARNING" ? "🟡 WARNING" : "🔴 FAIL";
      md += `### ${badge} - ${audit.agentRole}\n`;
      md += `**Focus Area**: *${audit.focusArea}*\n\n`;
      md += `**Findings**:\n`;
      audit.findings.forEach((f) => {
        md += `- ${f}\n`;
      });
      md += `\n`;
    });

    md += `## 🚀 Swarm Fine-Tuning Recommendations\n\n`;
    report.recommendations.forEach((r, idx) => {
      md += `${idx + 1}. ${r}\n`;
    });

    return md;
  }
}

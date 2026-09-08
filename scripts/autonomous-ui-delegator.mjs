import { execSync } from "child_process";
import * as fs from "fs";

function run(cmd, capture = true) {
  try {
    const out = execSync(cmd + (capture ? " --json" : ""), { stdio: capture ? "pipe" : "inherit" });
    if (capture) {
      return JSON.parse(out.toString());
    }
  } catch (err) {
    console.error(`Error running ${cmd}:`, err.message);
    if (err.stdout) console.error(err.stdout.toString());
    return null;
  }
}

async function main() {
  console.log("Starting Autonomous Delegation Loop...");
  let score = 0;
  let maxTurns = 3;
  let currentTurn = 1;
  let feedback =
    "Initial task: Fix the HeroRotator sizing scaling issue in packages/ui/src/components/HeroCardContent.tsx and ThreeHeroRotator.tsx where the panel only shows a tiny piece. Remember to keep all effects and animations intact.";

  // Create a base worktree for the task
  console.log("Creating worktree for the task...");
  const wt = run(`orca worktree create --name fix-hero-rotator-${Date.now()}`);
  if (!wt || !wt.id) {
    console.error("Failed to create worktree. Exiting.");
    process.exit(1);
  }
  const worktreeSelector = `id:${wt.id}`;

  while (score < 8 && currentTurn <= maxTurns) {
    console.log(`\n============================`);
    console.log(`--- Turn ${currentTurn} ---`);
    console.log(`============================`);
    console.log(`Delegating to frontend-refactor-agent...`);

    // Spawn the refactor agent
    const refactorCmd = `orca terminal create --worktree ${worktreeSelector} --command 'orca-cli worktree create --agent frontend-refactor-agent --prompt "${feedback.replace(/"/g, '\\"')}"'`;
    const refactorTerm = run(refactorCmd);

    if (refactorTerm && refactorTerm.handle) {
      console.log(`Waiting for refactoring to complete (Terminal ${refactorTerm.handle})...`);
      run(
        `orca terminal wait --terminal ${refactorTerm.handle} --for exit --timeout-ms 300000`,
        false,
      );
    }

    console.log(`\nDelegating to ui-evaluator-agent...`);
    const evalCmd = `orca terminal create --worktree ${worktreeSelector} --command 'orca-cli worktree create --agent ui-evaluator-agent --prompt "Evaluate the recent changes to the HeroRotator components in packages/ui/src/components/"'`;
    const evalTerm = run(evalCmd);

    if (evalTerm && evalTerm.handle) {
      console.log(`Waiting for evaluation (Terminal ${evalTerm.handle})...`);
      run(`orca terminal wait --terminal ${evalTerm.handle} --for exit --timeout-ms 180000`, false);

      // Read the terminal output to extract the JSON payload
      const output = run(`orca terminal read --terminal ${evalTerm.handle}`);
      if (output && output.content) {
        const text = output.content;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const result = JSON.parse(jsonMatch[1]);
            score = result.score || 0;
            feedback = result.feedback || "No specific feedback provided.";
            console.log(`\nEvaluator gave score: ${score}/10`);
            console.log(`Feedback: ${feedback}`);
          } catch (e) {
            console.log("Could not parse evaluator output");
          }
        } else {
          console.log("No JSON block found in evaluator output.");
          score = 5; // Default mediocre score to continue loop
        }
      }
    }
    currentTurn++;
  }

  if (score >= 8) {
    console.log("\nSUCCESS! The UI has been satisfactorily refactored.");
  } else {
    console.log("\nMax turns reached without passing score.");
  }
}

main();

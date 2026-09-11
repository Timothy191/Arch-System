const fs = require("fs");
const { execSync } = require("child_process");

const loopSpecPath = process.argv[2];
const artifactsDir = process.argv[3];

if (!loopSpecPath || !artifactsDir) {
  console.error("Usage: node verify.cjs <loopSpecPath> <artifactsDir>");
  process.exit(1);
}

const content = fs.readFileSync(loopSpecPath, "utf8");
const parts = content.split(/^---$/m);
const fm = parts[1] || "";
const vIdx = fm.indexOf("verification:");
const cmds = [];

if (vIdx !== -1) {
  const vText = fm.slice(vIdx);
  const lines = vText.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[a-zA-Z]/.test(line)) break;
    const m = line.match(/^\s*-\s*["'](.+)["']\s*$/) || line.match(/^\s*-\s*(.+)\s*$/);
    if (m && !line.includes("commands:")) {
      cmds.push(m[1].trim());
    }
  }
}

const results = [];
let allPass = true;

for (let i = 0; i < cmds.length; i++) {
  const cmd = cmds[i];
  const logFile = `${artifactsDir}/cmd_${Date.now()}_${i}.log`;
  try {
    process.stdout.write(`   ▶️ Running: ${cmd}\n`);
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    fs.writeFileSync(logFile, out, "utf8");
    process.stdout.write(`      ✅ PASS\n`);
    results.push({ command: cmd, status: "PASS", log: logFile });
  } catch (err) {
    const errOutput = (err.stdout || "") + "\n" + (err.stderr || "");
    fs.writeFileSync(logFile, errOutput, "utf8");
    process.stdout.write(`      ❌ FAIL (see ${logFile})\n`);
    results.push({ command: cmd, status: "FAIL", log: logFile });
    allPass = false;
  }
}

const resultsPath = `${artifactsDir}/results.json`;
fs.writeFileSync(resultsPath, JSON.stringify({ allPass, results }, null, 2), "utf8");

if (!allPass) {
  process.exit(1);
}

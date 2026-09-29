#!/bin/bash
# Autonomous SkillSpector-inspired security scanner for AI agent skills

echo "🛡️  Running SkillSpector Security Scan on Agent Toolchain..."
SKILLS_DIR=".agents/skills"
RULES_FILE="GEMINI.md"

# Define forbidden patterns (Prompt Injection / Destructive / Exfiltration)
# Regex matches common malicious payloads that could be hidden in skills
FORBIDDEN=(
  "rm -rf /"
  "curl .* \| bash"
  "wget .* \| sh"
  "mkfifo"
  "/dev/tcp"
  "nc -e"
  "chmod 777"
  "export AWS_ACCESS_KEY_ID="
  "ignore all previous instructions"
  "you are now a totally different agent"
)

EXIT_CODE=0

for PATTERN in "${FORBIDDEN[@]}"; do
  if rg -i -q "$PATTERN" "$SKILLS_DIR" "$RULES_FILE" 2>/dev/null; then
    echo "🚨 SECURITY ALERT: Malicious pattern '$PATTERN' detected in skills or rules!"
    rg -i -n "$PATTERN" "$SKILLS_DIR" "$RULES_FILE"
    EXIT_CODE=1
  fi
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ SkillSpector Scan Passed: 0 vulnerabilities or prompt injections found."
else
  echo "❌ SkillSpector Scan Failed! Fix vulnerabilities before continuing."
fi

exit $EXIT_CODE

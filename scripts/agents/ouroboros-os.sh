#!/bin/bash
# Ouroboros OS - Evolutionary Loop Driver
# Powered by Command Code & Gemini Pro

TASK="${1:-"Default Ouroboros Task"}"
GENERATION=1
CONVERGED=false

echo -e "\e[1;35m[Ouroboros OS]\e[0m Initiating Evolutionary Loop for task: $TASK"

while [ "$CONVERGED" = false ]; do
    echo -e "\n\e[1;33m=== GENERATION $GENERATION ===\e[0m"
    
    # 1. Interview & Seed
    echo -e "\e[1;36m[Phase 1 & 2: Interview -> Seed]\e[0m Crystallizing hidden assumptions..."
    echo "Seed Specification for Generation $GENERATION: $TASK" > .ralph_seed.md
    
    # 2. Execute (Antigravity CLI + Gemini 3.8 Flash Low)
    echo -e "\e[1;34m[Phase 3: Execute]\e[0m Handing off to Antigravity CLI (Gemini 3.8 Flash)..."
    export AGY_AUTO_APPROVE=true
    
    # We execute natively using the verified Antigravity CLI
    agy --model gemini-3.8-flash-low --dangerously-skip-permissions --print "Implement the specification in .ralph_seed.md" || true

    # 3. Evaluate (4-Pillar Gates)
    echo -e "\e[1;32m[Phase 4: Evaluate]\e[0m Running mechanical and semantic quality gates..."
    if bash tools/scripts/enforce-quality-gates.sh > /tmp/ouroboros_eval.log 2>&1; then
        echo -e "\e[1;32m[Converged]\e[0m Ontology stabilized. Evaluation passed."
        CONVERGED=true
    else
        # 4. Evolve
        echo -e "\e[1;31m[Phase 5: Evolve]\e[0m Gate failed. Triggering Wonder Phase: What do we still not know?"
        # In a real swarm, this parses /tmp/ouroboros_eval.log and mutates the seed.
        GENERATION=$((GENERATION + 1))
        
        # Failsafe to prevent infinite loops in the terminal
        if [ "$GENERATION" -gt 3 ]; then
            echo -e "\e[1;31m[Halt]\e[0m Max generations reached without convergence. Escalating to human."
            exit 1
        fi
    fi
done

echo -e "\e[1;35m[Ouroboros OS]\e[0m Serpent loop complete."

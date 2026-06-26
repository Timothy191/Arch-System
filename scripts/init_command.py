import os
import json
import datetime
import subprocess

def run_init():
    # Ingesting & Mapping
    why_path = "10-src/@WHY.md"
    how_path = "10-src/@HOW.md"
    disclosure_path = "10-src/@PROGRESSIVE_DISCLOSURE.md"
    agents_path = "10-src/agents.md"
    
    # State Analysis
    # Run checkout-skill.py to see active skills
    try:
        res = subprocess.run(["python", "10-src/checkout-skill.py"], capture_output=True, text=True)
        checkout_out = res.stdout.strip()
    except Exception as e:
        checkout_out = str(e)
    
    active_skills = []
    if "feature-scaffolder" in checkout_out:
        active_skills.append("feature-scaffolder")
    
    # Active Persona Name
    active_persona = "Antigravity Lead Orchestrator"
    if os.path.exists(agents_path):
        with open(agents_path, 'r') as f:
            content = f.read()
            if "Antigravity Lead Orchestrator" in content:
                active_persona = "Antigravity Lead Orchestrator"
    
    # Save persistent state file
    state = {
        "last_synced": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "active_persona": active_persona,
        "loaded_skills": active_skills
    }
    
    state_dir = ".gemini"
    os.makedirs(state_dir, exist_ok=True)
    with open(os.path.join(state_dir, "init_state.json"), "w") as f:
        json.dump(state, f, indent=2)
        
    # Generate ANTIGRAVITY.md
    antigravity_content = f"""# 🪐 ANTIGRAVITY ALIGNMENT HUB
> **Last Synced:** {state['last_synced']} | **Environment:** Local Sandbox

## 🧭 System Core Direction
*   **Architecture:** Numbered-Functional Architecture (Prefixes, `10-src/` source isolation).
*   **UI Paradigm:** Minimalist White Glassmorphism (macOS-inspired terminal/TUI layouts).
*   **Operational Rule:** Strict human-centric manual data entry over automated hardware sensors.

## 🤖 Active Persona & Skills Registry
*   **Current Session Profile:** {state['active_persona']}
*   **Loaded Modular Skills:**
"""
    for skill in state['loaded_skills']:
        antigravity_content += f"    *   `{skill}` -> Allocated via `checkout-skill.py`\n"
    if not state['loaded_skills']:
        antigravity_content += "    *   None loaded\n"
        
    antigravity_content += """
## 🏁 Session Bootstrapping Checklist
- [ ] Read `@WHY.md` and `@HOW.md` for latest invariant rules.
- [ ] Check local git status using `/diff` to identify uncommitted workspace changes.
- [ ] Ensure local Rocky Linux synchronization cron pipelines are stable.
"""

    with open("ANTIGRAVITY.md", "w") as f:
        f.write(antigravity_content)
        
    print("Workspace initialized successfully! Generated ANTIGRAVITY.md and saved state to .gemini/init_state.json.")

if __name__ == "__main__":
    run_init()

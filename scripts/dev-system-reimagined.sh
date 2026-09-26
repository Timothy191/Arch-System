#!/bin/bash
# Re-designed deployment dev script (ARWR + Swarm orchestrated)
# Launches pnpm dev in a neat terminal popup, auto-browsers, and deploys a monitor.

echo -e "\e[1;36m[ARWR Orchestrator]\e[0m Initializing System Dev Deployment (Specialist Method)..."

# 1. Sync assets (DAG swarming pre-flight)
if [ -f "scripts/sync-assets-smart.cjs" ]; then
    echo -e "\e[1;35m[DAG]\e[0m Syncing assets..."
    node scripts/sync-assets-smart.cjs
fi

# 2. Spawn neat popup terminal for pnpm dev
echo -e "\e[1;32m[T0 Coordinator]\e[0m Spawning neat terminal for pnpm dev..."
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="Arch-System Dev Engine" -- bash -c "echo -e '\e[1;32m[Arch-System]\e[0m Booting Next.js Turbopack...'; pnpm turbo run dev --filter=portal; exec bash" &
elif command -v kitty &> /dev/null; then
    kitty -T "Arch-System Dev Engine" bash -c "echo -e '\e[1;32m[Arch-System]\e[0m Booting Next.js Turbopack...'; pnpm turbo run dev --filter=portal; exec bash" &
else
    x-terminal-emulator -e bash -c "echo -e '\e[1;32m[Arch-System]\e[0m Booting Next.js Turbopack...'; pnpm turbo run dev --filter=portal; exec bash" &
fi

# 3. Spawn monitor terminal
echo -e "\e[1;34m[Watchdog]\e[0m Deploying monitoring terminal HUD..."
if command -v gnome-terminal &> /dev/null; then
    gnome-terminal --title="Arch-System Monitor HUD" -- bash -c "echo -e '\e[1;34m[HUD]\e[0m Monitoring codebase health...'; (pnpm monitor || htop || top); exec bash" &
elif command -v kitty &> /dev/null; then
    kitty -T "Arch-System Monitor HUD" bash -c "echo -e '\e[1;34m[HUD]\e[0m Monitoring codebase health...'; (pnpm monitor || htop || top); exec bash" &
else
    x-terminal-emulator -e bash -c "echo -e '\e[1;34m[HUD]\e[0m Monitoring codebase health...'; (pnpm monitor || htop || top); exec bash" &
fi

# 4. Auto-browser loop (waits for port 3000)
echo -e "\e[1;33m[UI-Engineer]\e[0m Awaiting port 3000 for auto-browser login..."
(
  timeout 60 bash -c 'until printf "" 2>>/dev/null >>/dev/tcp/$0/$1; do sleep 1; done' localhost 3000
  if [ $? -eq 0 ]; then
      echo -e "\e[1;32m[Success]\e[0m Port 3000 active. Opening browser..."
      if command -v xdg-open &> /dev/null; then
          xdg-open http://localhost:3000/ >/dev/null 2>&1
      else
          open http://localhost:3000/ >/dev/null 2>&1
      fi
  else
      echo -e "\e[1;31m[Timeout]\e[0m Dev server did not bind to port 3000."
  fi
) &

echo -e "\e[1;32m[System]\e[0m Swarm deployment complete. Processes handed off to specialists successfully."

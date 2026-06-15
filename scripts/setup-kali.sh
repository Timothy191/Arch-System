#!/usr/bin/env bash
set -euo pipefail

# Arch-Systems — Fresh Kali Linux Setup Script
# One-click zero-to-hero deployment script.

CLR_RESET="\033[0m"
CLR_CYAN="\033[0;36m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_RED="\033[0;31m"

echo -e "\n${CLR_CYAN}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
echo -e "${CLR_CYAN}│          ARCH-SYSTEMS — KALI LINUX FRESH SETUP             │${CLR_RESET}"
echo -e "${CLR_CYAN}├────────────────────────────────────────────────────────────┤${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Installs Docker, Node.js, pnpm, and deploys the portal.    ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}│${CLR_RESET} Guarantees data persistence and easy network connectivity. ${CLR_CYAN}│${CLR_RESET}"
echo -e "${CLR_CYAN}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"

echo -e "${CLR_YELLOW}This script will prompt for your sudo password to install packages.${CLR_RESET}"

# Error Handler
handle_error() {
    echo -e "\n${CLR_RED}┌────────────────────────────────────────────────────────────┐${CLR_RESET}"
    echo -e "${CLR_RED}│  CRITICAL FAILURE: Setup interrupted due to an error.      │${CLR_RESET}"
    echo -e "${CLR_RED}└────────────────────────────────────────────────────────────┘${CLR_RESET}\n"
    exit 1
}
trap 'handle_error' ERR

# 1. System Dependencies
echo -e "\n${CLR_GREEN}[1/4] Installing system dependencies (Docker, Git, Curl)...${CLR_RESET}"
sudo apt-get update -y
sudo apt-get install -y curl git docker.io docker-compose lsof iptables ufw

# 2. Docker Configuration
echo -e "\n${CLR_GREEN}[2/4] Configuring Docker for persistent, safe data...${CLR_RESET}"
sudo systemctl enable docker --now
sudo usermod -aG docker "$USER" || true
# Temporarily grant docker socket permissions to avoid requiring a reboot/re-login immediately
sudo chmod 666 /var/run/docker.sock || true

# 3. Runtime Tools (Node.js & pnpm)
echo -e "\n${CLR_GREEN}[3/4] Installing Volta (Node.js 20.17.0 & pnpm 9.12.0)...${CLR_RESET}"
export VOLTA_HOME="$HOME/.volta"
if [ ! -d "$VOLTA_HOME" ]; then
    curl https://get.volta.sh | bash
fi
# Add to current path so the rest of the script can use them immediately
export PATH="$VOLTA_HOME/bin:$PATH"

volta install node@20.17.0
volta install pnpm@9.12.0

# 4. Firewall configuration
echo -e "\n${CLR_GREEN}[4/4] Configuring firewall for local network access...${CLR_RESET}"
# We open port 3000 (Portal) and 54321 (Supabase API)
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 3000/tcp >/dev/null 2>&1 || true
    sudo ufw allow 54321/tcp >/dev/null 2>&1 || true
else
    sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    sudo iptables -A INPUT -p tcp --dport 54321 -j ACCEPT 2>/dev/null || true
fi

echo -e "\n${CLR_GREEN}Setup Complete! Launching Live Network Deployment and Monitoring HUD...${CLR_RESET}"
sleep 2

# Handoff to the existing robust deployment script and launch monitor-hud in a split pane
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Attempt to launch the monitor HUD in a new terminal window or split pane (using terminator, tmux, or x-terminal-emulator)
if command -v tmux >/dev/null 2>&1; then
    echo -e "${CLR_CYAN}Launching in tmux split-pane...${CLR_RESET}"
    tmux new-session -d -s arch_deploy "bash $REPO_ROOT/scripts/deploy-live-local.sh"
    tmux split-window -h "bash $REPO_ROOT/scripts/monitor-hud.sh"
    tmux attach-session -t arch_deploy
elif command -v terminator >/dev/null 2>&1; then
    echo -e "${CLR_CYAN}Launching in Terminator split-pane...${CLR_RESET}"
    terminator -e "bash $REPO_ROOT/scripts/deploy-live-local.sh" &
    sleep 1
    terminator -e "bash $REPO_ROOT/scripts/monitor-hud.sh" &
elif command -v x-terminal-emulator >/dev/null 2>&1; then
    echo -e "${CLR_CYAN}Launching in separate terminal windows...${CLR_RESET}"
    x-terminal-emulator -e "bash $REPO_ROOT/scripts/monitor-hud.sh" &
    bash "$REPO_ROOT/scripts/deploy-live-local.sh"
else
    echo -e "${CLR_YELLOW}No supported split-pane terminal (tmux, terminator) found. Running deployment only.${CLR_RESET}"
    echo -e "${CLR_YELLOW}To view the monitoring HUD, open a new terminal and run: ./scripts/monitor-hud.sh${CLR_RESET}"
    bash "$REPO_ROOT/scripts/deploy-live-local.sh"
fi

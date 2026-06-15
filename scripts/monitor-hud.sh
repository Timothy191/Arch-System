#!/usr/bin/env bash
# Arch-Systems — Terminal SysOps HUD v1.0.0
# Features:
# 1. Native absolute-cursor rendering (zero terminal flicker)
# 2. API health and connection latency monitor (Next.js, Supabase, Redis, n8n, Flowise)
# 3. Next.js Portal background server resource profiling (CPU/Mem via PID)
# 4. Live Docker container resource matrix (from docker stats)
# 5. Scrolling unified log stream panel

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL_LOG="$REPO_ROOT/portal.log"
DEPLOY_LOG="$REPO_ROOT/deploy.log"
PORTAL_PID_FILE="$REPO_ROOT/.portal.pid"

# Colors
CLR_RESET="\033[0m"
CLR_RED="\033[0;31m"
CLR_GREEN="\033[0;32m"
CLR_YELLOW="\033[0;33m"
CLR_BLUE="\033[0;34m"
CLR_MAGENTA="\033[0;35m"
CLR_CYAN="\033[0;36m"
CLR_WHITE="\033[0;37m"
CLR_GRAY="\033[0;90m"

# Absolute positioning helpers
move_cursor() { tput cup "$1" "$2"; }
clear_line() { tput el; }

# Measures HTTP request response latency in ms
measure_latency() {
  local url="$1"
  local start
  start=$(date +%s%N)
  if curl -fs -o /dev/null -m 2 "$url" >/dev/null 2>&1; then
    local end
    end=$(date +%s%N)
    local diff
    diff=$(( (end - start) / 1000000 ))
    echo "$diff"
  else
    echo "DOWN"
  fi
}

# Measures raw TCP port connectivity
measure_tcp_conn() {
  local port="$1"
  if timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1; then
    echo "ACTIVE"
  else
    echo "DOWN"
  fi
}

# Graceful termination
cleanup() {
  tput cnorm # Show cursor
  clear
  echo -e "SysOps HUD closed successfully."
  exit 0
}
trap cleanup SIGINT SIGTERM

# Initialize screen
tput civis # Hide cursor
clear

# Main loop
while true; do
  # Get terminal dimensions
  COLS=$(tput cols)
  LINES=$(tput lines)

  if [ "$COLS" -lt 80 ] || [ "$LINES" -lt 24 ]; then
    move_cursor 0 0
    echo -e "${CLR_RED}Terminal too small!${CLR_RESET} Resize window to at least 80x24 to draw HUD."
    tput el
    sleep 2
    continue
  fi

  # ── Header ───────────────────────────────────────────────
  move_cursor 0 0
  echo -e "${CLR_MAGENTA}┌──────────────────────────────────────────────────────────────────────────────┐${CLR_RESET}"
  move_cursor 1 0
  echo -e "${CLR_MAGENTA}│${CLR_RESET}   ${CLR_CYAN}ARCH-SYSTEMS TELEMETRY & SYSOPS HUD${CLR_RESET}               |  ${CLR_YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${CLR_RESET}   ${CLR_MAGENTA}│${CLR_RESET}"
  move_cursor 2 0
  echo -e "${CLR_MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${CLR_RESET}"

  # ── API Health & Connection Matrix ───────────────────────
  move_cursor 3 0
  echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_WHITE}SERVICE MATRIX & LATENCY TESTS:${CLR_RESET}"
  tput el; move_cursor 3 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # 1. Next.js Portal App
  move_cursor 4 0
  PORTAL_LATENCY=$(measure_latency "http://localhost:3000/login")
  if [ "$PORTAL_LATENCY" != "DOWN" ]; then
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Next.js Portal App:    ${CLR_GREEN}ACTIVE${CLR_RESET}  (${CLR_YELLOW}${PORTAL_LATENCY}ms${CLR_RESET} latency) on port 3000"
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Next.js Portal App:    ${CLR_RED}DOWN${CLR_RESET}    (No connection) on port 3000"
  fi
  tput el; move_cursor 4 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # 2. Supabase API Gateway
  move_cursor 5 0
  SUPABASE_LATENCY=$(measure_latency "http://127.0.0.1:54321/rest/v1/")
  if [ "$SUPABASE_LATENCY" != "DOWN" ]; then
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Supabase REST API:     ${CLR_GREEN}ACTIVE${CLR_RESET}  (${CLR_YELLOW}${SUPABASE_LATENCY}ms${CLR_RESET} latency) on port 54321"
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Supabase REST API:     ${CLR_RED}DOWN${CLR_RESET}    (No connection) on port 54321"
  fi
  tput el; move_cursor 5 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # 3. Redis Cache
  move_cursor 6 0
  REDIS_STATUS=$(measure_tcp_conn 6379)
  if [ "$REDIS_STATUS" = "ACTIVE" ]; then
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Redis Cache Layer:     ${CLR_GREEN}ACTIVE${CLR_RESET}  (TCP port responsive) on port 6379"
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Redis Cache Layer:     ${CLR_RED}DOWN${CLR_RESET}    (Connection refused) on port 6379"
  fi
  tput el; move_cursor 6 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # 4. n8n Automation Engine
  move_cursor 7 0
  N8N_LATENCY=$(measure_latency "http://localhost:5678/")
  if [ "$N8N_LATENCY" != "DOWN" ]; then
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • n8n Webhook Router:    ${CLR_GREEN}ACTIVE${CLR_RESET}  (${CLR_YELLOW}${N8N_LATENCY}ms${CLR_RESET} latency) on port 5678"
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • n8n Webhook Router:    ${CLR_RED}DOWN${CLR_RESET}    (No connection) on port 5678"
  fi
  tput el; move_cursor 7 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # 5. Flowise AI Gateway
  move_cursor 8 0
  FLOWISE_STATUS=$(measure_tcp_conn 3001)
  if [ "$FLOWISE_STATUS" = "ACTIVE" ]; then
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Flowise AI Gateway:    ${CLR_GREEN}ACTIVE${CLR_RESET}  (TCP port responsive) on port 3001"
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Flowise AI Gateway:    ${CLR_RED}DOWN${CLR_RESET}    (Connection refused) on port 3001"
  fi
  tput el; move_cursor 8 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # ── Portal App Resource Profiler ───────────────────────
  move_cursor 9 0
  echo -e "${CLR_MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${CLR_RESET}"
  move_cursor 10 0
  echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_WHITE}PORTAL PROCESS RESOURCE PROFILE:${CLR_RESET}"
  tput el; move_cursor 10 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  move_cursor 11 0
  if [ -f "$PORTAL_PID_FILE" ]; then
    PID=$(cat "$PORTAL_PID_FILE" || true)
    if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
      STATS=$(ps -p "$PID" -o %cpu,%mem,rss || echo "0.0 0.0 0")
      CPU=$(echo "$STATS" | tail -n 1 | awk '{print $1}')
      MEM=$(echo "$STATS" | tail -n 1 | awk '{print $2}')
      RSS_KB=$(echo "$STATS" | tail -n 1 | awk '{print $3}')
      RSS_MB=$(( RSS_KB / 1024 ))
      echo -e "${CLR_MAGENTA}│${CLR_RESET}  PID: ${CLR_CYAN}${PID}${CLR_RESET} | Node CPU: ${CLR_YELLOW}${CPU}%${CLR_RESET} | Node Memory: ${CLR_YELLOW}${MEM}%${CLR_RESET} (${RSS_MB} MB RSS)"
    else
      echo -e "${CLR_MAGENTA}│${CLR_RESET}  Server state: ${CLR_RED}NOT RUNNING${CLR_RESET} (Process ID not found in ps)"
    fi
  else
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  Server state: ${CLR_RED}NOT RUNNING${CLR_RESET} (.portal.pid missing)"
  fi
  tput el; move_cursor 11 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # ── Docker Containers Status & Stats ────────────────────
  move_cursor 12 0
  echo -e "${CLR_MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${CLR_RESET}"
  move_cursor 13 0
  echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_WHITE}ACTIVE DOCKER CONTAINERS MATRIX:${CLR_RESET}"
  tput el; move_cursor 13 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  move_cursor 14 0
  DOCKER_ACTIVE=false
  if docker info >/dev/null 2>&1; then
    DOCKER_ACTIVE=true
  fi

  if [ "$DOCKER_ACTIVE" = true ]; then
    # Grab docker stats for our relevant containers
    CONTAINERS=$(docker ps --format "{{.Names}}" | grep -E "supabase_|plantcor-" || true)
    if [ -n "$CONTAINERS" ]; then
      LINE_OFFSET=14
      echo "$CONTAINERS" | while read -r name; do
        if [ "$LINE_OFFSET" -lt 18 ]; then
          move_cursor "$LINE_OFFSET" 0
          # Grab CPU and memory usage
          C_STATS=$(docker stats --no-stream --format "{{.CPUPerc}} | {{.MemUsage}}" "$name" 2>/dev/null || echo "0.00% | 0MiB / 0MiB")
          C_CPU=$(echo "$C_STATS" | awk -F '|' '{print $1}' | xargs)
          C_MEM=$(echo "$C_STATS" | awk -F '|' '{print $2}' | xargs)
          echo -e "${CLR_MAGENTA}│${CLR_RESET}  • Container: ${CLR_BLUE}%-24s${CLR_RESET} | CPU: ${CLR_YELLOW}%-8s${CLR_RESET} | RAM: ${CLR_CYAN}%-18s${CLR_RESET}" "$name" "$C_CPU" "$C_MEM"
          tput el; move_cursor "$LINE_OFFSET" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
          LINE_OFFSET=$(( LINE_OFFSET + 1 ))
        fi
      done
      
      # Clear remaining container lines up to line 18
      for l in $(seq "$LINE_OFFSET" 17); do
        move_cursor "$l" 0
        tput el; move_cursor "$l" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
      done
    else
      move_cursor 14 0
      echo -e "${CLR_MAGENTA}│${CLR_RESET}  No project-specific Docker containers currently running."
      tput el; move_cursor 14 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
      for l in $(seq 15 17); do move_cursor "$l" 0; tput el; move_cursor "$l" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"; done
    fi
  else
    move_cursor 14 0
    echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_RED}DOCKER SYSTEM IS NOT ACTIVE OR RUNNING.${CLR_RESET}"
    tput el; move_cursor 14 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
    for l in $(seq 15 17); do move_cursor "$l" 0; tput el; move_cursor "$l" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"; done
  fi

  # ── Live Scrolling Unified Logs ──────────────────────────
  move_cursor 18 0
  echo -e "${CLR_MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${CLR_RESET}"
  move_cursor 19 0
  echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_WHITE}LIVE UNIFIED SYSTEM LOG STREAM:${CLR_RESET}"
  tput el; move_cursor 19 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"

  # Read last 3 lines from portal log and last 2 from deploy log to construct 5 scrolling lines
  LINE_OFFSET=20
  for l in $(seq 0 3); do
    move_cursor $(( LINE_OFFSET + l )) 0
    tput el; move_cursor $(( LINE_OFFSET + l )) 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
  done

  # Print portal log lines if file exists
  if [ -f "$PORTAL_LOG" ]; then
    P_LINES=$(tail -n 2 "$PORTAL_LOG" 2>/dev/null | sed 's/^[[:space:]]*//' || true)
    echo "$P_LINES" | while read -r line; do
      if [ -n "$line" ] && [ "$LINE_OFFSET" -lt 22 ]; then
        move_cursor "$LINE_OFFSET" 0
        # Clean escape codes if any, limit string width to fit border
        CLEAN_LINE=$(echo "$line" | cut -c1-70)
        echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_GRAY}[portal]${CLR_RESET} $CLEAN_LINE"
        tput el; move_cursor "$LINE_OFFSET" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
        LINE_OFFSET=$(( LINE_OFFSET + 1 ))
      fi
    done
  fi

  # Print deploy log lines if file exists
  if [ -f "$DEPLOY_LOG" ]; then
    D_LINES=$(tail -n 2 "$DEPLOY_LOG" 2>/dev/null | grep -vE "^(┌|│|└)" | sed 's/^[[:space:]]*//' || true)
    echo "$D_LINES" | while read -r line; do
      if [ -n "$line" ] && [ "$LINE_OFFSET" -lt 24 ]; then
        move_cursor "$LINE_OFFSET" 0
        CLEAN_LINE=$(echo "$line" | cut -c1-70)
        echo -e "${CLR_MAGENTA}│${CLR_RESET}  ${CLR_GRAY}[deploy]${CLR_RESET} $CLEAN_LINE"
        tput el; move_cursor "$LINE_OFFSET" 79; echo -e "${CLR_MAGENTA}│${CLR_RESET}"
        LINE_OFFSET=$(( LINE_OFFSET + 1 ))
      fi
    done
  fi

  # Footer border
  move_cursor 24 0
  echo -e "${CLR_MAGENTA}└──────────────────────────────────────────────────────────────────────────────┘${CLR_RESET}"
  tput el

  sleep 1.5
done

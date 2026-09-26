#!/bin/bash
# 2. Python Packages (Agent-Reach, Scrapling, GPT-Researcher)
echo "[Python] Installing pip packages..."
pip install agent-reach "scrapling[all]" gpt-researcher

# 3. Post-install Configurations
echo "[Scrapling] Installing browser binaries..."
scrapling install

echo "[Agent-Reach] Installing system dependencies..."
agent-reach install --env=auto --system || echo "Agent-reach install skipped or failed. Continuing..."

# 4. GPT-Researcher Gemini Setup
echo "[GPT-Researcher] Configuring for Gemini Models..."
mkdir -p .gpt-researcher
cat << 'ENV' > .env.researcher
RETRIEVER=tavily
LLM_PROVIDER=gemini
FAST_LLM=gemini-1.5-flash
SMART_LLM=gemini-1.5-pro
ENV
cp .env.researcher ~/.gpt-researcher.env || true

echo -e "\e[1;32m[Success]\e[0m Research toolchain successfully installed and configured."

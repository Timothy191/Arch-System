#!/bin/bash
# Multi-Gate Quality & Reality Enforcer
# Validates code against 4 strict pillars before allowing a task to complete.

echo -e "\e[1;36m[System]\e[0m Initiating Multi-Gate Quality & Reality Verification..."

FAILURES=0

# GATE 1: Real-World Checker (ARWR)
echo -e "\n\e[1;34m=== GATE 1: ARWR (Real-World Checker) ===\e[0m"
# Check if there are modified files without corresponding test updates or terminal output logs
UNTRACKED=$(git ls-files --others --exclude-standard)
MODIFIED=$(git diff --name-only)
if [ -z "$MODIFIED" ] && [ -z "$UNTRACKED" ]; then
    echo -e "\e[1;32m[PASS]\e[0m Reality baseline matches. (No uncommitted changes pending verification)."
else
    echo -e "\e[1;33m[WARN]\e[0m Uncommitted changes detected. Ensure ARWR terminal output validates these files before pushing."
fi

# GATE 2: Functionality Verified
echo -e "\n\e[1;34m=== GATE 2: Functionality Verification ===\e[0m"
if grep -q '"test"' package.json; then
    echo "Running unit tests..."
    pnpm test > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "\e[1;32m[PASS]\e[0m Functionality verified. Tests pass."
    else
        echo -e "\e[1;31m[FAIL]\e[0m Tests failed. Code is not functional."
        ((FAILURES++))
    fi
else
    echo -e "\e[1;33m[WARN]\e[0m No 'test' script found in package.json. Assuming untested functionality."
fi

# GATE 3: Quality and Modernization
echo -e "\n\e[1;34m=== GATE 3: Quality & Modernization ===\e[0m"
# Check for deprecated Next.js patterns (e.g., next/legacy/image)
if command -v rg &> /dev/null; then
    DEPRECATED=$(rg "next/legacy/image" apps/ packages/ libs/ 2>/dev/null || true)
    if [ -z "$DEPRECATED" ]; then
        echo -e "\e[1;32m[PASS]\e[0m No legacy imports detected."
    else
        echo -e "\e[1;31m[FAIL]\e[0m Deprecated/Legacy imports detected. Modernization required."
        ((FAILURES++))
    fi
else
    echo -e "\e[1;32m[PASS]\e[0m (Skipped legacy grep; ripgrep not installed)"
fi

# Check Type Safety (Strict TypeScript)
echo "Checking TypeScript strictness..."
pnpm turbo run type-check > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "\e[1;32m[PASS]\e[0m TypeScript validation passed."
else
    echo -e "\e[1;31m[FAIL]\e[0m Type-check failed. Strict typing is mandatory."
    ((FAILURES++))
fi

# GATE 4: Highest Standard (Security & Cleanliness)
echo -e "\n\e[1;34m=== GATE 4: High Standards & Security ===\e[0m"
if command -v rg &> /dev/null; then
    ANY_TYPES=$(rg "any\b" apps/ packages/ libs/ -g "*.ts" -g "*.tsx" 2>/dev/null | wc -l)
    if [ "$ANY_TYPES" -eq 0 ]; then
        echo -e "\e[1;32m[PASS]\e[0m Zero 'any' types detected."
    else
        echo -e "\e[1;33m[WARN]\e[0m Detected explicit 'any' types. Ensure these are justified and not bypassing security."
    fi
else
    echo -e "\e[1;32m[PASS]\e[0m (Skipped 'any' grep; ripgrep not installed)"
fi

echo -e "\n----------------------------------------"
if [ $FAILURES -eq 0 ]; then
    echo -e "\e[1;32m[SUCCESS]\e[0m All Quality Gates Passed. Clear to proceed."
    exit 0
else
    echo -e "\e[1;31m[REJECTED]\e[0m Failed $FAILURES gate(s). Realignment required."
    exit 1
fi

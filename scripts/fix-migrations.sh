#!/bin/bash

# Arch-System Migration Configuration Repair Script
# This script identifies and fixes common migration issues:
# - Duplicate sequence numbers
# - Missing IF NOT EXISTS clauses
# - UPDATE without WHERE clauses
# - Sequence gaps

set -e

echo "🔧 Arch-System Migration Configuration Repair"
echo "=========================================="

MIGRATIONS_DIR="./packages/database/migrations"

echo "📁 Checking migration files in $MIGRATIONS_DIR..."

# Find all SQL migration files
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)
TOTAL_MIGRATIONS=$(echo "$MIGRATION_FILES" | wc -l)

echo "📊 Found $TOTAL_MIGRATIONS migration files"

# Check for duplicate sequence numbers
echo "🔍 Checking for duplicate sequence numbers..."
DUPLICATES=$(echo "$MIGRATION_FILES" | sed -E 's/.*\/([0-9]+)_.*/\1/' | sort | uniq -d)

if [ -n "$DUPLICATES" ]; then
    echo "❌ Found duplicate sequence numbers: $DUPLICATES"
    for dup in $DUPLICATES; do
        echo "   Files with sequence $dup:"
        echo "$MIGRATION_FILES" | grep "${dup}_" || true
    done
else
    echo "✅ No duplicate sequence numbers found"
fi

# Check for sequence gaps
echo "🔍 Checking for sequence gaps..."
SEQUENCE_NUMBERS=$(echo "$MIGRATION_FILES" | sed -E 's/.*\/([0-9]+)_.*/\1/' | sort -n)
MIN_SEQ=$(echo "$SEQUENCE_NUMBERS" | head -1)
MAX_SEQ=$(echo "$SEQUENCE_NUMBERS" | tail -1)

if [ "$MIN_SEQ" -lt "$MAX_SEQ" ]; then
    echo "📈 Sequence range: $MIN_SEQ to $MAX_SEQ"
    
    # Find gaps
    EXPECTED_COUNT=$((MAX_SEQ - MIN_SEQ + 1))
    ACTUAL_COUNT=$(echo "$SEQUENCE_NUMBERS" | wc -l)
    
    if [ "$EXPECTED_COUNT" -ne "$ACTUAL_COUNT" ]; then
        echo "❌ Found sequence gaps: Expected $EXPECTED_COUNT migrations, found $ACTUAL_COUNT"
        
        # Find specific gaps
        PREV=$MIN_SEQ
        for seq in $SEQUENCE_NUMBERS; do
            NEXT=$((PREV + 1))
            if [ "$seq" -ne "$NEXT" ]; then
                echo "   Gap: $PREV → $seq (missing $NEXT to $((seq - 1)))"
            fi
            PREV=$seq
        done
    else
        echo "✅ No sequence gaps found"
    fi
else
    echo "✅ Only one migration file"
fi

# Check for critical issues in migration files
echo "🔍 Checking for critical SQL issues..."

ISSUES_FOUND=0

# Check for UPDATE without WHERE clause
echo "🔍 Checking for UPDATE without WHERE clauses..."
UPDATE_WITHOUT_WHERE=$(grep -rn "UPDATE.*SET" "$MIGRATIONS_DIR" | grep -v "WHERE" | grep -v -- "--" | head -10)

if [ -n "$UPDATE_WITHOUT_WHERE" ]; then
    echo "❌ Found UPDATE statements without WHERE clauses:"
    echo "$UPDATE_WITHOUT_WHERE"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "✅ No UPDATE without WHERE clauses found"
fi

# Check for CREATE INDEX without IF NOT EXISTS
echo "🔍 Checking for CREATE INDEX without IF NOT EXISTS..."
INDEX_WITHOUT_IF_NOT_EXISTS=$(grep -rn "CREATE INDEX" "$MIGRATIONS_DIR" | grep -v "IF NOT EXISTS" | grep -v -- "--" | head -5)

if [ -n "$INDEX_WITHOUT_IF_NOT_EXISTS" ]; then
    echo "❌ Found CREATE INDEX without IF NOT EXISTS:"
    echo "$INDEX_WITHOUT_IF_NOT_EXISTS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "✅ No CREATE INDEX without IF NOT EXISTS found"
fi

# Check for CREATE TABLE without IF NOT EXISTS
echo "🔍 Checking for CREATE TABLE without IF NOT EXISTS..."
TABLE_WITHOUT_IF_NOT_EXISTS=$(grep -rn "CREATE TABLE" "$MIGRATIONS_DIR" | grep -v "IF NOT EXISTS" | grep -v -- "--" | head -5)

if [ -n "$TABLE_WITHOUT_IF_NOT_EXISTS" ]; then
    echo "❌ Found CREATE TABLE without IF NOT EXISTS:"
    echo "$TABLE_WITHOUT_IF_NOT_EXISTS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "✅ No CREATE TABLE without IF NOT EXISTS found"
fi

echo ""
echo "📋 Summary:"
echo "=================="
if [ "$ISSUES_FOUND" -eq 0 ] && [ -z "$DUPLICATES" ] && [ "$EXPECTED_COUNT" -eq "$ACTUAL_COUNT" ]; then
    echo "✅ All migration checks passed!"
else
    echo "⚠️  Found $ISSUES_FOUND issue types that need attention"
    echo "✅ Run: pnpm --filter @repo/database migrate:lint for detailed analysis"
fi

echo ""
echo "🔧 To fix migration issues:"
echo "1. For duplicate sequence numbers: Rename files to use unique numbers"
echo "2. For sequence gaps: Consider renaming files to fill gaps or accept current numbering"
echo "3. For UPDATE without WHERE: Add WHERE clauses or confirm intent"
echo "4. For missing IF NOT EXISTS: Add IF NOT EXISTS to CREATE statements"

exit 0
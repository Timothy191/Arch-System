#!/usr/bin/env node

/**
 * @fileoverview Post-Task Token Usage Tracking Hook
 * Records token usage and context changes after task completion
 *
 * Usage: Called automatically by agent orchestration systems after task execution
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(ROOT, '.agents', 'memory_base');
const TOKEN_TRACKER_FILE = path.join(MEMORY_DIR, 'token-usage.json');

function loadTokenTracker() {
  if (fs.existsSync(TOKEN_TRACKER_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TOKEN_TRACKER_FILE, 'utf-8'));
    } catch (e) {
      console.warn('⚠️ Malformed token-tracker.json, starting fresh');
    }
  }
  return {
    lastUpdated: new Date().toISOString(),
    sessions: [],
    totalTokens: 0,
    totalSessions: 0,
  };
}

function saveTokenTracker(data) {
  fs.writeFileSync(TOKEN_TRACKER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function main() {
  const tracker = loadTokenTracker();
  const taskTag = process.env.TASK_TAG || 'unknown';
  const taskDuration = process.env.TASK_DURATION || '0';

  // Simulate token tracking (in production, this would come from the LLM API)
  const estimatedTokens = Math.floor(parseInt(taskDuration, 10) * 100); // Rough estimate

  tracker.totalSessions++;
  tracker.totalTokens += estimatedTokens;
  tracker.lastUpdated = new Date().toISOString();

  tracker.sessions.push({
    taskTag,
    duration: taskDuration,
    estimatedTokens,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 100 sessions
  if (tracker.sessions.length > 100) {
    tracker.sessions = tracker.sessions.slice(-100);
  }

  saveTokenTracker(tracker);

  console.log(`💰 [Post-Task Hook] Token usage tracked: ~${estimatedTokens} tokens`);
  console.log(`💰 [Post-Task Hook] Total lifetime tokens: ${tracker.totalTokens}`);
}

main();

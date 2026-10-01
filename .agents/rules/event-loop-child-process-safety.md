---
name: event-loop-child-process-safety
description: Enforces asynchronous child process execution when test scripts communicate with in-process mock HTTP servers hosted on the Node.js event loop.
paths:
  - '**/test/**'
  - '**/*.test.*'
  - '**/*.spec.*'
---

# Node.js Event Loop Child Process Deadlock Prevention

## 1. Core Mandate

Never use synchronous process execution (`child_process.spawnSync`, `execSync`) in tests that communicate with in-process HTTP or TCP mock servers running on the same Node.js event loop.

## 2. Root Cause

In Node.js, the single thread hosts both the mock HTTP server event listeners and the running test execution. Invoking `spawnSync()` completely blocks the event loop until the spawned child process exits. If the child process issues an HTTP request to the mock server, the request cannot be serviced because the thread is blocked, resulting in an indefinite deadlock or timeout failure.

## 3. Mandatory Pattern

1. Always spawn child test processes asynchronously using `child_process.spawn()` wrapped in a Promise.
2. Ensure mock HTTP servers unref their listening sockets upon teardown to prevent hanging the master test runner.

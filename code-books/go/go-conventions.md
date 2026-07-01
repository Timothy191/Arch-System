# Go (Golang) Systems Programming Conventions

## 1. Environment & Setup
The monorepo uses Go for systems-level scripting, tooling, and low-latency microservices.
* Go binaries and modules should be structured under the systems or tools directory (e.g. `ops/` or `apps/`).

---

## 2. Idiomatic Code Conventions
Follow the official Go Style Guide and Effective Go recommendations.

### Error Handling
* Avoid blanking out errors (`_ = func()`). Always inspect error return values.
* Wrap errors when returning them up the call stack to add context:
  ```go
  if err != nil {
      return fmt.Errorf("failed to retrieve shift log data: %w", err)
  }
  ```

### Concurrency Patterns
* Use channels for coordination and synchronization rather than shared memory locks (`sync.Mutex`) where possible.
* Always clean up resources and cancel contexts:
  ```go
  ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  defer cancel()
  ```

---

## 3. Best Practices in the Monorepo
* **Format**: Run `go fmt ./...` before staging.
* **Testing**: Write unit tests for all business logic (`go test ./...`).
* **Environment variables**: Use typed configurations to parse env secrets, and validate them on startup.

# Rust & Swarms-rs Patterns (Arch-System SSoT)

> **SYSTEMS INVARIANT**: Architectural patterns for high-throughput telemetry ingestion, Swarms-rs multi-agent concurrency, and Tokio actor topologies in `tools/swarms-orchestrator/`.

---

## 1. Multi-Agent Actor Topology (Swarms-rs)

The Rust orchestrator coordinates concurrent autonomous agents using `swarms-rs` and `tokio`. Workflows compose isolated agents into concurrent or sequential pipelines:

```
+-------------------------------------------------------------------------+
|                        Concurrent Workflow Builder                      |
+-------------------------------------------------------------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+-----------------------------------+   +----------------------------------+
|           Worker Agent            |   |          Reviewer Agent          |
|  - System Prompt: Worker domain   |   |  - System Prompt: Critic/Review  |
|  - LLM: Local Ollama DeepSeek     |   |  - LLM: Local Ollama DeepSeek    |
+-----------------------------------+   +----------------------------------+
         |                                                       |
         +---------------------------+---------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                   Aggregated Execution Result Channel                   |
+-------------------------------------------------------------------------+
```

### Production Workflow Construction

```rust
use dotenv::dotenv;
use swarms_rs::{
    agent::SwarmsAgentBuilder,
    llm::provider::openai::OpenAI,
    structs::concurrent_workflow::ConcurrentWorkflow,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let model_name = std::env::var("OLLAMA_MODEL")
        .unwrap_or_else(|_| "deepseek-v4.1-flash:cloud".to_string());
    let ollama_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:11434/v1".to_string());

    let llm = OpenAI::from_url(ollama_url, "ollama".to_string())
        .set_model(&model_name);

    // Instantiate Specialized Worker
    let worker = SwarmsAgentBuilder::new_with_model(llm.clone())
        .agent_name("TelemetryAnalyzer")
        .system_prompt("You analyze industrial mining telemetry for anomaly spikes.")
        .build();

    // Instantiate Independent Reviewer
    let reviewer = SwarmsAgentBuilder::new_with_model(llm.clone())
        .agent_name("SafetyAuditor")
        .system_prompt("You evaluate worker proposals against mining safety regulations.")
        .build();

    // Compose Concurrent Orchestration Pipeline
    let workflow = ConcurrentWorkflow::builder()
        .name("IndustrialShiftAudit")
        .description("Concurrent telemetry analysis and safety verification")
        .metadata_output_dir("./metadata")
        .add_agent(Box::new(worker))
        .add_agent(Box::new(reviewer))
        .build();

    let result = workflow.run("Analyze hourly drill vibrations and haul truck fuel consumption.").await?;
    println!("Workflow execution completed successfully: {:?}", result);

    Ok(())
}
```

---

## 2. High-Performance Telemetry Ingestion (Tokio MPSC)

For edge sensor streaming (e.g. 10,000 samples/sec Modbus SCADA), Rust utilizes bounded MPSC channels and backpressure buffering:

```rust
use tokio::sync::mpsc;
use std::time::Duration;

pub struct TelemetryPacket {
    pub machine_id: String,
    pub timestamp: i64,
    pub vibration_hz: f64,
    pub oil_temp_c: f64,
}

pub struct TelemetryIngestor {
    tx: mpsc::Sender<TelemetryPacket>,
}

impl TelemetryIngestor {
    pub fn new(buffer_size: usize) -> (Self, mpsc::Receiver<TelemetryPacket>) {
        let (tx, rx) = mpsc::channel(buffer_size);
        (Self { tx }, rx)
    }

    pub async fn ingest(&self, packet: TelemetryPacket) -> Result<(), mpsc::error::SendError<TelemetryPacket>> {
        // Enforces backpressure if downstream consumers fall behind
        self.tx.send(packet).await
    }
}
```

---

## 3. Circuit Breaker State Machine Pattern

A deterministic finite state machine implemented in Rust to isolate failing microservices or edge collectors:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,   // Healthy, requests pass through
    Open,     // Unhealthy, fail immediately
    HalfOpen, // Cooldown elapsed, testing trial request
}

pub struct CircuitBreaker {
    state: CircuitState,
    failure_count: u32,
    failure_threshold: u32,
    cooldown_duration: Duration,
    last_failure_time: Option<std::time::Instant>,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, cooldown: Duration) -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            failure_threshold,
            cooldown_duration: cooldown,
            last_failure_time: None,
        }
    }

    pub fn allow_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if let Some(last_fail) = self.last_failure_time {
                    if last_fail.elapsed() >= self.cooldown_duration {
                        self.state = CircuitState::HalfOpen;
                        return true;
                    }
                }
                false
            }
            CircuitState::HalfOpen => true,
        }
    }

    pub fn record_success(&mut self) {
        self.state = CircuitState::Closed;
        self.failure_count = 0;
        self.last_failure_time = None;
    }

    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure_time = Some(std::time::Instant::now());
        if self.failure_count >= self.failure_threshold {
            self.state = CircuitState::Open;
        }
    }
}
```

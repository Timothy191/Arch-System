use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Clone, Debug)]
pub struct OpenAI {
    base_url: String,
    api_key: String,
    model: String,
}

impl OpenAI {
    pub fn from_url(base_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
            model: "deepseek-v4.1-flash:cloud".to_string(),
        }
    }

    #[must_use]
    pub fn set_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    pub fn resolve_host_port(&self) -> &str {
        let url = self.base_url.trim_end_matches('/');
        url.strip_prefix("http://")
            .or_else(|| url.strip_prefix("https://"))
            .unwrap_or("127.0.0.1:11434/v1")
            .split('/')
            .next()
            .unwrap_or("127.0.0.1:11434")
    }

    pub async fn chat(
        &self,
        system_prompt: &str,
        task: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let host_port = self.resolve_host_port();

        let body = serde_json::to_string(&json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": task }
            ]
        }))?;

        let mut stream = TcpStream::connect(host_port).await?;
        let req = format!(
            "POST /v1/chat/completions HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            host_port,
            self.api_key,
            body.len(),
            body
        );
        stream.write_all(req.as_bytes()).await?;
        let mut response = String::new();
        stream.read_to_string(&mut response).await?;
        Ok(response)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_name: String,
    pub output: String,
}

#[derive(Clone, Debug)]
pub struct SwarmsAgent {
    name: String,
    system_prompt: String,
    model: OpenAI,
}

impl SwarmsAgent {
    pub async fn execute(
        &self,
        task: &str,
    ) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
        let output = self.model.chat(&self.system_prompt, task).await?;
        Ok(AgentResult {
            agent_name: self.name.clone(),
            output,
        })
    }
}

pub struct SwarmsAgentBuilder {
    model: OpenAI,
    name: String,
    system_prompt: String,
}

impl SwarmsAgentBuilder {
    pub fn new_with_model(model: OpenAI) -> Self {
        Self {
            model,
            name: "Agent".to_string(),
            system_prompt: String::new(),
        }
    }

    #[must_use]
    pub fn agent_name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    #[must_use]
    pub fn system_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.system_prompt = prompt.into();
        self
    }

    #[must_use]
    pub fn build(self) -> SwarmsAgent {
        SwarmsAgent {
            name: self.name,
            system_prompt: self.system_prompt,
            model: self.model,
        }
    }
}

pub struct ConcurrentWorkflow {
    name: String,
    description: String,
    metadata_output_dir: PathBuf,
    agents: Vec<SwarmsAgent>,
}

pub struct ConcurrentWorkflowBuilder {
    name: String,
    description: String,
    metadata_output_dir: PathBuf,
    agents: Vec<SwarmsAgent>,
}

impl ConcurrentWorkflow {
    #[must_use]
    pub fn builder() -> ConcurrentWorkflowBuilder {
        ConcurrentWorkflowBuilder {
            name: "Workflow".to_string(),
            description: String::new(),
            metadata_output_dir: PathBuf::from("./metadata"),
            agents: Vec::new(),
        }
    }

    pub async fn run(
        &self,
        task: &str,
    ) -> Result<Vec<AgentResult>, Box<dyn std::error::Error + Send + Sync>> {
        let mut handles = Vec::with_capacity(self.agents.len());
        for agent in &self.agents {
            let runner = agent.clone();
            let task_str = task.to_string();
            handles.push(tokio::spawn(async move { runner.execute(&task_str).await }));
        }

        let mut results = Vec::with_capacity(handles.len());
        for handle in handles {
            let res = handle.await??;
            results.push(res);
        }

        let out_dir: &Path = &self.metadata_output_dir;
        tokio::fs::create_dir_all(out_dir).await?;
        let metadata = json!({
            "workflow": self.name,
            "description": self.description,
            "results": results,
        });
        tokio::fs::write(
            out_dir.join("workflow-result.json"),
            serde_json::to_string_pretty(&metadata)?,
        )
        .await?;

        Ok(results)
    }
}

impl ConcurrentWorkflowBuilder {
    #[must_use]
    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    #[must_use]
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = description.into();
        self
    }

    #[must_use]
    pub fn metadata_output_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.metadata_output_dir = dir.into();
        self
    }

    #[must_use]
    pub fn add_agent(mut self, agent: SwarmsAgent) -> Self {
        self.agents.push(agent);
        self
    }

    #[must_use]
    pub fn build(self) -> ConcurrentWorkflow {
        ConcurrentWorkflow {
            name: self.name,
            description: self.description,
            metadata_output_dir: self.metadata_output_dir,
            agents: self.agents,
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenv().ok();

    let model_name =
        std::env::var("OLLAMA_MODEL").unwrap_or_else(|_| "deepseek-v4.1-flash:cloud".to_string());
    let ollama_url =
        std::env::var("OLLAMA_BASE_URL").unwrap_or_else(|_| "http://127.0.0.1:11434/v1".to_string());

    println!(
        "Initializing Swarms Orchestrator with Ollama model: {}",
        model_name
    );

    let llm = OpenAI::from_url(ollama_url, "ollama").set_model(&model_name);

    let agent1 = SwarmsAgentBuilder::new_with_model(llm.clone())
        .agent_name("Worker")
        .system_prompt("You are a helpful worker.")
        .build();

    let agent2 = SwarmsAgentBuilder::new_with_model(llm)
        .agent_name("Reviewer")
        .system_prompt("You review work.")
        .build();

    let workflow = ConcurrentWorkflow::builder()
        .name("MainWorkflow")
        .description("Run concurrently")
        .metadata_output_dir("./metadata")
        .add_agent(agent1)
        .add_agent(agent2)
        .build();

    let _result = workflow.run("Perform initialization checks.").await?;

    println!("Workflow result received.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_host_port_from_http_and_https_urls() {
        let client_http = OpenAI::from_url("http://127.0.0.1:11434/v1/", "key");
        assert_eq!(client_http.resolve_host_port(), "127.0.0.1:11434");

        let client_https = OpenAI::from_url("https://api.example.com/v1/chat", "key");
        assert_eq!(client_https.resolve_host_port(), "api.example.com");
    }

    #[test]
    fn constructs_agents_and_workflow_without_vec_box() {
        let llm = OpenAI::from_url("http://localhost:11434/v1", "ollama").set_model("qwen2.5:3b");
        let worker = SwarmsAgentBuilder::new_with_model(llm)
            .agent_name("PitTelemetryWorker")
            .system_prompt("Monitor haulage cycles.")
            .build();

        let workflow = ConcurrentWorkflow::builder()
            .name("TelemetryCheck")
            .description("Verify pit telemetry")
            .metadata_output_dir("./tmp-meta")
            .add_agent(worker)
            .build();

        assert_eq!(workflow.agents.len(), 1);
        assert_eq!(workflow.name, "TelemetryCheck");
    }
}

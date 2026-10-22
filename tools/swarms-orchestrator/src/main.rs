use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Clone, Debug)]
pub struct OpenAI {
    base_url: String,
    api_key: String,
    model: String,
}

impl OpenAI {
    pub fn from_url(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            model: "deepseek-v4.1-flash:cloud".to_string(),
        }
    }

    pub fn set_model(mut self, model: &str) -> Self {
        self.model = model.to_string();
        self
    }

    pub async fn chat(&self, system_prompt: &str, task: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let url = self.base_url.trim_end_matches('/');
        let host_port = url
            .strip_prefix("http://")
            .or_else(|| url.strip_prefix("https://"))
            .unwrap_or("127.0.0.1:11434/v1")
            .split('/')
            .next()
            .unwrap_or("127.0.0.1:11434");

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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentResult {
    pub agent_name: String,
    pub output: String,
}

pub struct SwarmsAgent {
    name: String,
    system_prompt: String,
    model: OpenAI,
}

impl SwarmsAgent {
    pub async fn execute(&self, task: &str) -> Result<AgentResult, Box<dyn std::error::Error + Send + Sync>> {
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

    pub fn agent_name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    pub fn system_prompt(mut self, prompt: &str) -> Self {
        self.system_prompt = prompt.to_string();
        self
    }

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
    metadata_output_dir: String,
    agents: Vec<Box<SwarmsAgent>>,
}

pub struct ConcurrentWorkflowBuilder {
    name: String,
    description: String,
    metadata_output_dir: String,
    agents: Vec<Box<SwarmsAgent>>,
}

impl ConcurrentWorkflow {
    pub fn builder() -> ConcurrentWorkflowBuilder {
        ConcurrentWorkflowBuilder {
            name: "Workflow".to_string(),
            description: String::new(),
            metadata_output_dir: "./metadata".to_string(),
            agents: Vec::new(),
        }
    }

    pub async fn run(&self, task: &str) -> Result<Vec<AgentResult>, Box<dyn std::error::Error + Send + Sync>> {
        let mut handles = Vec::with_capacity(self.agents.len());
        for agent in &self.agents {
            let model = agent.model.clone();
            let name = agent.name.clone();
            let prompt = agent.system_prompt.clone();
            let task_str = task.to_string();
            handles.push(tokio::spawn(async move {
                let runner = SwarmsAgent {
                    name,
                    system_prompt: prompt,
                    model,
                };
                runner.execute(&task_str).await
            }));
        }

        let mut results = Vec::with_capacity(handles.len());
        for handle in handles {
            let res = handle.await??;
            results.push(res);
        }

        let out_dir = Path::new(&self.metadata_output_dir);
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
    pub fn name(mut self, name: &str) -> Self {
        self.name = name.to_string();
        self
    }

    pub fn description(mut self, description: &str) -> Self {
        self.description = description.to_string();
        self
    }

    pub fn metadata_output_dir(mut self, dir: &str) -> Self {
        self.metadata_output_dir = dir.to_string();
        self
    }

    pub fn add_agent(mut self, agent: Box<SwarmsAgent>) -> Self {
        self.agents.push(agent);
        self
    }

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

    let model_name = std::env::var("OLLAMA_MODEL")
        .unwrap_or_else(|_| "deepseek-v4.1-flash:cloud".to_string());
    let ollama_url = std::env::var("OLLAMA_BASE_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:11434/v1".to_string());

    println!("Initializing Swarms Orchestrator with Ollama model: {}", model_name);

    let llm = OpenAI::from_url(ollama_url, "ollama".to_string()).set_model(&model_name);

    let agent1 = SwarmsAgentBuilder::new_with_model(llm.clone())
        .agent_name("Worker")
        .system_prompt("You are a helpful worker.")
        .build();

    let agent2 = SwarmsAgentBuilder::new_with_model(llm.clone())
        .agent_name("Reviewer")
        .system_prompt("You review work.")
        .build();

    let workflow = ConcurrentWorkflow::builder()
        .name("MainWorkflow")
        .description("Run concurrently")
        .metadata_output_dir("./metadata")
        .add_agent(Box::new(agent1))
        .add_agent(Box::new(agent2))
        .build();

    let _result = workflow.run("Perform initialization checks.").await?;

    println!("Workflow result received.");

    Ok(())
}

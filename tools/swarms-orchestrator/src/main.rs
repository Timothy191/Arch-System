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

    println!("Initializing Swarms Orchestrator with Ollama model: {}", model_name);

    let llm = OpenAI::from_url(
        ollama_url,
        "ollama".to_string(),
    ).set_model(&model_name);

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

use dotenv::dotenv;
use swarms_rs::{
    agent::SwarmsAgentBuilder,
    llm::provider::openai::OpenAI,
    structs::concurrent_workflow::ConcurrentWorkflow,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let llm = OpenAI::from_url(
        "http://127.0.0.1:11434/v1",
        "ollama",
    ).set_model("qwen2.5:3b");

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

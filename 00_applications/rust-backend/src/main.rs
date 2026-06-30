use axum::{
    routing::get,
    Router,
    middleware,
};
use tokio::net::TcpListener;
use sqlx::postgres::PgPoolOptions;
use std::env;

mod auth;
use auth::{AppState, auth_middleware};

#[tokio::main]
async fn main() {
    // initialize tracing
    tracing_subscriber::fmt::init();
    
    // Load environment variables (optional, since this might be run via docker)
    let _ = dotenvy::dotenv();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = env::var("SUPABASE_JWT_SECRET").expect("SUPABASE_JWT_SECRET must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let state = AppState {
        db: pool,
        jwt_secret,
    };

    // build our application with a route
    let app = Router::new()
        .route("/", get(|| async { "Arch-Systems Rust Backend API" }))
        .route("/api/protected", get(|| async { "Protected Resource" }))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    let listener = TcpListener::bind(&addr).await.unwrap();
    println!("Listening on {}", addr);
    
    axum::serve(listener, app).await.unwrap();
}

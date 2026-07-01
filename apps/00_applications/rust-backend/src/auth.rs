use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub email: String,
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&["authenticated"]);

    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    ) {
        Ok(data) => data,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    // Verify employee exists (Authorization Truth)
    let employee_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM employees WHERE id = $1 AND is_active = true"
    )
    .bind(&token_data.claims.sub)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if employee_exists.is_none() {
        return Err(StatusCode::FORBIDDEN);
    }

    req.extensions_mut().insert(token_data.claims);
    
    Ok(next.run(req).await)
}

pub async fn set_rls_transaction(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
) -> Result<(), sqlx::Error> {
    let claims_json = serde_json::to_string(claims).unwrap();
    sqlx::query(&format!(
        "SELECT set_config('request.jwt.claims', '{}', true)",
        claims_json
    ))
    .execute(tx.as_mut())
    .await?;
    Ok(())
}

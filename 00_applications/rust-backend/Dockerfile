FROM rust:1.75-slim as builder

WORKDIR /usr/src/app
COPY . .

# Build the application
RUN cargo build --release

# Production image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates tzdata && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/rust-backend /usr/local/bin/rust-backend

ENV PORT=8080
EXPOSE 8080

CMD ["rust-backend"]

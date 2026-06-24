# Disaster Recovery (DR) Plan

## 1. Objectives

- **RTO (Recovery Time Objective):** 4 hours for critical operations (Portal, DB, Auth). 12 hours for secondary services.
- **RPO (Recovery Point Objective):** 15 minutes for PostgreSQL data (WAL archiving). 1 hour for object storage (Supabase Storage).

## 2. Backup Strategy

- **PostgreSQL (Supabase):**
  - Automated continuous WAL archiving to remote S3 bucket (Multi-AZ).
  - Daily full logical backups.
- **Redis:**
  - AOF (Append Only File) enabled with daily snapshots to remote S3.
- **Storage:**
  - Object storage (S3/GCS) configured with cross-region replication for High Availability.

## 3. High Availability (HA)

- **Kubernetes:**
  - Multi-AZ node groups deployed. Pods are spread across availability zones using `topologySpreadConstraints`.
- **Database:**
  - Primary-replica PostgreSQL architecture with automated failover (Patroni or Supabase HA).

## 4. Restore Procedure

1. Verify loss of primary infrastructure.
2. Spin up DR environment via Terraform (`infra/terraform`).
3. Restore DB from latest full backup + WAL replay.
4. Update DNS/load balancer to point to DR cluster.
5. Validate system integrity via smoke tests (`pnpm test:e2e:smoke`).

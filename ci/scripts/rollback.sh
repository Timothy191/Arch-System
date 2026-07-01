#!/bin/bash
set -e

# Rollback AMCA deployment
echo "Initiating rollback of AMCA services..."
kubectl rollout undo deployment/cache-agent
kubectl rollout undo deployment/policy-engine
echo "Rollback successfully issued to cluster."

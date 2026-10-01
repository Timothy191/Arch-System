# /deploy Command

Execute deployment preflight checks and review active Vercel deployments:

```bash
# 1. Run Vercel preflight verification
node tools/scripts/vercel-preflight.cjs

# 2. Check active Vercel deployments
vercel ls
```

### Invariants:
1. Always prefer pushing cleanly to GitHub `main` to let Vercel's automated CI/CD pipeline build and deploy natively.
2. Verify that both standalone deployments report `● Ready`:
   - `arch-system` (Portal UI monorepo)
   - `arch-system-nest-proxy` (NestJS background worker)
3. If an error is detected, run `vercel inspect <deployment-url>` and `vercel logs <deployment-url>` to autonomously diagnose and resolve.

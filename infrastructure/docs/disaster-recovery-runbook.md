# Disaster Recovery Runbook — Trading Platform

## Overview

| Metric | Target | Notes |
|--------|--------|-------|
| **RTO** (Recovery Time Objective) | **1 hour** | Time to restore full service |
| **RPO** (Recovery Point Objective) | **24 hours** | Maximum data loss window |
| Backup Frequency | Daily at 02:00 UTC | Automated via K8s CronJob |
| Backup Retention (local) | 30 days | Managed by backup script |
| Backup Retention (S3) | 90 days | Managed by S3 lifecycle policy |

---

## Backup Architecture

```
┌──────────────┐    pg_dump    ┌──────────────┐    aws s3 cp    ┌──────────┐
│  PostgreSQL  │ ───────────►  │  Local Disk   │ ──────────────► │   S3     │
│  (Primary)   │   Compressed  │  /backups/    │   STANDARD_IA  │  Bucket  │
└──────────────┘               └──────────────┘                 └──────────┘
                                30-day retention               90-day retention
```

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | PagerDuty rotation | Auto-escalation after 15min |
| Database Lead | [TBD - Add name/contact] | Manual escalation |
| DevOps Lead | [TBD - Add name/contact] | Manual escalation |
| VP of Engineering | [TBD - Add name/contact] | Final escalation |

---

## Recovery Procedures

### Scenario 1: Application Pod Failures

**Symptoms**: Health check failures, pod restart loops, 5xx errors  
**Severity**: Medium  
**Estimated Recovery**: 5–15 minutes

1. Check pod status:
   ```bash
   kubectl get pods -n production -l app=trading-platform-api
   kubectl describe pod <pod-name> -n production
   kubectl logs <pod-name> -n production --tail=100
   ```

2. If pods are crash-looping, check recent deployments:
   ```bash
   kubectl rollout history deployment/trading-platform-api -n production
   ```

3. Rollback to last known good version:
   ```bash
   kubectl rollout undo deployment/trading-platform-api -n production
   kubectl rollout status deployment/trading-platform-api -n production
   ```

4. Or use the GitHub Actions rollback workflow:
   - Go to **Actions → Rollback Deployment → Run workflow**
   - Enter the commit SHA of the last known working image

---

### Scenario 2: Database Connection Issues

**Symptoms**: Readiness probe failures, "connection refused" errors  
**Severity**: High  
**Estimated Recovery**: 15–30 minutes

1. Check database pod/service:
   ```bash
   kubectl get pods -n production -l app=postgres
   kubectl logs <postgres-pod> -n production --tail=50
   ```

2. Verify connection from API pod:
   ```bash
   kubectl exec -it <api-pod> -n production -- sh
   # Inside pod:
   wget -qO- http://localhost:3000/ready
   ```

3. Check for connection pool exhaustion:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';
   ```

4. Terminate idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
   AND query_start < NOW() - INTERVAL '10 minutes';
   ```

---

### Scenario 3: Full Database Recovery

**Symptoms**: Data corruption, accidental deletion, complete DB failure  
**Severity**: Critical  
**Estimated Recovery**: 30–60 minutes

1. **Identify the latest backup**:
   ```bash
   aws s3 ls s3://trading-platform-backups/postgres/ --recursive | sort -k1,2 | tail -5
   ```

2. **Scale down API to prevent writes**:
   ```bash
   kubectl scale deployment/trading-platform-api --replicas=0 -n production
   ```

3. **Restore from backup**:
   ```bash
   ./infrastructure/scripts/restore-backup.sh \
     s3://trading-platform-backups/postgres/<DATE>/backup-<TIMESTAMP>.sql.gz \
     trading_platform
   ```

4. **Run Prisma migrations** (if schema has changed since backup):
   ```bash
   npx prisma migrate deploy
   ```

5. **Scale API back up**:
   ```bash
   kubectl scale deployment/trading-platform-api --replicas=3 -n production
   ```

6. **Verify health**:
   ```bash
   kubectl rollout status deployment/trading-platform-api -n production
   curl -s https://api.trading-platform.dev/health | jq .
   curl -s https://api.trading-platform.dev/ready | jq .
   ```

---

### Scenario 4: Complete Cluster Recovery

**Symptoms**: Entire K8s cluster failure  
**Severity**: Critical  
**Estimated Recovery**: 1–2 hours

1. Provision new cluster (Terraform/cloud console)
2. Install NGINX Ingress Controller:
   ```bash
   helm install ingress-nginx ingress-nginx/ingress-nginx
   ```
3. Install cert-manager:
   ```bash
   helm install cert-manager jetstack/cert-manager --set installCRDs=true
   ```
4. Apply namespace and resource quotas:
   ```bash
   kubectl apply -f infrastructure/k8s/namespace.yaml
   ```
5. Create secrets:
   ```bash
   kubectl create secret generic trading-platform-secrets \
     --namespace=production \
     --from-literal=DATABASE_URL='...' \
     --from-literal=JWT_SECRET='...'
   ```
6. Deploy application via Helm:
   ```bash
   helm install trading-platform infrastructure/helm/trading-platform \
     -f infrastructure/helm/trading-platform/values.yaml \
     --namespace production
   ```
7. Restore database (see Scenario 3)
8. Verify DNS and TLS

---

## Backup Testing Schedule

| Test | Frequency | Owner | Last Tested |
|------|-----------|-------|-------------|
| Restore to staging env | Monthly | DevOps | [TBD] |
| Full DR simulation | Quarterly | Engineering team | [TBD] |
| Backup integrity check | Daily (automated) | CronJob | Automated |
| S3 retrieval test | Monthly | DevOps | [TBD] |

### Monthly Test Procedure
1. Download latest backup from S3
2. Restore to a temporary database
3. Run smoke tests against restored data
4. Verify row counts match expected values
5. Document results and any issues

---

## Post-Incident Checklist

- [ ] Root cause identified
- [ ] Timeline documented
- [ ] Impact scope assessed (users affected, data loss)
- [ ] Fix deployed and verified
- [ ] Monitoring gaps addressed
- [ ] Runbook updated with lessons learned
- [ ] Post-mortem shared with team

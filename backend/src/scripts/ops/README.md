# Scheduled Jobs (Ops Checklist)

## Timezone

- Job date logic uses `ALERT_JOB_TIMEZONE` (default: `Asia/Bangkok`).
- Set in runtime environment:
  - `ALERT_JOB_TIMEZONE=Asia/Bangkok`

## Run all jobs

```bash
npm run jobs:run
```

## Run specific jobs

```bash
npm run jobs:run leave-report
npm run jobs:run retirement-cut
npm run jobs:run movement-cut
```

`movement-cut` is intentionally on-demand as a safety-net, because movement cutoff is already applied immediately in sync flow.

## Cron example

```cron
# every 15 minutes
*/15 * * * * cd /path/to/phts-project/backend && ALERT_JOB_TIMEZONE=Asia/Bangkok npm run jobs:run >> /var/log/phts-jobs.log 2>&1
```

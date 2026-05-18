# Phase 9 Migration and Cutover Runbook

## Order

1. Complete Area 10 ticket lifecycle rollout.
2. Run `pnpm migration:dry-run -- --source <url> --target <url>` against a Neon branch.
3. Review the generated JSON and Markdown reports in `migration-reports/`.
4. Run `pnpm migration:validate -- --source <url> --target <url>` and resolve all validation errors.
5. Schedule the production cutover window.

## Cutover

1. Freeze writes in the source system.
2. Run the final incremental sync with `pnpm migration:run -- --source <url> --target <url> --since <timestamp>`.
3. Run validation and spot-check migrated samples.
4. Confirm merged, reopened, closed, and waiting-on-customer tickets map correctly.
5. Confirm audit rows retain actor, org, action, timestamp, and migration metadata.
6. Swap `DATABASE_URL` to the target database.
7. Smoke test login, ticket create, ticket reply, and KB article view.
8. Unfreeze writes.

## Rollback

1. Re-freeze writes.
2. Restore the previous `DATABASE_URL`.
3. Restart the app.
4. Re-run smoke tests against the source database.
5. Document the failed validation or smoke-test result before retrying cutover.

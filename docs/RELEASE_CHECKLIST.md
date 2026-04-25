# Release Checklist — LifeOS AI v1.0.0

Run top to bottom. Anything unchecked blocks the release tag.

## 0. Branch hygiene

- [ ] All open PRs for v1.0.0 merged, branch `master` clean.
- [ ] `CHANGELOG.md` entry for `1.0.0` matches the diff range you're shipping.
- [ ] `git status` clean in both `apps/api` and `apps/mobile`.

## 1. Build + tests

- [ ] `npm ci` (clean install)
- [ ] `npm run typecheck` — green for `@planner/shared`, `@lifeos/api`, `@lifeos/mobile`
- [ ] `npm test` — 96 backend tests pass; mobile / shared report "no tests yet"
- [ ] `npm run build` — produces `packages/shared/dist` and `apps/api/dist`
- [ ] `bash scripts/check.sh` — repo-wide check passes

## 2. Backend env (production VPS)

- [ ] `.env.production` exists, mode 600, owned by deploy user; **never committed**
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are independent 48-byte base64 values (`openssl rand -base64 48`)
- [ ] `DATABASE_URL` points at the production Postgres (TLS where applicable)
- [ ] `CORS_ORIGIN` is a comma-separated list of concrete HTTPS origins; **never `*`** — env validation refuses to start otherwise
- [ ] `AI_PROVIDER=anthropic` or `openai`; `AI_API_KEY` set; `AI_MODEL` matches contract (default `claude-opus-4-7`)
- [ ] `DEFAULT_LOCALE=vi`, `SUPPORTED_LOCALES=vi,en`
- [ ] `THROTTLE_TTL=60`, `THROTTLE_LIMIT=120` reviewed for the expected user base

## 3. Backend deploy

- [ ] Pull image / rebuild: `docker compose -f docker-compose.production.yml --env-file .env.production build`
- [ ] Migrate DB: `bash scripts/migrate.sh` (or `npm run db:migrate:deploy` inside the container)
- [ ] Bring up stack: `docker compose -f docker-compose.production.yml --env-file .env.production up -d`
- [ ] `curl https://api.<domain>/api/health` returns `{ status: "ok" }`
- [ ] `curl https://api.<domain>/api/health/ready` returns `{ status: "ready", database: "up" }`
- [ ] Reverse proxy (Nginx / Cloudflare Tunnel) terminates TLS and forwards to `127.0.0.1:3000`
- [ ] Postgres + Redis ports bound to `127.0.0.1` only (verify with `ss -ltn`)
- [ ] First DB backup taken: `bash scripts/backup-db.sh`
- [ ] Restore drill: `bash scripts/restore-db.sh <dump>` against a staging instance

## 4. Mobile build env

- [ ] Replace placeholder bundle id `com.yourname.lifeosai` in `apps/mobile/app.config.ts` with the real value (see iOS / Android sections below)
- [ ] `apps/mobile/.env.production` (or EAS profile env) sets `EXPO_PUBLIC_APP_ENV=production` and `EXPO_PUBLIC_API_BASE_URL=https://api.<domain>/api`
- [ ] `app.config.ts` will throw if the production URL is non-HTTPS or contains `localhost|127.0.0.1|10.0.2.2` — verify by attempting a build with a bad URL

## 5. iOS

- [ ] Apple Developer account active; bundle id `com.<yourorg>.lifeosai` registered in App Store Connect
- [ ] App icon `apps/mobile/assets/icon.png` is 1024×1024 PNG, no alpha channel
- [ ] `apps/mobile/eas.json` `production.ios.autoIncrement: "buildNumber"` is in effect
- [ ] `app.config.ts` `ios.infoPlist.NSUserNotificationsUsageDescription` reflects the real product copy
- [ ] `eas build --platform ios --profile production` succeeds
- [ ] Submit: `eas submit --platform ios --profile production`
- [ ] TestFlight smoke (matrix in `TESTING_QA.md`) on a physical device

## 6. Android

- [ ] Google Play Console account; package `com.<yourorg>.lifeosai` registered
- [ ] Release keystore created (NOT `debug.keystore`) and uploaded to EAS or stored in CI secrets
- [ ] Adaptive icon `apps/mobile/assets/adaptive-icon.png` correct
- [ ] `apps/mobile/eas.json` `production.android.buildType: "app-bundle"` (AAB) and `autoIncrement: true`
- [ ] `eas build --platform android --profile production` succeeds — output is an AAB, not APK
- [ ] Internal Testing track upload via `eas submit --platform android` or manual Play Console upload
- [ ] Internal-testing smoke (matrix in `TESTING_QA.md`) on a physical device

## 7. Localisation

- [ ] vi / en bundle parity verified: 833 keys both sides (`apps/mobile/src/i18n/locales/{vi,en}.json`)
- [ ] Switching language in Settings updates UI immediately, persists across restart, AI replies in new language
- [ ] No raw English / Vietnamese literals in primary auth/onboarding flow (see §1 of SECURITY_AUDIT_REPORT.md)

## 8. Observability + ops

- [ ] Container logs: `docker compose logs --tail 200 api` clean of unexpected stack traces
- [ ] Disk usage on Postgres volume monitored
- [ ] Backup cron enabled (recommended: `scripts/backup-db.sh` daily, retain 7)
- [ ] Runbook `docs/PRODUCTION_RUNBOOK.md` reviewed by on-call

## 9. Comms

- [ ] Release notes drafted from `CHANGELOG.md`
- [ ] Support inbox / Discord on standby for first 48 h

## 10. Tag + announce

- [ ] `git tag v1.0.0 && git push --tags`
- [ ] EAS submission status visible in App Store Connect / Play Console
- [ ] Announcement post live

---

**If any item fails, do not ship.** Treat the failure as a blocker, fix in a hotfix branch, run `npm run typecheck && npm test` again, then re-enter this checklist at §3.

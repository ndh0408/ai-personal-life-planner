# Round 19 — Load Testing Harness

**Date:** 2026-04-25
**Goal:** ship a complete load-testing harness (8 k6 scenarios + seed +
cleanup + docs) so operators can measure LifeOS AI's actual capacity
against the round-12+17+18 infra. Round 19 is **scaffolding**, not
measurement — see "Honest scope" below.

## Honest scope

This round delivers:
- k6 scripts (8) covering smoke + auth + dashboard + finance + AI quota +
  notification queue + assistant monitor + 2-hour soak.
- Synthetic-user seed + cleanup with hard production guards.
- Local + staging config files.
- LOAD_TESTING.md operator playbook.
- PERFORMANCE_RESULTS.md result-capture template.
- Round-19 audit-doc patch (no measured numbers — explicit).

This round does NOT deliver:
- Measured RPS / latency / capacity numbers. The harness must run on a
  prod-like staging cluster the dev box cannot host. Operator runs it +
  fills `PERFORMANCE_RESULTS.md`.
- A 2-hour soak result. The script exists; the operator schedules it.
- Updated capacity claims in the audit doc beyond "harness shipped".

## Files added

```
tests/load/
├── lib/
│   └── helpers.js                  # shared k6 helpers (login, authed*, etc.)
├── config/
│   ├── local.json                  # local-dev profile
│   └── staging.example.json        # staging template (copy + edit, do NOT commit)
├── smoke.js                        # 1-VU walk-through
├── auth-load.js                    # success path + lockout + rate limit
├── dashboard-load.js               # ramp 30→80 VUs read-heavy
├── finance-concurrency.js          # races + idempotency dedupe
├── ai-quota-load.js                # quota cap with mock provider
├── notification-queue-load.js      # arrival-rate burst
├── assistant-monitoring-load.js    # daily monitor sweep
└── soak-2h.js                      # 5-scenario mixed traffic, 2h

scripts/
├── seed-load-test.ts               # provision N synthetic users
└── cleanup-load-test.ts            # tear down by prefix+domain match

docs/
├── LOAD_TESTING.md                 # operator playbook
├── PERFORMANCE_RESULTS.md          # capture template (TBD numbers)
└── ROUND_19_LOAD_TEST_COMPLETION.md
```

## Safeguards (every script)

- `loadConfig()` REFUSES URLs containing `/prod|production|live/i`. An
  operator can't accidentally hammer production by typo.
- `seed-load-test.ts` REFUSES `NODE_ENV=production` unless
  `ALLOW_LOAD_SEED_IN_PRODUCTION=true` is also set.
- `cleanup-load-test.ts` REFUSES without literal
  `--confirm I-AM-IN-STAGING`. Match by **both** prefix AND domain so a
  typo on either narrows, never widens, the blast radius.
- Scripts assume API runs with `AI_PROVIDER=mock` + `EXPO_PUSH_DRY_RUN=true`
  + `EMAIL_PROVIDER=console`. No real provider gets a load spike.

## Quality gate

- `npm run typecheck` (api + mobile + shared) — clean
- `npm test` (api) — **46 suites / 246 tests pass** (zero regression vs
  round 18; round 19 added no jest specs — load tests live outside jest)
- `node --check` on every k6 script — clean
- `tsc --noEmit` on `seed-load-test.ts` + `cleanup-load-test.ts` — clean
- `bash -n` on shell scripts — N/A (round 19 added no shell scripts)
- i18n parity — N/A (no new mobile keys)

## Capacity estimate

**Not produced in this round.** The audit doc gets a Round-19 patch
saying "harness shipped; capacity claims unchanged from round 18 until
the operator runs the scripts". The PERFORMANCE_RESULTS.md template lays
out the table the operator fills in.

## Round-20 backlog

After the operator's first staging run:
- Update `PERFORMANCE_RESULTS.md` with actual numbers
- Update audit doc's readiness verdict per measured tier
- File any threshold breaches as bugs (don't disable thresholds)
- Add chaos tests (kill API mid-load, partition Redis)
- Add `k6 cloud` integration for region-realistic latency tests
- Add a synthetic-traffic harness for the mobile app (Detox + k6 hybrid)

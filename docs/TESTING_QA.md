# Testing & QA — LifeOS AI v1.0.0

This is the **manual smoke + acceptance plan** for v1.0.0. The automated suite (`npm test`) covers 96 backend unit tests across 22 service files; the matrix below is what a human tester runs against a built mobile binary pointing at a staging API.

## 1. Pre-flight (one-time per release candidate)

```bash
# Repo root
nvm use                      # node 20 (per .nvmrc)
npm ci
npm run build                # build shared + api
npm run typecheck            # all workspaces
npm test                     # 96 tests must pass
bash scripts/check.sh        # repo-wide sanity (lint/typecheck/test)
```

API container:
```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/health/ready    # checks DB
```

Mobile (against staging API):
```bash
cd apps/mobile
EXPO_PUBLIC_APP_ENV=staging EXPO_PUBLIC_API_BASE_URL=https://staging.api.example.com/api npm run start
```

## 2. Smoke matrix

Run on iOS simulator + one Android device. **vi** and **en** locales each.

| # | Flow | Backend route(s) | Mobile screen | Pass criteria |
|---|------|------------------|---------------|---------------|
| 1 | Register | `POST /api/auth/register` | `RegisterScreen` | Account created; tokens stored in SecureStore; lands on Onboarding; `timezone` matches device. |
| 2 | Login | `POST /api/auth/login` | `LoginScreen` | Wrong password → "Invalid email or password" (translated). 11th attempt in 60 s → rate-limit error (translated). |
| 3 | Logout | `POST /api/auth/logout` | `ProfileScreen → Settings` | Confirm dialog appears in active locale; tokens cleared; lands on Login. |
| 4 | Onboarding | `PUT /api/profile`, `POST /api/wallets`, `POST /api/goals` | `Onboarding{Welcome,Profile,Schedule,Finance,Goal}` | Skip + complete both work; reload app → user lands on Today, not Onboarding. |
| 5 | Choose language | client-side + `Accept-Language` header | `LanguageSettingsScreen` | Switching vi↔en updates the entire app immediately, restart preserves selection, AI reply uses new language. |
| 6 | Dashboard | `GET /api/dashboard/summary` | `DashboardScreen` | Loads with 4 score cards + today's plan summary. |
| 7 | Today planner | `GET /api/schedules?date=YYYY-MM-DD` | `TodayScreen` | Renders today's items as timeline; "no plan" empty state visible if no schedule. |
| 8 | AI generate schedule | `POST /api/ai/generate-schedule` | `TodayScreen → Generate` | Shows loading state; inserts items; surfaces fallback banner if AI failed. |
| 9 | AI reschedule | `POST /api/ai/reschedule` then `POST /api/ai/apply-reschedule` | `TodayScreen → Reschedule` | Preview displays delta; apply confirms with translated dialog. |
| 10 | Task CRUD | `POST/PATCH/DELETE /api/tasks/:id` | `TasksScreen, CreateTaskScreen` | Optimistic add + rollback on failure; status check from list. |
| 11 | Habit check-in | `POST /api/habits/:id/log` | `HabitsScreen` | Tap streak chip → counts +1; offline → queued + banner. |
| 12 | Meal AI suggest | `POST /api/ai/suggest-meals` | `MealsScreen` | 3-option grid renders; "fallback" badge if AI failed. |
| 13 | Sleep / mood / health check-in | `POST /api/sleep-logs`, `POST /api/mood-logs`, `POST /api/health-metrics` | `SleepMoodCheckinScreen, HealthScreen` | Sleep window crossing midnight is correct; mood emoji round-trips. |
| 14 | Finance — wallet CRUD | `POST/PATCH/DELETE /api/wallets/:id` | `FinanceScreen, AddWalletScreen` | Wallet appears in selector for Add Expense. |
| 15 | Add expense | `POST /api/expenses` | `AddExpenseScreen` | Wallet balance decrements; offline → queued. |
| 16 | Add income | `POST /api/incomes` | `AddIncomeScreen` | Wallet balance increments. |
| 17 | Budget | `POST /api/budgets` | `BudgetScreen, AddBudgetScreen` | Progress bar updates after adding expense in same category. |
| 18 | Debt payment | `POST /api/debts/:id/payments` | `AddDebtScreen` | Outstanding amount decreases. |
| 19 | Saving goal contribution | `POST /api/saving-goals/:id/contributions` | `AddSavingGoalScreen` | Goal progress %  updates. |
| 20 | Personal goal + milestone | `POST /api/goals`, `POST /api/goals/:id/milestones`, `PATCH /api/goal-milestones/:id` | `PersonalGoalsScreen, GoalDetailScreen, CreateGoalScreen` | Milestone marked COMPLETED sets `completedAt`. |
| 21 | Assistant recommendations | `GET /api/assistant/today`, `PATCH /api/assistant/recommendations/:id/status` | `AssistantScreen` | Recommendations list; APPLY / DISMISS round-trips. |
| 22 | AI chat | `POST /api/ai/chat` | `AIChatScreen` | Multi-turn conversation persists; greeting + Send button localised. |
| 23 | Daily report | `POST /api/ai/daily-review` | `DailyReviewScreen` | Renders summary + tips. |
| 24 | Weekly report | `POST /api/ai/weekly-insight` | `WeeklyReportScreen` | 7-day chart + insight bullets. |
| 25 | Monthly finance report | `GET /api/reports/monthly-finance` | `MonthlyFinanceReportScreen` | Bar chart by category. |
| 26 | Push permission denied | `expo-notifications` only | `SettingsScreen → Enable push` | After OS deny, app shows "Permission denied" + "Open Settings" button (translated, deep-links to OS settings). |
| 27 | Offline cache | n/a | global banner + `OfflineBanner` | Airplane mode: cached lists still render; AI buttons greyed out with "Need connection" message; queued mutations replay on reconnect. |
| 28 | Backend health | `GET /api/health/ready` | n/a | DB-backed readiness probe returns `{ status: "ready", database: "up" }`. |
| 29 | DB migration | `npm run db:migrate:deploy` (workspace), `bash scripts/migrate.sh` | n/a | Fresh DB → all 3 migrations apply cleanly; pre-existing DB → no-op. |
| 30 | Android build | `eas build --platform android --profile production` | n/a | Builds AAB; `versionCode` auto-increments; bundle id matches release plan (NOT `com.yourname.lifeosai`). |
| 31 | iOS build | `eas build --platform ios --profile production` | n/a | Builds IPA; `buildNumber` auto-increments; ATS satisfied (HTTPS-only enforced by `app.config.ts`). |

## 3. Negative paths to verify

- Login 11+ failed attempts in 60 s → `RATE_LIMIT_EXCEEDED` toast in active locale.
- Force-quit while AI request in flight → no orphan toasts; relaunching shows last-known-good state.
- Backend down → `errors.NETWORK` toast; no stack traces; queued mutations survive.
- JWT expired during session → silent refresh; if refresh also expired → redirect to Login.
- Cross-user IDOR: log in as user A, try to PATCH a resource id known to belong to user B → 403 + `errors.FORBIDDEN` (verified by tests).
- Push token registration: backend already accepts the token via `POST /api/notifications/devices` once a mobile API client is added in v1.1. Verify the UI shows "permission denied" recovery in the meantime.

## 4. Known gaps (documented, not blocking v1.0.0)

- Push notification **dispatch** (server → device) not wired; only opt-in toggles are persisted.
- Mobile language change does not PUT `/api/profile/locale`; profile-stored locale may drift from on-device locale.
- Mobile API client for `notifications/devices` is missing; permission flow exists end-to-end except for token sync.
- Bundle id `com.yourname.lifeosai` is a placeholder — change before store submission.
- Offline sync queue covers `task:setStatus`, `habit:log`, `expense:create` only; other writes show online-required errors when offline.

## 5. Sign-off checklist

- [ ] All flows in §2 executed on iOS + Android in `vi` and `en`.
- [ ] §3 negative paths reproduced.
- [ ] §4 gaps acknowledged and explicitly accepted by PM.
- [ ] `npm run build`, `npm run typecheck`, `npm test`, `bash scripts/check.sh` all green.
- [ ] Production stack starts: `docker compose ... up -d` + `/api/health/ready` returns 200.

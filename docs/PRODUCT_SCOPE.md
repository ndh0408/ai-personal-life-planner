# LifeOS AI — Product Scope

LifeOS AI is a personal life operating system: a 24/7 assistant that helps a single user run their day-to-day life across schedule, work, health, food, finances, goals, and habits. It is **not** a calendar app, and it is **not** a chatbot that only answers when asked.

## Design principles

1. **Personal, not social.** Everything is scoped to one user. No sharing, no teams, no feeds.
2. **Proactive over reactive.** The AI watches signals (sleep, overdue tasks, skipped meals, budget burn-rate) and surfaces insights without being asked.
3. **Gentle by default.** Tone is supportive, not pushy or judgmental. LifeOS never nags.
4. **Long-term health over short-term productivity.** When targets conflict (e.g. "finish this tonight" vs. "you haven't slept enough"), the AI sides with health and stability.
5. **Foundation first, features later.** Ship a correct auth/data/i18n layer before deepening each vertical.

---

## Feature domains

### 1. Daily schedule
- AI generates a day plan based on profile, goals, wake/sleep preference, and open tasks.
- Recommends wake time, sleep time, meal windows.
- Re-plans when the user runs late.
- Tracks progress through the day (completed / delayed / skipped items).
- Surface: `/planner/today`, `/schedules/:date`, `/schedules/:id/items`.

### 2. Tasks
- Manage to-dos with deadline / priority / estimated effort.
- Break large tasks into sub-steps.
- "What should I do next?" suggestion based on energy, remaining time, and priority.
- Overload detection (flags days with >X estimated minutes).
- Postponement analysis (which tasks keep being pushed?).
- Surface: `/tasks`, `/tasks/:id`, `/tasks/:id/status`.

### 3. Habits
- Daily / weekly / custom frequency.
- Streak counter and completion-rate analytics.
- Reminders for missed habits.
- "Which habits keep dropping?" insights.
- Surface: `/habits`, `/habits/:id/log`.

### 4. Food
- Meal suggestions for breakfast / lunch / dinner / snack.
- Filterable by goal (cut, bulk, maintain), available ingredients, or budget.
- Tracks which meals were actually eaten.
- Detects repeated skipped meals.
- **Calorie figures are estimates, not medical guidance.** The app must not give dangerous dietary advice.
- Surface: `/meals`.

### 5. Health & lifestyle
- Sleep logs (time in bed, quality).
- Mood + energy + stress check-in.
- Basic activity tracking.
- Recommends rest / earlier bedtime when signals warrant.
- Detects chronic under-sleep and over-packed schedules.
- **Lifestyle guidance only. Not a medical device; not a replacement for a doctor.**
- Surface: `/sleep-logs`, `/mood-logs`.

### 6. Personal finance _(foundation-only in this iteration)_
- Income + salary tracking, expenses, budgets, wallets.
- Debt + savings ledgers.
- Financial goals.
- Category-level spending analysis.
- Month-end budget remaining, overspending alerts.
- Salary allocation suggestions.
- Weekly / monthly financial reports.
- **No high-risk investment advice. No promised returns. No tax/legal guidance.**
- Status: `/finance/overview` is wired but returns a placeholder. Prisma sub-schema (`finance_*` tables: wallets, transactions, categories, budgets, debts, savings, financial_goals) lands in the next iteration.

### 7. Personal goals _(foundation-only in this iteration)_
- Health / finance / learning / work / skill / life categories.
- Milestones + progress tracking.
- AI suggests small daily actions.
- Flags stalled goals.
- Status: `/goals` is wired but returns a placeholder. Prisma sub-schema (`goals`, `goal_milestones`, `goal_actions`) lands in the next iteration.

### 8. AI assistant — proactive
- Watches data and emits insights without prompting.
- Monitored signals: under-sleep, skipped meals, work overload, budget overrun, late tasks, dropped habits, high stress, over-packed schedules, missing rest.
- Delivery: in-app feed, push notifications, weekly digest.
- Reply in the user's chosen locale.
- Surface: `/ai/*` (chat, insights, recommendations).

### 9. Reports
- Day, week, month summaries for schedule, tasks, wellbeing, food, finance, goals.
- Includes AI-generated insights + improvement suggestions.
- Surface: `/reports/daily`, `/reports/weekly`.

### 10. Internationalization
- First-class Vietnamese + English.
- No hard-coded user-facing strings in UI.
- Backend returns stable `errorCode`; mobile translates.
- AI responses in user's locale.
- Notifications in user's locale.
- See [I18N.md](./I18N.md).

---

## What is explicitly out of scope (for now)

- Multi-user sharing, family accounts, social feeds.
- High-risk financial advice: trading signals, investment allocation with promised returns, tax strategies.
- Medical diagnosis, prescription, or anything requiring professional licensure.
- Calendar sync with Google/Outlook (planned, not v1).
- Wearable device integration (planned, not v1).
- Offline-first behavior (v1 assumes network; caches for resilience only).

## Safety guardrails the AI must respect

1. Never promise weight-loss rates or calorie deficits that are medically unsafe.
2. Never recommend skipping sleep to hit a deadline.
3. Never push the user into spending or investment decisions.
4. Never share or surface another user's data (there are none, but the boundary matters).
5. On detecting concerning mental-health signals, the AI must surface resources, not therapy.

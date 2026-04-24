# Meals module — mobile

AI-assisted meal planning for a single day. MealsScreen now lets the user scrub the date, generate a full plan via AI, log what they actually ate, and see both the plan + their logs side by side. Safety: calorie and cost are estimates; no medical claims; skipped-meal signals are already flagged by the Assistant.

## Screen structure

### MealsScreen

Location: `apps/mobile/src/screens/meals/MealsScreen.tsx`.

- **Date picker row** — `‹` / `›` buttons shift the target date by ±1 day; "Back to today" link appears when the date isn't today. All reads re-fetch when the date changes.
- **Title + subtitle** — localized.
- **AI CTA card** — "AI suggest meals" button opens a bottom-sheet modal.
- **Meal blocks** — 4 cards in fixed order (Breakfast / Lunch / Dinner / Snack). Each card renders:
  - Emoji icon + localized meal-type title + "Eaten" badge when a `MealLog` exists for that slot.
  - Suggestion title (h2), description.
  - Ingredient list (single line, comma-joined).
  - Stats row: calories (kcal), prep time (min).
  - `reason` line (💡) and `healthNote` line (⚕️) when present.
  - "I ate this" button that disappears after logging.
  - Falls back to a "no suggestion for this meal" line when a slot has no suggestion.
- **Estimates disclaimer** at the bottom: calories and cost are estimates, not medical advice.
- **Empty state** (no plan) — EmptyState + the AI CTA on top still visible.
- **Pull-to-refresh** re-runs both queries in parallel.

### AiSuggestModal

Bottom-sheet modal with the form the AI needs:

- `goal` — chip picker: `healthy / high-protein / low-carb / cheap / quick` (toggleable, single-select). Optional.
- `budget` — free text. Optional.
- `availableIngredients` — multiline textarea, comma / semicolon / newline-separated. Trimmed client-side into an array before submit.
- `cookingTimeMinutes` — numeric. Optional.
- Disclaimer repeated in-modal.
- Submit button shows a loading state and disables while the mutation is in flight.

On success the modal closes; the current day's meal plan refetches; the dashboard invalidates so its meal-preview card stays in sync.

## Flow

```
User opens MealsScreen
       │
       ▼
GET /api/meals?date=YYYY-MM-DD         ← plan for the day
GET /api/meal-logs?from=D&to=D         ← what was actually eaten
       │
       ▼
Taps "AI suggest meals"
       │
       ▼
Fills form → POST /api/ai/suggest-meals { date, goal?, budget?,
                                          availableIngredients?,
                                          cookingTimeMinutes?,
                                          save: true }
       │
       ▼
Backend:
  - AiMealService.suggest() resolves locale via LocaleService.forUser
    (UserProfile.locale → Accept-Language → "vi").
  - Builds prompt via meal-suggestion.prompt.ts with profile.dietaryPreference,
    profile.mainGoal, profile.activityLevel as context.
  - Calls the AI provider (mock / anthropic / openai) with JSON mode.
  - Validates against MealSuggestionsSchema; one-shot repair; locale-aware
    fallback if still invalid.
  - save=true upserts MealPlan + MealSuggestion rows atomically.
  - Returns { suggestions, saved, usedFallback }.
       │
       ▼
Mobile invalidates ['meals', date] + ['dashboard'] →
MealsScreen re-renders with the 4 cards.
       │
       ▼
User taps "I ate this" → POST /api/meal-logs → card badges as "Eaten",
                         Dashboard meal counter updates.
```

## Safety guardrails already enforced server-side

From `apps/api/src/modules/ai/prompts/system.ts` BASE_GUARDRAILS (applied to every AI call including meal suggestions):

- No medical/pharmacological advice; extreme dietary prescriptions must redirect to a qualified professional.
- "Reply in Vietnamese / English" based on the resolved user locale.
- JSON-only output; fenced markdown forbidden.
- prompt-injection resistance: user content is wrapped in labeled `<user-*>` blocks and treated as data.

From `meal-suggestion.prompt.ts`: the prompt constrains calories and prep time to user's stated cooking-time budget; generic advice only; no medical claims like "cures".

## Skipped-meal recommendations

Already wired in the Personal Assistant Engine — no mobile code needed to emit them:

- **`MEAL_PLAN_MISSING`** (LOW) — fires when no MealPlan exists for today.
- **`MEAL_SKIPPED_REPEATEDLY`** (MEDIUM) — fires when `MealLog` count < 5 in the last 5 days.

Copy in `recommendation.service.ts` is non-judgmental per product rule ("no shaming"). Surfaces on Dashboard + Assistant tabs.

## API calls

| Endpoint | Used by |
| --- | --- |
| `GET /api/meals?date=` | MealsScreen plan fetch. |
| `POST /api/ai/suggest-meals { save: true }` | AI modal submit — backend upserts the MealPlan + suggestions. |
| `GET /api/meal-logs?from=&to=` | MealsScreen logs for the day. |
| `POST /api/meal-logs` | "I ate this" button. |

## Query keys

```
QUERY_KEYS.meals(date)       // the plan for a specific day
['meal-logs', date]          // logs for the same day
['dashboard']                // invalidated after suggest + log-ate
```

## Loading / error / empty / disclaimer states

- **Loading** — full-screen `<Loading/>` on first mount.
- **Error** — `<ErrorView/>` on first-load failure with retry. In-flight errors (AI call, log-ate) show localized Alerts and leave the UI untouched.
- **Empty plan** — `<EmptyState/>` under the AI CTA; the CTA itself is always visible so the empty day is one tap away from a plan.
- **Per-slot empty** — individual cards render "No suggestion for this meal" when the plan exists but lacks that mealType (e.g. no snack).
- **Disclaimer** — rendered both at the bottom of the screen AND inside the AI modal so users see it before submitting.

## i18n

New key block `meals.*` covers:

```
meals.title  subtitle  backToToday  notes  disclaimer
meals.empty.{title,description}
meals.noneSuggested  ate  logAte  calories  prepTime
meals.type.{BREAKFAST,LUNCH,DINNER,SNACK}
meals.ai.ctaTitle  ctaBody  cta  formTitle  submit
meals.ai.goal  budget  ingredients  ingredientsPlaceholder  cookMin
meals.ai.goals.{healthy,high-protein,low-carb,cheap,quick}
```

Every label, button, and state routes through `t()`. Dates via `formatDateByLocale`; money via `formatMoneyByLocale` where used; calories formatted as `~N kcal`.

## Testing (manual)

1. Settings → Language → vi. Open Meals. Day = today, seed has 4 suggestions + 2 logs (breakfast + yesterday's dinner).
2. Tap Breakfast's "I ate this" → the card flips to show "Đã ăn" badge, button disappears, Dashboard's meal count bumps.
3. Tap `›` → move to tomorrow → empty state. Tap "AI suggest meals" → modal opens.
4. Fill: goal = Healthy, budget = "~100k VND", ingredients = "trứng, gạo, rau", cooking time = 25. Submit.
5. Within a few seconds (mock provider) modal closes, 4 new suggestion cards appear for tomorrow.
6. Language → en → every label + button + empty state flips, Breakfast/Lunch/Dinner/Snack render in English, disclaimer wording changes.
7. Airplane mode → tap AI CTA → submit → localized Alert appears; plan state remains unchanged.

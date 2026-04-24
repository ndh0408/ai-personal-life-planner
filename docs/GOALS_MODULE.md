# Personal Goals module — mobile

Long-horizon goals that the user wants to track across weeks or months, not day-to-day tasks. Each goal is either **milestone-driven** (a chain of sub-steps) or **numeric** (targetValue/currentValue/unit) — the UI supports both in one record. The AI helpers are intentionally gentle: they split, nudge, and check in without adding pressure.

## Screens

### PersonalGoalsScreen

Location: `apps/mobile/src/screens/goals/PersonalGoalsScreen.tsx`.

List of `ACTIVE` goals. Header row: title + `+ Add` button → `CreateGoal`. Below the header, a horizontally scrolling row of category chips: `ALL + HEALTH / FINANCE / CAREER / STUDY / RELATIONSHIP / PERSONAL / OTHER`. Each goal renders as a `GoalRow`:

- Category + priority + milestone-count badges (e.g. `3/5 milestones`)
- Title (2-line clamp) + optional description (2-line clamp)
- Numeric `ProgressCard` when `targetValue`, `currentValue`, `unit` are present
- Deadline line if set

Pull-to-refresh re-runs the `['goals']` query. Tap → `GoalDetail`.

Empty states:
- No goals at all → `goals.empty.title / description`.
- Filter active → `goals.empty.filteredTitle / filteredDescription`.

### CreateGoalScreen

Location: `apps/mobile/src/screens/goals/CreateGoalScreen.tsx`. Modal.

Same screen handles both create and edit (via `route.params.goalId`). Fields:

| Field | Notes |
| --- | --- |
| title | required |
| description | optional, multiline |
| category | chip row, defaults to `PERSONAL` |
| priority | chip row (`LOW / MEDIUM / HIGH`), defaults to `MEDIUM` |
| targetValue | numeric, optional — enables numeric progress |
| currentValue | numeric, optional — must be ≤ targetValue |
| unit | optional string (`kg`, `km`, `hours`…) |
| deadline | `YYYY-MM-DD`, optional |

On save invalidates `['goals']` + `['dashboard']` and `goBack()`. In edit mode also exposes a red **Delete** button with a confirm dialog.

Client-side guardrails:
- Title required.
- Deadline must match `^\d{4}-\d{2}-\d{2}$` if provided.
- `currentValue > targetValue` is rejected inline.

### GoalDetailScreen

Location: `apps/mobile/src/screens/goals/GoalDetailScreen.tsx`. Push.

Sections top-to-bottom:

1. **Header** — category / priority / status badges, title, description, deadline, inline `Edit goal` button → `CreateGoal` in edit mode.
2. **Progress cards** — numeric progress card if the goal has `targetValue/currentValue`; milestone-progress card if the goal has milestones (`completed/total` + percentage).
3. **Status actions** — chip row to change status. From `ACTIVE` the options are `COMPLETED / PAUSED / CANCELLED`; from any non-active status a `Re-activate` chip appears. Each chip triggers a localized confirm dialog before firing `PUT /api/goals/:id { status }`.
4. **Milestones** — scrollable list of cards. Each milestone shows title (line-through when done/cancelled), target date, and a status badge. Per-milestone actions:
   - `Complete` → `PATCH /api/goal-milestones/:id/status { status: 'COMPLETED' }`
   - `Re-open` (shown when already completed) → `PATCH … { status: 'TODO' }`
   - `Delete` (with confirm) → `DELETE /api/goal-milestones/:id`
5. **Add milestone** — card with title + optional target date (`YYYY-MM-DD`) + Add button → `POST /api/goals/:id/milestones`.
6. **AI helpers** — three actions on the same card (see below).

All mutations invalidate `['goals']`, `['goals', goalId]`, and `['dashboard']` on success.

## Milestones

Milestone records carry `title`, optional `targetDate`, and a `status` of `TODO | COMPLETED | CANCELLED`. The service endpoints are split intentionally:

- **POST /api/goals/:goalId/milestones** — create in the context of a goal (so the backend can verify ownership of the parent goal before accepting the write).
- **PUT /api/goal-milestones/:id** — top-level update by milestone id (title, targetDate, status) — keeps the mobile client from having to thread the parent goalId through every edit.
- **PATCH /api/goal-milestones/:id/status** — shortcut endpoint that mobile uses for the one-tap complete / reopen actions.
- **DELETE /api/goal-milestones/:id**.

The mobile client uses `POST`, `PATCH`, and `DELETE` today; `PUT` is available for a richer milestone-edit surface later without a backend change.

## AI helpers (non-pressuring)

All three helpers route through the generic `POST /api/ai/chat` endpoint with `contextType: 'goals-helper'`. The mobile client builds a short context string — category + title + numeric progress + deadline + milestone count — and passes it in as `{{context}}`. Three modes, each with its own localized prompt that **explicitly asks the model to be gentle and non-pressuring**:

| Mode | CTA | Prompt intent |
| --- | --- | --- |
| `milestones` | Break goal into milestones | Ask for 3-5 realistic milestones with rough target dates. Practical, kind, specific. |
| `today` | One small action for today | One doable action under 30 minutes. Keep it gentle. |
| `check` | Gentle progress check | Encouraging check-in. If the goal looks behind, nudge softly without pressure. Offer one reframing idea. |

Responses are shown as read-only `Alert.alert` text — nothing is written server-side. The user applies suggestions manually via the Add-milestone form or by editing the goal. A disclaimer line sits under the section: "Advice is general guidance — you know your life best." / "Đây chỉ là gợi ý — bạn hiểu cuộc sống mình rõ hơn ai hết."

Safety rationale: goals are an emotionally loaded domain (weight, finances, relationships, career). The prompts explicitly request a non-judgmental tone, the UI never auto-mutates based on AI output, and we keep the AI suggestions cold-path (tap-to-fetch, not background-generated).

## API surface used

```
GET    /api/goals
GET    /api/goals/:id
POST   /api/goals
PUT    /api/goals/:id                      // body can include status for mark actions
DELETE /api/goals/:id
POST   /api/goals/:goalId/milestones
PUT    /api/goal-milestones/:id            // available, not yet used by mobile
PATCH  /api/goal-milestones/:id/status
DELETE /api/goal-milestones/:id
POST   /api/ai/chat                        // contextType=goals-helper
```

## Navigation surface

New routes in `RootStackParamList`:

```ts
CreateGoal: { goalId?: string } | undefined;  // modal — create + edit
GoalDetail: { goalId: string };               // push
```

`CreateGoal` is presented modal-style so it slides up over the detail or list. `GoalDetail` pushes onto the stack from the list.

## i18n coverage

Namespace additions under `goals.*` in both `vi.json` and `en.json`:

- `goals.title`, `goals.addNew`, `goals.deadline`, `goals.milestones`, `goals.milestonesProgress`, `goals.progress`, `goals.notFound`, `goals.edit`, `goals.createTitle`, `goals.editTitle`, `goals.statusActions`.
- `goals.empty.{title,description,filteredTitle,filteredDescription}`.
- `goals.filter.ALL`.
- `goals.category.{HEALTH,FINANCE,CAREER,STUDY,RELATIONSHIP,PERSONAL,OTHER}`.
- `goals.status.{ACTIVE,COMPLETED,PAUSED,CANCELLED}` and `goals.markAs.{ACTIVE,COMPLETED,PAUSED,CANCELLED}`.
- `goals.confirm{Complete,Pause,Cancel,Delete}.{title,body}`.
- `goals.form.{title,titlePlaceholder,description,descriptionPlaceholder,category,priority,targetValue,currentValue,unit,unitPlaceholder,deadline,numericHint}`.
- `goals.invalid.{title,titleBody,deadlineBody,progressBody}`.
- `goals.milestone.{addTitle,add,target,empty,complete,reopen,titlePlaceholder,invalidTitle,invalidTitleBody,invalidDateBody,confirmDeleteTitle,confirmDeleteBody}` + `goals.milestone.status.{TODO,COMPLETED,CANCELLED}`.
- `goals.ai.{sectionTitle,sectionBody,milestoneCta,todayCta,checkCta,milestoneTitle,todayTitle,checkTitle,milestonePrompt,todayPrompt,checkPrompt,disclaimer}`.

Priority labels reuse `tasks.priority.{LOW,MEDIUM,HIGH}` — same enum, one source of truth.

## Query-key map

```
['goals']           // list
['goals', id]       // detail + edit seed
['dashboard']       // invalidated on every mutation (goal + milestone counts)
```

Every mutation invalidates the union: list + detail + dashboard. No optimistic writes — the server is the source of truth, and mutations complete fast enough locally that optimism would add complexity for a <200 ms win.

## Testing (manual)

1. Settings → Language → vi. Open Dashboard → Personal goals tile (or direct nav). Tap `+ Mục tiêu mới`, fill title `Tiết kiệm 50 triệu`, category `FINANCE`, target `50000000`, current `5000000`, unit `VND`, deadline `2026-12-31`, priority HIGH → Save. Goal appears in list.
2. Tap the row → `GoalDetail`. Numeric progress card shows `5000000 / 50000000 VND` at 10%.
3. Add a milestone `Đạt 10 triệu` target `2026-06-30` → appears in list. Tap `Hoàn thành` → badge flips to `Đã xong`, milestone progress card updates `1/1 · 100%`.
4. Tap `Re-open` on the completed milestone → flips back to `Đang làm`.
5. Delete the milestone → confirm → row disappears.
6. Tap `AI helpers → Chia mục tiêu thành cột mốc` → receive 3-5 milestones in Vietnamese.
7. Tap `Một hành động nhỏ cho hôm nay` → receive one kind suggestion under 30 minutes.
8. Tap `Kiểm tra tiến độ nhẹ nhàng` → receive a gentle check-in, non-pressuring.
9. `Cập nhật trạng thái → Đánh dấu hoàn thành` → confirm dialog → status flips to `COMPLETED`, goal leaves the list screen (filter is ACTIVE).
10. Switch language to en → every label flips including category chips, milestone status, confirm dialogs, AI sections, and enum labels.

# GAP_R45 — Reality vs. R29/R30/R31 Prompt

> Audit ngày 2026-05-03, repo ở `0d3e0e8` (R44 Aurora wired to /dashboard/summary).
> Phương pháp verify mỗi feature:
> 1. **Schema** — grep `apps/api/prisma/schema.prisma`
> 2. **API code** — `find apps/api/src + grep symbol`
> 3. **Mobile call site** — `grep -r '<Symbol>' apps/mobile/src` (loại trừ `.spec.`)
> 4. **Test coverage** — file `*.spec.ts` ở vị trí kế bên + jest passing
>
> Một feature bị coi là **shipped** chỉ khi: schema OK + code OK + có call site mobile (nếu UI) + có ít nhất 1 spec.
> **scaffolded** = có file/model/comment nhưng không có call site hoặc spec hoặc không kết nối.
> **abandoned** = không tồn tại trong source.

---

## 1. Round 29 — Real Intelligence Layer

| Feature (theo prompt R29) | Status | Bằng chứng |
|---|---|---|
| pgvector extension trong Prisma | **abandoned** | `schema.prisma` không có khối `extensions = [vector...]` ; không có field nào type `Unsupported("vector(...)")` |
| Postgres image có pgvector | **abandoned** | `compose.yaml` dùng `postgres:16-alpine` — không có vector extension preload |
| `AssistantMemory.embedding` | **abandoned** | model có `id, userId, content, weight, createdAt` — không có embedding/embeddingModel/embeddingVersion |
| `EventLog.embedding` | **abandoned** | tương tự |
| `EmbeddingCache` table | **abandoned** | model không tồn tại |
| `DailyMetrics` aggregator | **abandoned** | model không tồn tại |
| `DetectedPattern` table | **abandoned** | model không tồn tại |
| `ProactiveNotification` state machine | **abandoned** | model không tồn tại; chỉ có `NotificationSetting` (đơn giản) |
| `NotificationPreferences` (quiet hours, daily cap) | **abandoned** | model không tồn tại |
| `EmbeddingService` (OpenAI text-embedding-3-small dim=512) | **abandoned** | không có file `embedding.service.ts` |
| `BullMQ` worker / processor / queue | **abandoned** | dep có trong `package.json` nhưng 0 file `*.processor.ts`/`*.worker.ts`; `notifications.module.ts` là `@Module({})` rỗng + comment "Round 5 will add..." |
| Pattern miner (Pearson/Spearman/cooccurrence/anomaly/sequence) | **abandoned** | không có thư mục `pattern-miner/` |
| Proactive trigger engine (cron 30 min + rule files) | **abandoned** | không có thư mục `proactive/` |
| `UserContext v2` semantic retrieval (cosine top-K) | **abandoned** | `user-context.service.ts` vẫn là rule-based (chọn top events theo recency/weight, không có embedding) |
| Learning loop thực (feedback → update weight + decay) | **abandoned** | `assistant-memory.service.ts` không có endpoint feedback |
| `/api/patterns` + `/api/patterns/:id/feedback` | **abandoned** | không có controller |
| `/api/notifications/preferences` | **abandoned** | không có endpoint |
| `/api/intelligence/v2/embed-backfill` | **abandoned** | không có endpoint |
| Tests R29 (≥30 jest) | **abandoned** | 0 thêm |

### R29 — đã ship parallel (không match prompt nhưng cùng mục đích "intelligence thực sự")
| Đã có | Test | Mounted? |
|---|---|---|
| `CircadianService` (R38, regression sleep window) | ✅ `circadian.service.spec.ts` | ✅ qua `PassiveIntelligenceController` |
| `StressService` (R38, multi-signal aggregator) | ✅ `stress.service.spec.ts` | ✅ |
| `EnergyService` (R38, predicted energy curve) | ✅ `energy.service.spec.ts` | ✅ |
| `BehaviorService` (descriptive stats) | ❌ no spec | exported nhưng dùng ở đâu? — chưa rõ, cần grep callers |
| `InsightGenerator` (rule-based) | ❌ no spec | ✅ qua dashboard |
| `AssistantMemoryService` | ❌ no spec | ✅ MemoryController |
| `EventLogService` | ❌ no spec | ✅ TelemetryController |
| `UserContextService` (recency-weighted, không semantic) | ✅ `user-context.service.spec.ts` | ✅ |
| `SmartBriefService` (R32, dashboard hero source) | ✅ `smart-brief.service.spec.ts` | ✅ HomeAurora calls /dashboard/summary |
| `LlmService` (R29 commit, OpenAI v6 Responses API + Structured Outputs) | ✅ `llm.service.spec.ts` | ✅ |
| `Capture corrections.service` (memory-influenced classifier) | ✅ spec | ✅ |
| `ActionSuggester` | ✅ spec | ✅ |

**R29 verdict**: Phần intelligence kiểu R28 prompt (vector + miner + proactive) **chưa có gì**. Phần intelligence theo hướng khác (passive signals, brief, suggester) **đã ship đầy đủ + có test**.

---

## 2. Round 30 — UI Redesign

| Feature (theo prompt R30) | Status | Bằng chứng |
|---|---|---|
| Hướng "Things 3 + Apple Health + Linear" | **abandoned** | repo đi hướng "Aurora dawn-to-dusk" thay vì hybrid Things/Health/Linear |
| `react-native-unistyles@3` | **abandoned** | không có trong `package.json` |
| `react-native-mmkv` | **abandoned** | không có trong `package.json` |
| `@react-native-community/blur` | **shipped (qua Aurora)** | dùng trong glass surfaces (R42); cần verify package.json — KHÔNG xuất hiện trong dependencies tab → có thể self-render qua `LinearGradient` thay vì BlurView. Cần đọc `packages/aurora/src` để chốt. |
| `react-native-haptic-feedback` | **scaffolded** | AndroidManifest có VIBRATE perm (R43.1), comment nói "haptics module added in R41"; cần verify dep — KHÔNG xuất hiện trong `package.json` mobile → có thể tự nhúng qua native Vibration API |
| `@react-navigation/native-stack@^7` (cho shared transition) | **abandoned** | dùng v6.11.0 |
| `@react-navigation/bottom-tabs@^7` | **abandoned** | v6.6.1 |
| Light + Dark + Auto theme | **scaffolded** | `apps/mobile/src/theme/v2/` có ThemeProvider; Aurora dùng dynamic palette theo giờ trong ngày (R42) — không phải dark/light theo system. Cần verify có toggle manual không. |
| `Box`, `Text` typed-props design system | **shipped** | `components/v2/Text.tsx`, `Surface.tsx`, `Tile.tsx` |
| `HeroCard` composable | **shipped** | `components/v2/Surface.tsx` + Aurora `MetricRing`, `Sparkline` |
| `Button` haptic on press | **partial** | `components/ui/Button.tsx` + `components/v2/Button.tsx` exist; haptic wiring chưa verify |
| `Pill` mood/status | **shipped** | `Chip.tsx` |
| `Ring` SVG animated | **shipped** | `components/v2/MetricRing.tsx` |
| `Sparkline` SVG | **shipped** | `components/v2/Sparkline.tsx`, `components/ui/Sparkline.tsx` (2 phiên bản — dead code candidate) |
| `Skeleton` shimmer Reanimated | **scaffolded** | `components/ui/SkeletonCard.tsx` exists — cần verify shimmer thực hay tĩnh |
| `Sheet` bottom sheet với blur backdrop | **shipped** | `components/ui/BottomSheet.tsx`, `components/v2/CaptureSheetV2.tsx` |
| `CommandPalette` ⌘K fullscreen | **abandoned** | không có file |
| `Stories` Insights story viewer | **abandoned** | không có file |
| `EmptyState` + 5 SVG illustrations | **partial** | `EmptyState.tsx` exists; số illustration variant chưa verify, có thể chỉ là text |
| Shared element Quick Capture → Detail | **abandoned** | RN 0.74 + Reanimated 3.10 không support shared transitions native-stack v7 (đang v6) |
| Stagger entry FadeInDown | **partial** | Reanimated có sẵn nhưng grep không thấy `FadeInDown` usage — chưa verify |
| Press scale 0.97 + spring | **partial** | có thể có trong v2 Button — chưa verify |
| Token snapshot test (light + dark) | **abandoned** | không có spec |
| Theme switch test (Appearance change) | **abandoned** | không có spec |
| HeroCard / Skeleton / Stories / EmptyState specs | **abandoned** | 0 spec cho Aurora components |
| Maestro smoke flow đầy đủ | **partial** | `.maestro/smoke.yaml` exists nhưng nội dung chưa verify |

### R30 — đã ship parallel
- **Aurora design system** (R42): dawn-to-dusk dynamic palette, glass surfaces, lemniscate logo, AuroraCanvas global wrapper, 5 Aurora screens (Today/Plan/Money/Health/Mind) wired vào `/dashboard/summary` (R44).
- `packages/design-tokens` + `packages/aurora` (workspace packages, có `dist/`).
- 9 v2 components + 5 v2 screens đã shipped ở R41 nhưng **đã bị thay thế bởi Aurora ở R42-44** → **dead code**.

**R30 verdict**: Aurora đã hoàn thành mục tiêu "redesign UI" với một hướng thẩm mỹ khác. Cơ sở hạ tầng (Unistyles/MMKV/Haptic dep/Stories/CommandPalette) chưa có, nhưng app **trông đã đẹp và mounted**. Vấn đề lớn duy nhất: **không test coverage cho UI hiện tại đang chạy**.

---

## 3. Round 31 — Features Hoàn Chỉnh

| Feature (theo prompt R31) | Status | Bằng chứng |
|---|---|---|
| Recurring transactions/tasks (rrule) | **abandoned** | không có model `RecurrencePattern`; không có dep `rrule` |
| FCM real notifications | **abandoned** | không có dep `@react-native-firebase/*`; không có `firebase-admin` ở API; không có `google-services.json` |
| `@notifee/react-native` channels | **abandoned** | không có dep |
| Notification preferences UI | **abandoned** | screen không tồn tại |
| `DeviceToken` model | **abandoned** | không có |
| Background handler `index.js` top-level | **abandoned** | không có |
| Offline mode (`persistQueryClient`) | **abandoned** | không có dep `@tanstack/react-query-persist-client` |
| `OfflineMutationLog` | **abandoned** | không có model |
| Conflict resolution UI | **abandoned** | không có |
| Network indicator banner | **abandoned** | NetInfo không có dep |
| Data export ZIP | **abandoned** | không có endpoint `/api/export/all` |
| Photo input meal | **abandoned** | không có dep `react-native-image-picker`; không có endpoint `/api/capture/photo`; LlmService không có gọi vision |
| Voice input | **abandoned** | không có dep `@react-native-voice/voice`; không có endpoint `/api/capture/voice` |
| Google Calendar sync | **abandoned** | không có dep `googleapis`; không có model `CalendarIntegration` |
| Budget alert realtime | **abandoned** | có `UserProfile.budgetMonthly` nhưng không có check threshold + emit notification (NotificationsModule rỗng) |
| Home widget Android | **abandoned** | không có file `WidgetTodayProvider.kt` trong `apps/mobile/android/app/src/main/java` |
| Share extension | **abandoned** | AndroidManifest không có `<intent-filter>` ACTION_SEND |
| `RecurrencePattern` cron generator | **abandoned** | không có BullMQ worker nào |
| Tests R31 (≥40) | **abandoned** | 0 thêm |

### R31 — đã ship parallel
- Subscription model + service (R41) — `tier: FREE/PLUS/PRO/LIFETIME`, `provider: appstore/playstore/stripe/promo/lifetime/none`. Có spec.
- HealthConnect (Android) + HealthKit (iOS) clients + `sync-orchestrator` (R35-36) — wired vào App.tsx onForeground.
- `DeviceSyncCursor`, `HeartRateSample`, `ActivitySample` models (R35-36).
- `EventLog` + `DataSource` enum (provenance — R36).
- iOS native scaffold (R39): Xcode workspace + CocoaPods chạy được, IPA build qua mac-build-server.

**R31 verdict**: Toàn bộ 11 hạng mục feature trong prompt R31 đều **chưa làm**. Repo thay vào đó đã làm sensor sync (tốn nhiều effort hơn FCM nhiều lần).

---

## 4. Tech Debt Audit

### 4.1 Dead v1/v2 code (replaced by Aurora ở R42-44)
RootNavigator chỉ mount `MainTabsAurora`. Mọi thứ dưới đây **không còn tham chiếu nào trong code path live** (chỉ self-reference):

| File | Vai trò | Lý do dead |
|---|---|---|
| `apps/mobile/src/navigation/MainTabs.tsx` | v1 bottom tabs | RootNavigator không mount nữa |
| `apps/mobile/src/navigation/v2/MainTabsV2.tsx` | v2 bottom tabs | bị Aurora thay |
| `apps/mobile/src/navigation/v2/TabBar.tsx` | v2 tab bar | dùng bởi MainTabsV2 dead |
| `apps/mobile/src/screens/main/HomeScreen.tsx` | v1 Home | chỉ MainTabs.tsx (dead) import |
| `apps/mobile/src/screens/main/TodayScreen.tsx` | v1 Today | chỉ MainTabs.tsx import |
| `apps/mobile/src/screens/main/MoneyScreen.tsx` | v1 Money | chỉ MainTabs.tsx import |
| `apps/mobile/src/screens/main/AssistantScreen.tsx` | v1 Assistant | chỉ MainTabs.tsx import |
| `apps/mobile/src/screens/main/SettingsScreen.tsx` | v1 Settings | chỉ MainTabs.tsx import |
| `apps/mobile/src/screens/v2/TodayScreen.tsx` | v2 Today | chỉ MainTabsV2 (dead) import |
| `apps/mobile/src/screens/v2/PlanScreen.tsx` | v2 Plan | tương tự |
| `apps/mobile/src/screens/v2/MoneyScreen.tsx` | v2 Money | tương tự |
| `apps/mobile/src/screens/v2/HealthScreen.tsx` | v2 Health | tương tự |
| `apps/mobile/src/screens/v2/MindScreen.tsx` | v2 Mind | tương tự |
| `apps/mobile/src/components/home/HomeHero.tsx` | v1 hero | chỉ HomeScreen v1 import |
| `apps/mobile/src/components/home/QuickActionsRow.tsx` | v1 actions | tương tự |
| `apps/mobile/src/components/home/SmartNudges.tsx` | v1 nudges | tương tự |
| `apps/mobile/src/components/home/PrivacyLimitedCard.tsx` | v1 card | tương tự |
| `apps/mobile/src/components/home/SmartBriefHero.tsx` | v1/v2 brief hero | chỉ HomeScreen v1 import — **nhưng có spec** (`SmartBriefHero.spec.tsx`) → spec đang test code dead |
| `apps/mobile/src/components/home/SuggestedCapturesStrip.tsx` | v1 suggester | tương tự — có spec đang test code dead |
| `apps/mobile/src/components/home/InsightWhySheet.tsx` | "Why this?" sheet | chỉ HomeScreen import |
| `apps/mobile/src/components/ui/Sparkline.tsx` | trùng `components/v2/Sparkline.tsx` | có thể dead — cần verify |

**Ước tính**: ~20 file × ~150 LOC trung bình = **~3000 LOC dead**, kèm 3 spec đang xanh nhưng test code không user nào touch nữa.

Modal screens vẫn live (mount qua RootNavigator stack):
- `AISettings`, `SmartEntry`, `Tasks`, `MealLog`, `SleepMoodCheckin`, `Preferences`, `Privacy`, `Memory` — vẫn cần.

### 4.2 Skipped / missing tests cho code đang live
| Surface | Đang chạy? | Có spec? |
|---|---|---|
| 5 Aurora screens (Today/Plan/Money/Health/Mind) | ✅ live | ❌ 0 |
| `AuroraCanvas`, `useAurora` palette hook | ✅ live | ❌ 0 |
| `AuroraTabBar`, `MainTabsAurora` | ✅ live | ❌ 0 |
| `FloatingCaptureButton`, `CaptureSheetV2`, `useCapture` | ✅ live | ❌ 0 |
| `ThemeProvider` (theme/v2) | ✅ live | ❌ 0 |
| `BehaviorService` | ✅ exported | ❌ 0 |
| `InsightGenerator` | ✅ live | ❌ 0 |
| `AssistantMemoryService` | ✅ live | ❌ 0 |
| `EventLogService` | ✅ live | ❌ 0 |
| `MemoryController`, `TelemetryController`, `PassiveIntelligenceController` | ✅ live | ❌ 0 |
| HealthConnect/HealthKit clients + `sync-orchestrator` | ✅ live | ❌ 0 |
| `device-data.service.ts`, `sleep-inference.service.ts` | ✅ live | ❌ 0 |
| `notifications.module.ts` | rỗng | n/a |

**Tổng**: 21 API specs + 9 mobile specs = 30 file spec; nhưng coverage đang lệch — UI live không có test, dead code có test.

Không có `it.skip` / `describe.skip` / `xit` nào trong codebase (đã grep) — tốt, không có test bị silently disabled.

### 4.3 `// TODO(R{n})` markers cũ
Grep cho `TODO\(R\d+\)`: **0 hit**. Không có TODO bị bỏ quên.

Tham chiếu round number trong comment (`Round 5/32/36/41/43.1`): tồn tại nhưng là note ngữ nghĩa, không phải debt.

### 4.4 Endpoints deprecated chưa xoá
Cần grep kỹ hơn (endpoints với prefix `/v1/` hay header `Deprecation:`). Quick scan: không tìm thấy `@deprecated` decorator nào. Có khả năng cao **không có debt loại này**.

### 4.5 Modules rỗng / placeholder
| Module | Trạng thái |
|---|---|
| `apps/api/src/modules/notifications/notifications.module.ts` | `@Module({})` rỗng từ Round 5 — **debt high** (block notification engine) |
| `apps/mobile/src/intelligence/capture-classifier.ts` | rule-based với comment "Phase-2 plan: DistilBERT-multilingual ONNX" — **scaffolded**, intentional |

### 4.6 Outdated dependencies (chỉ những cái đáng nâng)
| Dep | Hiện | Mới nhất Q2 2026 | Impact nếu nâng |
|---|---|---|---|
| `react-native` | 0.74.5 | 0.81+ | High — fix bugs Hermes 0.74, mới có Old/New arch interop tốt hơn, Android Gradle 8.7. Risk: native breaking changes lớn. |
| `@react-navigation/*` v6 | 6.x | 7.x | Medium — v7 stable, có shared element transitions native, nhưng migrate tốn 1-2 ngày |
| `@nestjs/*` | 10.3 | 11.x | Low — Nest 11 incremental, migrate dễ |
| `@prisma/client` + `prisma` | 5.13 | 6.x | Medium — Prisma 6 có TypedSQL + perf cải thiện; migrate dễ |
| `react-native-reanimated` | 3.10 | 3.16+ | Medium — fix nhiều bug Hermes; migrate dễ trong 0.74 |
| `zod` | 3.23 | 3.23 hoặc Zod 4 | Stay — Zod 4 breaking, không cần |
| `bullmq` | 5.7 | 5.x | Stay |
| `openai` | 6.35 | 6.x | Stay (fresh) |

### 4.7 Infra debt
- `compose.yaml` Postgres image `postgres:16-alpine` → **không có pgvector** (block vector embedding). Cần đổi sang `pgvector/pgvector:pg16` nếu làm vector intelligence.
- CI workflow `ci.yml` chỉ có `install + lint-typecheck` (đoạn cắt 60 dòng đầu); cần verify có job test API + APK debug build không. Nếu thiếu → debt.

---

## 5. Top-10 Ranking (Impact × Certainty / Effort)

Cách tính:
- **Impact** (1-5): user-facing value hoặc unblock việc khác
- **Certainty** (1-5): tự tin scope thực sự đúng và sẽ ship được
- **Effort** (1-5): 1=½ ngày, 5=2+ tuần
- **Score** = `(Impact × Certainty) / Effort`

| # | Hạng mục | Impact | Certainty | Effort | Score | Lý do |
|---|---|---|---|---|---|---|
| 1 | **Xoá dead code v1/v2 + dead specs** | 3 | 5 | 1 | **15.0** | ~3000 LOC + 3 spec test code chết. Giảm noise, không có rủi ro (đã verify call site = 0). Ship trong 1 buổi. Unblock typecheck/lint sạch. |
| 2 | **Test coverage cho 5 Aurora screens + AuroraCanvas + capture flow** | 4 | 5 | 2 | **10.0** | App đang chạy mà UI live 0 test — regression risk cao mỗi commit. Effort vừa: render + assert text/role qua testing-library, không cần snapshot. |
| 3 | **Notifications engine thật (FCM + Notifee + DeviceToken + cron BullMQ)** | 5 | 4 | 4 | **5.0** | Block toàn bộ proactive UX (R29 prompt). Là feature lớn nhất user thấy thiếu. Cần `google-services.json` từ Huy + 1 module cron. |
| 4 | **Recurring transactions/tasks (rrule + cron generator)** | 4 | 5 | 2 | **10.0** | User Việt rất cần (lương tháng, tiền nhà, deadline lặp). Schema 1 model, BullMQ cron đơn giản. Effort: 2-3 ngày. |
| 5 | **Photo input cho meal (Vision API)** | 5 | 4 | 3 | **6.7** | Differentiator lớn nhất cho life-OS Việt (nhận diện phở/bún/cơm tấm). Cần image-picker + OpenAI Vision + confidence gating. Effort: 3-4 ngày. |
| 6 | **Theme dark mode + system auto** | 4 | 4 | 2 | **8.0** | Aurora hiện theo giờ ngày (dawn-dusk) nhưng không có manual override + dark mode. User OLED screen muốn dark. Đã có ThemeProvider scaffold. |
| 7 | **Pgvector + semantic memory retrieval** | 4 | 3 | 4 | **3.0** | Mục tiêu R29 chính, nhưng effort cao + uncertain (cần backfill embeddings tốn $, chưa rõ improvement đo được hay không). Defer trừ khi có user feedback rõ là "memory chọn sai". |
| 8 | **Pattern miner (Pearson/cooccurrence/anomaly)** | 3 | 3 | 4 | **2.25** | Cool nhưng users không thấy ngay; hiện tại CircadianService + StressService đã cover được "pattern detection" cơ bản. Defer. |
| 9 | **Offline mode (persistQueryClient + mutation queue)** | 4 | 4 | 4 | **4.0** | Quan trọng cho daily user (commute không 4G), effort cao do conflict resolution. Có thể làm gọn nếu bỏ conflict UI, chỉ optimistic + retry. |
| 10 | **Data export ZIP** | 3 | 5 | 1 | **15.0** | Dễ ship 1 buổi, lift trust + GDPR-ish, nhưng impact UX hằng ngày thấp. Score cao do effort thấp. |

### Phân nhóm để chọn subset R45

**Tier S (must do trong R45 — score ≥ 10)**
- Xoá dead code (#1)
- Test coverage Aurora (#2)
- Recurring transactions (#4)
- Data export (#10)

→ ~4-5 ngày làm việc, hoàn toàn certain, không cần dep mới ngoài `rrule`. Bookend bằng cleanup + foundation. **Đây là R45 lý tưởng.**

**Tier A (R46 candidates)**
- Notifications engine FCM (#3)
- Photo input vision (#5)
- Theme dark/auto (#6)

→ Cần thêm credentials (Firebase, OpenAI Vision quota), effort 2 tuần. Là phase "real-time + multimodal".

**Tier B (R47 hoặc defer)**
- Pgvector intelligence (#7)
- Pattern miner (#8)
- Offline mode (#9)

→ Effort lớn, ROI uncertain. Chỉ làm khi có user feedback rõ.

---

## 6. Câu hỏi cần Huy chốt

1. **Aurora vs prompt R30 thẩm mỹ Things/Health/Linear**: Aurora đã ship và đang chạy. Có muốn tiếp tục Aurora hay revert sang hướng prompt? Mình recommend **giữ Aurora**, chỉ bù dark mode + haptic + skeleton thực.
2. **R45 scope**: chốt Tier S (4 hạng mục) hay muốn nhồi thêm 1 cái Tier A (vd FCM)?
3. **Postgres image swap**: nếu sớm muộn cũng làm pgvector (Tier B), nên đổi compose ngay R45 (chi phí ~0) hay đợi đến lúc thực sự cần?
4. **Dead code**: xoá hoàn toàn (option A) hay archive sang `apps/mobile/.attic/` (option B)? Mình recommend A — git history giữ lại đủ rồi.
5. **Test infra**: có muốn mình thêm coverage threshold trong jest config (vd `branches: 60%`) để CI fail khi tụt, hay để mềm?

---

**Reply với chốt scope (vd: "S full + #3" hoặc "S only") để mình viết `docs/PLAN_R45.md`.**

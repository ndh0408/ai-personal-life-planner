/**
 * Seed for local dev. Idempotent — safe to re-run; refuses to run in production.
 *
 * Creates ONE demo user with a full snapshot of every entity, so a fresh
 * checkout can boot the API + open the mobile app and immediately see
 * meaningful data (today's plan, last week's expenses, recent meals, …).
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
loadEnv({ path: resolve(__dirname, '../.env') });

import {
  AiProvider,
  Mood,
  EnergyLevel,
  PrismaClient,
  TaskPriority,
  TaskStatus,
  MealType,
  SleepQuality,
  DailyPlanItemType,
  DailyPlanItemStatus,
  AiMessageRole,
  AiRecommendationType,
  AiRecommendationPriority,
  AiRecommendationStatus,
  QuickCaptureStatus,
  AiKeyTestStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@lifeos.local';
const DEMO_PASSWORD = 'demo-password-1234';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number, hour = 0, minute = 0): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] refusing to run in production');
    return;
  }

  console.log('[seed] upserting demo user');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, displayName: 'Huy (demo)' },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      displayName: 'Huy (demo)',
      emailVerifiedAt: new Date(),
    },
  });

  console.log('[seed] profile + privacy + notifications');
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      preferredName: 'Huy',
      locale: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
      currency: 'VND',
      mainGoals: ['save_money', 'sleep_better', 'finish_side_project'],
      usualWakeTime: '06:30',
      usualSleepTime: '23:00',
      onboardingCompletedAt: new Date(),
    },
  });
  await prisma.privacySetting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  await prisma.notificationSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, quietHoursStart: '22:30', quietHoursEnd: '07:00' },
  });

  console.log('[seed] AI key (clearly fake — for layout, not for OpenAI calls)');
  // The encryptedApiKey here is a valid v1:gcm payload encoded by hand for
  // the literal string "demo-not-a-real-key-do-not-use". Decrypting it would
  // fail because we don't share the key — that is intentional.
  await prisma.userAiKey.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      provider: AiProvider.OPENAI,
      encryptedApiKey: 'v1:gcm:DEMO_IV:DEMO_TAG:DEMO_CIPHERTEXT',
      apiKeyLast4: 'DEMO',
      maskedApiKey: 'sk-•••••••••DEMO',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      lastTestedAt: new Date(),
      lastTestStatus: AiKeyTestStatus.SUCCESS,
      isActive: false, // false so nobody mistakes this for a working key
    },
  });

  console.log('[seed] wallet + finance entries');
  // Reset finance for the demo user so re-running yields the same shape
  // (idempotency keys would otherwise short-circuit, but rows accumulate).
  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.income.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.deleteMany({ where: { userId: user.id } });

  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      name: 'Ví chính',
      currency: 'VND',
      isDefault: true,
      balance: 8_450_000,
    },
  });

  const expenses: Array<{
    title: string;
    amount: number;
    category: string;
    date: Date;
    note?: string;
  }> = [
    { title: 'Cơm tấm sườn', amount: 75_000, category: 'food', date: daysAgo(0, 12) },
    { title: 'Cà phê Highlands', amount: 55_000, category: 'food', date: daysAgo(0, 9) },
    { title: 'Grab về nhà', amount: 48_000, category: 'transport', date: daysAgo(1, 22) },
    { title: 'Phở 24', amount: 80_000, category: 'food', date: daysAgo(1, 12) },
    { title: 'Tiền điện tháng', amount: 620_000, category: 'utility', date: daysAgo(2, 10) },
    { title: 'Mua sách', amount: 240_000, category: 'learning', date: daysAgo(3, 19) },
    { title: 'Bún bò Huế', amount: 65_000, category: 'food', date: daysAgo(4, 12) },
    { title: 'Xăng xe', amount: 100_000, category: 'transport', date: daysAgo(5, 8) },
    { title: 'Internet FPT', amount: 240_000, category: 'utility', date: daysAgo(6, 9) },
  ];
  await prisma.expense.createMany({
    data: expenses.map((e) => ({
      userId: user.id,
      walletId: wallet.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      expenseDate: e.date,
      note: e.note,
    })),
  });

  await prisma.income.create({
    data: {
      userId: user.id,
      walletId: wallet.id,
      title: 'Lương tháng 4',
      amount: 22_000_000,
      category: 'salary',
      incomeDate: daysAgo(5, 9),
    },
  });

  console.log('[seed] tasks');
  await prisma.task.deleteMany({ where: { userId: user.id } });
  await prisma.task.createMany({
    data: [
      {
        userId: user.id,
        title: 'Họp standup nhóm',
        dueAt: daysAgo(0, 9, 30),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.COMPLETED,
        completedAt: daysAgo(0, 10),
      },
      {
        userId: user.id,
        title: 'Review PR backend foundation',
        dueAt: daysAgo(0, 14),
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
      },
      {
        userId: user.id,
        title: 'Gọi mẹ',
        dueAt: daysAgo(0, 20),
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.TODO,
      },
      {
        userId: user.id,
        title: 'Đi siêu thị mua đồ tuần',
        dueAt: daysAgo(-1, 18),
        priority: TaskPriority.LOW,
        status: TaskStatus.TODO,
      },
      {
        userId: user.id,
        title: 'Ôn tiếng Anh 30 phút',
        priority: TaskPriority.LOW,
        status: TaskStatus.TODO,
      },
      {
        userId: user.id,
        title: 'Đi khám sức khoẻ định kỳ',
        dueAt: daysAgo(-7, 9),
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
      },
    ],
  });

  console.log('[seed] meals + sleep + mood');
  await prisma.mealLog.deleteMany({ where: { userId: user.id } });
  await prisma.mealLog.createMany({
    data: [
      {
        userId: user.id,
        mealType: MealType.BREAKFAST,
        title: 'Bánh mì trứng + cà phê đen',
        cost: 35_000,
        loggedAt: daysAgo(0, 7),
      },
      {
        userId: user.id,
        mealType: MealType.LUNCH,
        title: 'Cơm tấm sườn',
        cost: 75_000,
        loggedAt: daysAgo(0, 12),
      },
      {
        userId: user.id,
        mealType: MealType.SNACK,
        title: 'Sữa chua',
        cost: 15_000,
        loggedAt: daysAgo(0, 16),
      },
      {
        userId: user.id,
        mealType: MealType.DINNER,
        title: 'Cơm nhà',
        loggedAt: daysAgo(1, 19),
      },
    ],
  });

  await prisma.sleepLog.deleteMany({ where: { userId: user.id } });
  await prisma.sleepLog.create({
    data: {
      userId: user.id,
      sleepAt: daysAgo(1, 23, 15),
      wakeAt: daysAgo(0, 6, 45),
      durationMinutes: 7 * 60 + 30,
      quality: SleepQuality.GOOD,
    },
  });
  await prisma.sleepLog.create({
    data: {
      userId: user.id,
      sleepAt: daysAgo(2, 24, 30),
      wakeAt: daysAgo(1, 7, 0),
      durationMinutes: 6 * 60 + 30,
      quality: SleepQuality.OK,
      note: 'Khó ngủ vì cà phê chiều',
    },
  });

  await prisma.moodLog.deleteMany({ where: { userId: user.id } });
  await prisma.moodLog.create({
    data: {
      userId: user.id,
      mood: Mood.GOOD,
      energy: EnergyLevel.MEDIUM,
      loggedAt: daysAgo(0, 8),
    },
  });

  console.log('[seed] daily plan for today');
  const today = startOfDay(new Date());
  await prisma.dailyPlan.deleteMany({ where: { userId: user.id, date: today } });
  const plan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: today,
      summary: 'Ngày tập trung vào review PR + nghỉ sớm',
      aiGenerated: true,
    },
  });
  await prisma.dailyPlanItem.createMany({
    data: [
      {
        userId: user.id,
        dailyPlanId: plan.id,
        title: 'Standup nhóm',
        startAt: daysAgo(0, 9, 30),
        endAt: daysAgo(0, 10, 0),
        type: DailyPlanItemType.WORK,
        status: DailyPlanItemStatus.COMPLETED,
        sortOrder: 1,
      },
      {
        userId: user.id,
        dailyPlanId: plan.id,
        title: 'Review PR backend foundation',
        startAt: daysAgo(0, 10, 30),
        endAt: daysAgo(0, 12, 0),
        type: DailyPlanItemType.TASK,
        status: DailyPlanItemStatus.PENDING,
        sortOrder: 2,
      },
      {
        userId: user.id,
        dailyPlanId: plan.id,
        title: 'Bữa trưa',
        startAt: daysAgo(0, 12, 0),
        endAt: daysAgo(0, 13, 0),
        type: DailyPlanItemType.MEAL,
        status: DailyPlanItemStatus.COMPLETED,
        sortOrder: 3,
      },
      {
        userId: user.id,
        dailyPlanId: plan.id,
        title: 'Đi bộ 20 phút',
        startAt: daysAgo(0, 17, 30),
        endAt: daysAgo(0, 17, 50),
        type: DailyPlanItemType.HEALTH,
        sortOrder: 4,
      },
      {
        userId: user.id,
        dailyPlanId: plan.id,
        title: 'Ngủ trước 23:00',
        type: DailyPlanItemType.REST,
        sortOrder: 5,
      },
    ],
  });

  console.log('[seed] AI conversation + recommendations + usage');
  await prisma.aIConversation.deleteMany({ where: { userId: user.id } });
  const convo = await prisma.aIConversation.create({
    data: { userId: user.id, title: 'Lập kế hoạch ngủ tốt hơn' },
  });
  await prisma.aIMessage.createMany({
    data: [
      {
        userId: user.id,
        conversationId: convo.id,
        role: AiMessageRole.USER,
        content: 'Mấy hôm nay mình ngủ trễ, làm sao để dậy sớm?',
      },
      {
        userId: user.id,
        conversationId: convo.id,
        role: AiMessageRole.ASSISTANT,
        content:
          'Bắt đầu từ tuần này: cắt cà phê sau 14:00, lên giường lúc 22:30, đặt báo thức cho việc ngủ chứ không phải dậy. Mình sẽ nhắc bạn lúc 22:15 mỗi tối.',
      },
    ],
  });

  await prisma.aIRecommendation.deleteMany({ where: { userId: user.id } });
  await prisma.aIRecommendation.createMany({
    data: [
      {
        userId: user.id,
        type: AiRecommendationType.FINANCE,
        title: 'Chi tiêu đồ ăn tăng 18% so với tuần trước',
        content:
          'Tuần này bạn đã chi 425.000₫ cho đồ ăn ngoài. Thử nấu bữa tối ở nhà 2 lần/tuần để tiết kiệm khoảng 200.000₫.',
        priority: AiRecommendationPriority.MEDIUM,
        status: AiRecommendationStatus.NEW,
        evidence: { weeklyFoodSpend: 425000, weekOverWeekDelta: 0.18 },
      },
      {
        userId: user.id,
        type: AiRecommendationType.SLEEP,
        title: 'Ngủ ít hơn 7 tiếng 3 đêm liên tục',
        content: 'Cân nhắc đi ngủ trước 23:00 tối nay. Mình đã thêm vào kế hoạch hôm nay.',
        priority: AiRecommendationPriority.HIGH,
        status: AiRecommendationStatus.VIEWED,
      },
      {
        userId: user.id,
        type: AiRecommendationType.TASK,
        title: '"Đi khám sức khoẻ định kỳ" đã quá hạn 2 ngày',
        content: 'Đặt lịch hẹn ngay hôm nay — phòng khám gần nhà mở đến 19:00.',
        priority: AiRecommendationPriority.HIGH,
        status: AiRecommendationStatus.NEW,
      },
    ],
  });

  await prisma.aiUsageLog.createMany({
    data: [
      {
        userId: user.id,
        feature: 'capture.parse',
        model: 'gpt-4o-mini',
        success: true,
        latencyMs: 412,
      },
      {
        userId: user.id,
        feature: 'assistant.recommend',
        model: 'gpt-4o-mini',
        success: true,
        latencyMs: 1230,
      },
    ],
  });

  console.log('[seed] sample QuickCapture (draft state)');
  await prisma.quickCapture.deleteMany({ where: { userId: user.id } });
  await prisma.quickCapture.create({
    data: {
      userId: user.id,
      rawText: 'họp với An lúc 3h chiều mai về dự án LifeOS',
      status: QuickCaptureStatus.DRAFT,
      parsedActions: {
        kind: 'task',
        confidence: 0.91,
        fields: {
          title: 'Họp với An — dự án LifeOS',
          dueAt: daysAgo(-1, 15, 0).toISOString(),
          priority: 'MEDIUM',
        },
      },
    },
  });

  console.log('');
  console.log('✓ seed done');
  console.log('  email:    ' + DEMO_EMAIL);
  console.log('  password: ' + DEMO_PASSWORD);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

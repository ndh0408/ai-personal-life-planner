/**
 * Seed: a fully-populated demo account so devs can poke at every model
 * without manually crafting requests.
 *
 *   demo@planner.local / demo1234
 */
import {
  PrismaClient,
  UserRole,
  UserStatus,
  MainGoal,
  ActivityLevel,
  EnergyLevel,
  Mood,
  DailyScheduleStatus,
  ScheduleItemType,
  Priority,
  ScheduleItemStatus,
  TaskStatus,
  HabitFrequency,
  MealType,
  SleepQuality,
  StressLevel,
  AIMessageRole,
  AIRecommendationStatus,
  NotificationPlatform,
  NotificationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@planner.local';
const DEMO_PASSWORD = 'demo1234';

function timeOnly(hour: number, minute = 0): Date {
  // Prisma maps DateTime @db.Time to a Date whose date part is ignored.
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0));
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateAt(hour: number, minute = 0): Date {
  const today = todayDateOnly();
  return new Date(today.getTime() + (hour * 60 + minute) * 60_000);
}

function daysAgo(n: number): Date {
  const d = todayDateOnly();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  console.log('Seeding demo data...');

  // ---- Wipe demo user (idempotent) -------------------------------------------
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // ---- 1. User --------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      displayName: 'Demo User',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`  user        ${user.email}`);

  // ---- 2. UserProfile -------------------------------------------------------
  await prisma.userProfile.create({
    data: {
      userId: user.id,
      fullName: 'Nguyen Demo User',
      age: 28,
      gender: 'male',
      heightCm: 172,
      weightKg: 68,
      occupation: 'Software Engineer',
      workStartTime: timeOnly(9, 0),
      workEndTime: timeOnly(18, 0),
      usualWakeTime: timeOnly(6, 30),
      usualSleepTime: timeOnly(23, 0),
      mainGoal: MainGoal.PRODUCTIVE,
      activityLevel: ActivityLevel.MEDIUM,
      dietaryPreference: 'high-protein',
      healthNotes: 'Mild back pain, prefers standing desk after lunch.',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  });
  console.log('  profile     ok');

  // ---- 3. NotificationSetting ----------------------------------------------
  await prisma.notificationSetting.create({
    data: {
      userId: user.id,
      quietHoursStart: timeOnly(22, 30),
      quietHoursEnd: timeOnly(6, 0),
    },
  });
  console.log('  notif-set   ok');

  // ---- 4. NotificationDevice -----------------------------------------------
  await prisma.notificationDevice.create({
    data: {
      userId: user.id,
      platform: NotificationPlatform.ANDROID,
      pushToken: 'ExponentPushToken[demo-android-token]',
      deviceName: 'Pixel 8 (demo)',
    },
  });
  console.log('  device      android demo');

  // ---- 5. DailySchedule + ScheduleItem (today) -----------------------------
  const schedule = await prisma.dailySchedule.create({
    data: {
      userId: user.id,
      date: todayDateOnly(),
      wakeUpTime: timeOnly(6, 30),
      sleepTime: timeOnly(23, 0),
      summary: 'Focused workday with deep-work morning and lighter afternoon.',
      energyLevel: EnergyLevel.MEDIUM,
      mood: Mood.MOTIVATED,
      aiGenerated: true,
      status: DailyScheduleStatus.ACTIVE,
    },
  });

  const items: Array<Parameters<typeof prisma.scheduleItem.create>[0]['data']> = [
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Wake up + light stretch',
      startTime: dateAt(6, 30),
      endTime: dateAt(6, 45),
      type: ScheduleItemType.REST,
      priority: Priority.LOW,
      status: ScheduleItemStatus.COMPLETED,
      sortOrder: 0,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Breakfast',
      startTime: dateAt(7, 0),
      endTime: dateAt(7, 30),
      type: ScheduleItemType.MEAL,
      priority: Priority.MEDIUM,
      status: ScheduleItemStatus.COMPLETED,
      sortOrder: 1,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Deep work: API schema design',
      description: 'No meetings. Phone on Do Not Disturb.',
      startTime: dateAt(9, 0),
      endTime: dateAt(11, 30),
      type: ScheduleItemType.WORK,
      priority: Priority.HIGH,
      status: ScheduleItemStatus.PENDING,
      aiGenerated: true,
      reason: 'Highest energy slot per profile + free calendar',
      sortOrder: 2,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Lunch + short walk',
      startTime: dateAt(12, 0),
      endTime: dateAt(13, 0),
      type: ScheduleItemType.MEAL,
      priority: Priority.MEDIUM,
      status: ScheduleItemStatus.PENDING,
      sortOrder: 3,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Code review + meetings',
      startTime: dateAt(14, 0),
      endTime: dateAt(17, 0),
      type: ScheduleItemType.WORK,
      priority: Priority.MEDIUM,
      status: ScheduleItemStatus.PENDING,
      sortOrder: 4,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Gym (push day)',
      startTime: dateAt(18, 30),
      endTime: dateAt(19, 30),
      type: ScheduleItemType.EXERCISE,
      priority: Priority.HIGH,
      status: ScheduleItemStatus.PENDING,
      aiGenerated: true,
      reason: 'Activity goal: 3 workouts / week',
      sortOrder: 5,
    },
    {
      scheduleId: schedule.id,
      userId: user.id,
      title: 'Wind-down + reading',
      startTime: dateAt(22, 0),
      endTime: dateAt(22, 45),
      type: ScheduleItemType.REST,
      priority: Priority.LOW,
      status: ScheduleItemStatus.PENDING,
      sortOrder: 6,
    },
  ];
  for (const data of items) {
    await prisma.scheduleItem.create({ data });
  }
  console.log(`  schedule    today + ${items.length} items`);

  // ---- 6. Tasks -------------------------------------------------------------
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        userId: user.id,
        title: 'Finalize Prisma schema',
        description: 'Review with team, lock v1.',
        priority: Priority.HIGH,
        estimatedMinutes: 90,
        status: TaskStatus.IN_PROGRESS,
        category: 'work',
        dueDate: dateAt(11, 30),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: 'Pay electricity bill',
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
        category: 'personal',
        dueDate: dateAt(20, 0),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: 'Read 20 pages of Atomic Habits',
        priority: Priority.LOW,
        estimatedMinutes: 30,
        status: TaskStatus.TODO,
        category: 'self',
        dueDate: dateAt(22, 30),
      },
    }),
    prisma.task.create({
      data: {
        userId: user.id,
        title: 'Reply to design doc comments',
        priority: Priority.MEDIUM,
        status: TaskStatus.COMPLETED,
        category: 'work',
        completedAt: new Date(),
      },
    }),
  ]);
  console.log(`  tasks       ${tasks.length}`);

  // ---- 7. Habits + HabitLog -------------------------------------------------
  const drinkWater = await prisma.habit.create({
    data: {
      userId: user.id,
      name: 'Drink 8 glasses of water',
      description: 'Track every glass.',
      frequency: HabitFrequency.DAILY,
      targetCount: 8,
      color: '#22D3EE',
      icon: 'droplet',
    },
  });
  const meditate = await prisma.habit.create({
    data: {
      userId: user.id,
      name: 'Meditate 10 min',
      frequency: HabitFrequency.DAILY,
      targetCount: 1,
      color: '#A78BFA',
      icon: 'lotus',
    },
  });
  const workout = await prisma.habit.create({
    data: {
      userId: user.id,
      name: 'Workout',
      frequency: HabitFrequency.WEEKLY,
      targetCount: 3,
      color: '#F87171',
      icon: 'dumbbell',
    },
  });

  // 7 days of logs for water + meditation
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(i);
    await prisma.habitLog.create({
      data: {
        habitId: drinkWater.id,
        userId: user.id,
        date: d,
        completed: i % 3 !== 0,
        count: i % 3 === 0 ? 5 : 8,
      },
    });
    await prisma.habitLog.create({
      data: {
        habitId: meditate.id,
        userId: user.id,
        date: d,
        completed: i !== 1,
        count: i !== 1 ? 1 : 0,
      },
    });
  }
  // 2 workout logs this week
  for (const i of [1, 4]) {
    await prisma.habitLog.create({
      data: {
        habitId: workout.id,
        userId: user.id,
        date: daysAgo(i),
        completed: true,
        count: 1,
        note: 'push day',
      },
    });
  }
  console.log('  habits      3 + 7d logs');

  // ---- 8. MealPlan + MealSuggestion (today) --------------------------------
  const mealPlan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      date: todayDateOnly(),
      goal: 'High protein, ~2200 kcal',
      budget: '~150k VND',
      availableIngredients: ['eggs', 'oats', 'chicken breast', 'rice', 'broccoli', 'banana'],
      notes: 'Avoid heavy carbs after 7pm.',
    },
  });
  const suggestions: Array<Parameters<typeof prisma.mealSuggestion.create>[0]['data']> = [
    {
      mealPlanId: mealPlan.id,
      userId: user.id,
      mealType: MealType.BREAKFAST,
      title: 'Oats + scrambled eggs + banana',
      description: 'Quick, balanced macros.',
      ingredients: ['oats 60g', 'eggs x2', 'banana x1', 'milk 200ml'],
      estimatedCalories: 520,
      prepTimeMinutes: 10,
      reason: 'Matches "high-protein" preference and fast prep before standup.',
    },
    {
      mealPlanId: mealPlan.id,
      userId: user.id,
      mealType: MealType.LUNCH,
      title: 'Grilled chicken + brown rice + broccoli',
      ingredients: ['chicken breast 180g', 'brown rice 120g', 'broccoli 150g', 'olive oil 1 tsp'],
      estimatedCalories: 720,
      prepTimeMinutes: 25,
    },
    {
      mealPlanId: mealPlan.id,
      userId: user.id,
      mealType: MealType.SNACK,
      title: 'Greek yogurt + nuts',
      ingredients: ['Greek yogurt 200g', 'mixed nuts 25g'],
      estimatedCalories: 320,
      prepTimeMinutes: 2,
    },
    {
      mealPlanId: mealPlan.id,
      userId: user.id,
      mealType: MealType.DINNER,
      title: 'Chicken + roasted veggies',
      ingredients: ['chicken breast 150g', 'mixed veggies 200g', 'olive oil 1 tsp'],
      estimatedCalories: 580,
      prepTimeMinutes: 25,
      healthNote: 'Light carbs after 7pm per profile note.',
    },
  ];
  for (const data of suggestions) {
    await prisma.mealSuggestion.create({ data });
  }
  console.log(`  meals       plan + ${suggestions.length} suggestions`);

  // ---- 9. SleepLog (last 5 days) -------------------------------------------
  const sleeps: Array<{ days: number; hourSlept: number; hourWoke: number; q: SleepQuality }> = [
    { days: 1, hourSlept: 23, hourWoke: 6, q: SleepQuality.GOOD },
    { days: 2, hourSlept: 24, hourWoke: 6, q: SleepQuality.NORMAL },
    { days: 3, hourSlept: 22, hourWoke: 6, q: SleepQuality.VERY_GOOD },
    { days: 4, hourSlept: 25, hourWoke: 7, q: SleepQuality.BAD },
    { days: 5, hourSlept: 23, hourWoke: 6, q: SleepQuality.GOOD },
  ];
  for (const s of sleeps) {
    const date = daysAgo(s.days);
    const sleepTime = new Date(date.getTime() + s.hourSlept * 3_600_000);
    const wakeTime = new Date(date.getTime() + (24 + s.hourWoke) * 3_600_000);
    const durationMinutes = Math.round((wakeTime.getTime() - sleepTime.getTime()) / 60_000);
    await prisma.sleepLog.create({
      data: {
        userId: user.id,
        date,
        sleepTime,
        wakeTime,
        durationMinutes,
        quality: s.q,
      },
    });
  }
  console.log(`  sleep       ${sleeps.length} logs`);

  // ---- 10. MoodLog (last 5 days) -------------------------------------------
  const moods: Array<{ days: number; mood: Mood; e: EnergyLevel; s: StressLevel }> = [
    { days: 1, mood: Mood.MOTIVATED, e: EnergyLevel.HIGH, s: StressLevel.LOW },
    { days: 2, mood: Mood.NORMAL, e: EnergyLevel.MEDIUM, s: StressLevel.MEDIUM },
    { days: 3, mood: Mood.HAPPY, e: EnergyLevel.HIGH, s: StressLevel.LOW },
    { days: 4, mood: Mood.TIRED, e: EnergyLevel.LOW, s: StressLevel.HIGH },
    { days: 5, mood: Mood.NORMAL, e: EnergyLevel.MEDIUM, s: StressLevel.MEDIUM },
  ];
  for (const m of moods) {
    await prisma.moodLog.create({
      data: {
        userId: user.id,
        date: daysAgo(m.days),
        mood: m.mood,
        energyLevel: m.e,
        stressLevel: m.s,
      },
    });
  }
  console.log(`  mood        ${moods.length} logs`);

  // ---- 11. AIConversation + AIMessage --------------------------------------
  const conv = await prisma.aIConversation.create({
    data: {
      userId: user.id,
      title: 'Plan tomorrow',
      contextType: 'daily-plan',
    },
  });
  await prisma.aIMessage.createMany({
    data: [
      {
        conversationId: conv.id,
        userId: user.id,
        role: AIMessageRole.SYSTEM,
        content: 'You are a personal life planner. Be concise and pragmatic.',
      },
      {
        conversationId: conv.id,
        userId: user.id,
        role: AIMessageRole.USER,
        content: 'Plan my tomorrow — meeting from 14:00, gym after work.',
      },
      {
        conversationId: conv.id,
        userId: user.id,
        role: AIMessageRole.ASSISTANT,
        content:
          'Suggested: deep work 9–11:30, lunch 12, meeting 14, gym 18:30. Light dinner at 20.',
        metadata: { tokens: 178, model: 'claude-sonnet-4-6' },
      },
    ],
  });
  console.log('  ai          conversation + 3 messages');

  // ---- 12. AIRecommendation ------------------------------------------------
  await prisma.aIRecommendation.createMany({
    data: [
      {
        userId: user.id,
        type: 'sleep',
        title: 'Sleep 30 min earlier tonight',
        content: 'Avg sleep last 5 days dipped to 6h45. Aim for 22:30 lights-out.',
        priority: Priority.HIGH,
        status: AIRecommendationStatus.NEW,
      },
      {
        userId: user.id,
        type: 'task',
        title: 'Move "Read Atomic Habits" to morning',
        content: 'You skip evening reading. Try a 20-min morning slot after breakfast.',
        priority: Priority.MEDIUM,
        status: AIRecommendationStatus.VIEWED,
      },
    ],
  });
  console.log('  ai-recs     2');

  // ---- 13. NotificationLog -------------------------------------------------
  await prisma.notificationLog.createMany({
    data: [
      {
        userId: user.id,
        title: 'Morning routine',
        body: 'Wake up + stretch (6:30)',
        type: 'wake',
        scheduledAt: dateAt(6, 30),
        sentAt: dateAt(6, 30),
        status: NotificationStatus.SENT,
      },
      {
        userId: user.id,
        title: 'Hydration reminder',
        body: 'Glass #4 of water',
        type: 'habit',
        scheduledAt: dateAt(14, 0),
        status: NotificationStatus.PENDING,
      },
    ],
  });
  console.log('  notif-log   2');

  console.log(`\nDone. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

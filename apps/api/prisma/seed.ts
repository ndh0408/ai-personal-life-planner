/**
 * LifeOS AI seed — a fully-populated demo account spanning every domain so
 * developers can poke at every screen/endpoint without crafting payloads.
 *
 *   demo@planner.local / demo1234   (seed email preserved across rebrand for
 *                                     test-flow compatibility — see memory).
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
  WalletType,
  NeedLevel,
  BudgetPeriod,
  DebtType,
  DebtStatus,
  SavingGoalStatus,
  GoalCategory,
  PersonalGoalStatus,
  MilestoneStatus,
  AIMessageRole,
  AIRecommendationType,
  AIRecommendationStatus,
  NotificationPlatform,
  NotificationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@planner.local';
const DEMO_PASSWORD = 'demo1234';

// ---- helpers ---------------------------------------------------------------

function timeOnly(hour: number, minute = 0): Date {
  // Prisma maps DateTime @db.Time(0) to a Date whose date part is ignored.
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

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
}

function currentMonthTag(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mondayOfCurrentWeek(): Date {
  const d = todayDateOnly();
  const dayOfWeek = d.getUTCDay() || 7; // Sunday = 7 instead of 0
  d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  return d;
}

// ---- main ------------------------------------------------------------------

async function main() {
  // Round-15 production guard. The demo seed wipes the demo user's graph and
  // creates throwaway data — never something we want to run by accident
  // against a production DB. Operators that genuinely need to seed a fresh
  // production env (e.g. for a smoke test on a brand-new staging) can opt
  // in by setting ALLOW_SEED_IN_PRODUCTION=true.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SEED_IN_PRODUCTION !== 'true'
  ) {
    console.error(
      '[seed] Refusing to run in production. Set ALLOW_SEED_IN_PRODUCTION=true to override.',
    );
    process.exit(2);
  }
  console.log('Seeding LifeOS AI demo data...');

  // Idempotent: wipe the demo user's entire graph (cascade FKs handle the rest).
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // -------------------------------------------------------------------- 1. User
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

  // ------------------------------------------------------------- 2. UserProfile
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
      mainGoal: MainGoal.FINANCIAL_STABILITY,
      activityLevel: ActivityLevel.MEDIUM,
      dietaryPreference: 'high-protein',
      healthNotes: 'Mild back pain, prefers standing desk after lunch.',
      monthlySalary: 25_000_000,
      salaryDay: 5,
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi',
    },
  });
  console.log('  profile     ok (locale=vi, salary=25m VND)');

  // -------------------------------------------------------- 3. NotificationSetting
  await prisma.notificationSetting.create({
    data: {
      userId: user.id,
      quietHoursStart: timeOnly(22, 30),
      quietHoursEnd: timeOnly(6, 0),
    },
  });
  console.log('  notif-set   ok');

  // --------------------------------------------------------- 4. NotificationDevice
  await prisma.notificationDevice.create({
    data: {
      userId: user.id,
      platform: NotificationPlatform.ANDROID,
      pushToken: 'ExponentPushToken[demo-android-token]',
      deviceName: 'Pixel 8 (demo)',
    },
  });
  console.log('  device      android demo');

  // -------------------------------------------- 5. DailySchedule + ScheduleItem
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
      title: 'Review monthly budget',
      description: 'Check spending vs budget for the week.',
      startTime: dateAt(13, 0),
      endTime: dateAt(13, 15),
      type: ScheduleItemType.FINANCE,
      priority: Priority.MEDIUM,
      status: ScheduleItemStatus.PENDING,
      aiGenerated: true,
      reason: 'Weekly finance check — ties to FINANCIAL_STABILITY goal.',
      sortOrder: 4,
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
      sortOrder: 5,
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
      sortOrder: 6,
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
      sortOrder: 7,
    },
  ];
  for (const data of items) {
    await prisma.scheduleItem.create({ data });
  }
  console.log(`  schedule    today + ${items.length} items`);

  // ------------------------------------------------------------------ 6. Tasks
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
        category: 'finance',
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

  // --------------------------------------------------------- 7. Habits + logs
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

  // ---------------------------------- 8. MealPlan + MealSuggestion + MealLog
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

  // Actual meals eaten today + yesterday (tracks vs plan)
  await prisma.mealLog.createMany({
    data: [
      {
        userId: user.id,
        date: todayDateOnly(),
        mealType: MealType.BREAKFAST,
        title: 'Oats + eggs + banana',
        estimatedCalories: 520,
        cost: 45_000,
      },
      {
        userId: user.id,
        date: daysAgo(1),
        mealType: MealType.DINNER,
        title: 'Phở bò (eat-out)',
        note: 'Skipped home-cooked plan.',
        estimatedCalories: 650,
        cost: 60_000,
      },
    ],
  });
  console.log(`  meals       plan + ${suggestions.length} suggestions + 2 logs`);

  // --------------------------------------------------------- 9. SleepLog (5d)
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
      data: { userId: user.id, date, sleepTime, wakeTime, durationMinutes, quality: s.q },
    });
  }
  console.log(`  sleep       ${sleeps.length} logs`);

  // -------------------------------------------------------- 10. MoodLog (5d)
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

  // -------------------------------------------------- 11. HealthMetric (5d)
  for (let i = 1; i <= 5; i++) {
    await prisma.healthMetric.create({
      data: {
        userId: user.id,
        date: daysAgo(i),
        weightKg: 68 - i * 0.1,
        waterIntakeMl: 1800 + (i % 3) * 200,
        steps: 6500 + (i % 4) * 800,
        exerciseMinutes: i === 1 || i === 4 ? 60 : 0,
      },
    });
  }
  console.log('  health      5 metrics');

  // ============================================================================
  // Finance — the LifeOS AI differentiator from plain planners.
  // ============================================================================

  // --------------------------------------------------------------- 12. Wallet
  const cashWallet = await prisma.wallet.create({
    data: { userId: user.id, name: 'Cash', type: WalletType.CASH, balance: 1_200_000 },
  });
  const bankWallet = await prisma.wallet.create({
    data: { userId: user.id, name: 'Vietcombank', type: WalletType.BANK, balance: 18_500_000 },
  });
  const savingsWallet = await prisma.wallet.create({
    data: { userId: user.id, name: 'Savings', type: WalletType.SAVINGS, balance: 30_000_000 },
  });
  const momo = await prisma.wallet.create({
    data: { userId: user.id, name: 'Momo', type: WalletType.EWALLET, balance: 450_000 },
  });
  console.log('  wallets     4 (cash, bank, savings, momo)');

  // ---------------------------------------------------------- 13. Income (salary)
  await prisma.income.create({
    data: {
      userId: user.id,
      walletId: bankWallet.id,
      title: 'Monthly salary',
      amount: 25_000_000,
      category: 'salary',
      source: 'Company ABC',
      incomeDate: new Date(Date.UTC(startOfCurrentMonth().getUTCFullYear(), startOfCurrentMonth().getUTCMonth(), 5)),
      isRecurring: true,
      recurringRule: 'monthly-on-5th',
    },
  });
  await prisma.income.create({
    data: {
      userId: user.id,
      walletId: bankWallet.id,
      title: 'Freelance: landing page',
      amount: 4_500_000,
      category: 'freelance',
      incomeDate: daysAgo(8),
    },
  });
  console.log('  incomes     2 (salary + freelance)');

  // --------------------------------------------------------- 14. Expenses
  const expenseData: Array<Parameters<typeof prisma.expense.create>[0]['data']> = [
    { userId: user.id, walletId: bankWallet.id, title: 'Rent', amount: 6_000_000, category: 'housing', expenseDate: startOfCurrentMonth(), needLevel: NeedLevel.NEED, paymentMethod: 'bank-transfer' },
    { userId: user.id, walletId: bankWallet.id, title: 'Electricity', amount: 480_000, category: 'utilities', expenseDate: daysAgo(3), needLevel: NeedLevel.NEED },
    { userId: user.id, walletId: momo.id, title: 'Grab to airport', amount: 180_000, category: 'transport', expenseDate: daysAgo(5), needLevel: NeedLevel.NEED },
    { userId: user.id, walletId: cashWallet.id, title: 'Groceries', amount: 520_000, category: 'food', expenseDate: daysAgo(2), needLevel: NeedLevel.NEED },
    { userId: user.id, walletId: momo.id, title: 'Coffee shop', amount: 65_000, category: 'food', expenseDate: daysAgo(1), needLevel: NeedLevel.WANT },
    { userId: user.id, walletId: bankWallet.id, title: 'Netflix', amount: 260_000, category: 'entertainment', expenseDate: daysAgo(9), needLevel: NeedLevel.WANT },
    { userId: user.id, walletId: momo.id, title: 'Impulse buy: gadget', amount: 1_200_000, category: 'shopping', expenseDate: daysAgo(6), needLevel: NeedLevel.WASTE, note: 'Regret purchase' },
    { userId: user.id, walletId: bankWallet.id, title: 'Online course — system design', amount: 800_000, category: 'education', expenseDate: daysAgo(12), needLevel: NeedLevel.INVESTMENT },
  ];
  for (const data of expenseData) {
    await prisma.expense.create({ data });
  }
  console.log(`  expenses    ${expenseData.length}`);

  // -------------------------------------------------------------- 15. Budget
  await prisma.budget.createMany({
    data: [
      { userId: user.id, category: 'food', amount: 3_000_000, period: BudgetPeriod.MONTHLY, startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() },
      { userId: user.id, category: 'transport', amount: 1_000_000, period: BudgetPeriod.MONTHLY, startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() },
      { userId: user.id, category: 'entertainment', amount: 800_000, period: BudgetPeriod.MONTHLY, startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth(), alertThresholdPercent: 70 },
      { userId: user.id, category: 'shopping', amount: 500_000, period: BudgetPeriod.MONTHLY, startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth(), alertThresholdPercent: 60 },
    ],
  });
  console.log('  budgets     4 monthly categories');

  // ---------------------------------------------------------------- 16. Debt
  await prisma.debt.createMany({
    data: [
      { userId: user.id, type: DebtType.I_OWE, personName: 'Minh (brother)', title: 'Laptop loan', totalAmount: 8_000_000, paidAmount: 3_000_000, dueDate: daysAgo(-30), status: DebtStatus.ACTIVE, note: 'Pay 1m/month' },
      { userId: user.id, type: DebtType.OWED_TO_ME, personName: 'Lan', title: 'Covered restaurant bill', totalAmount: 450_000, paidAmount: 0, dueDate: daysAgo(-7), status: DebtStatus.ACTIVE },
    ],
  });
  console.log('  debts       2 (1 owed, 1 owed-to-me)');

  // ----------------------------------------------------------- 17. SavingGoal
  await prisma.savingGoal.createMany({
    data: [
      { userId: user.id, title: 'Emergency fund (3 months)', targetAmount: 50_000_000, currentAmount: 18_000_000, priority: Priority.HIGH, status: SavingGoalStatus.ACTIVE, targetDate: daysAgo(-365) },
      { userId: user.id, title: 'Japan trip 2027', targetAmount: 40_000_000, currentAmount: 4_500_000, priority: Priority.MEDIUM, status: SavingGoalStatus.ACTIVE, targetDate: daysAgo(-400) },
      { userId: user.id, title: 'New MacBook', targetAmount: 55_000_000, currentAmount: 12_000_000, priority: Priority.LOW, status: SavingGoalStatus.ACTIVE },
    ],
  });
  console.log('  savings     3 goals');

  // ----------------------------------------------- 18. FinancialSnapshot (MTD)
  await prisma.financialSnapshot.create({
    data: {
      userId: user.id,
      month: currentMonthTag(),
      totalIncome: 29_500_000, // 25m salary + 4.5m freelance
      totalExpense: 9_505_000, // sum of seed expenses
      totalSaving: 2_000_000,
      debtRemaining: 5_000_000, // laptop loan remaining
      budgetUsagePercent: 62.5,
    },
  });
  console.log(`  fin-snap    ${currentMonthTag()}`);

  // ============================================================================
  // Personal goals
  // ============================================================================

  const goalHealth = await prisma.personalGoal.create({
    data: {
      userId: user.id,
      title: 'Run a half marathon',
      description: '21.1 km — Dec race.',
      category: GoalCategory.HEALTH,
      targetValue: 21.1,
      currentValue: 8,
      unit: 'km (longest run)',
      deadline: daysAgo(-180),
      priority: Priority.HIGH,
      status: PersonalGoalStatus.ACTIVE,
    },
  });
  const goalFinance = await prisma.personalGoal.create({
    data: {
      userId: user.id,
      title: 'Save 100m VND by end of next year',
      category: GoalCategory.FINANCE,
      targetValue: 100_000_000,
      currentValue: 34_500_000,
      unit: 'VND',
      deadline: daysAgo(-500),
      priority: Priority.HIGH,
      status: PersonalGoalStatus.ACTIVE,
    },
  });
  const goalCareer = await prisma.personalGoal.create({
    data: {
      userId: user.id,
      title: 'Ship LifeOS AI v1',
      category: GoalCategory.CAREER,
      priority: Priority.HIGH,
      status: PersonalGoalStatus.ACTIVE,
    },
  });

  await prisma.goalMilestone.createMany({
    data: [
      { goalId: goalHealth.id, userId: user.id, title: '5 km non-stop', status: MilestoneStatus.COMPLETED, completedAt: daysAgo(30) },
      { goalId: goalHealth.id, userId: user.id, title: '10 km non-stop', status: MilestoneStatus.TODO, targetDate: daysAgo(-45) },
      { goalId: goalHealth.id, userId: user.id, title: '15 km long run', status: MilestoneStatus.TODO, targetDate: daysAgo(-90) },
      { goalId: goalFinance.id, userId: user.id, title: 'Hit 50m saved', status: MilestoneStatus.TODO, targetDate: daysAgo(-120) },
      { goalId: goalCareer.id, userId: user.id, title: 'Production backend foundation', status: MilestoneStatus.COMPLETED, completedAt: new Date() },
      { goalId: goalCareer.id, userId: user.id, title: 'Mobile i18n + settings', status: MilestoneStatus.COMPLETED, completedAt: new Date() },
      { goalId: goalCareer.id, userId: user.id, title: 'Finance domain shipped', status: MilestoneStatus.TODO, targetDate: daysAgo(-30) },
    ],
  });
  console.log('  goals       3 + 7 milestones');

  // ============================================================================
  // AI
  // ============================================================================

  const conv = await prisma.aIConversation.create({
    data: { userId: user.id, title: 'Plan tomorrow', contextType: 'daily-plan' },
  });
  await prisma.aIMessage.createMany({
    data: [
      {
        conversationId: conv.id,
        userId: user.id,
        role: AIMessageRole.SYSTEM,
        content: 'You are a personal life planner. Be concise and pragmatic. Reply in Vietnamese.',
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
          'Gợi ý: deep work 9–11:30, ăn trưa 12h, họp 14h, gym 18:30. Bữa tối nhẹ lúc 20h.',
        metadata: { tokens: 178, model: 'claude-sonnet-4-6' },
      },
    ],
  });
  console.log('  ai          conversation + 3 messages');

  await prisma.aIRecommendation.createMany({
    data: [
      {
        userId: user.id,
        type: AIRecommendationType.SLEEP,
        title: 'Ngủ sớm hơn 30 phút tối nay',
        content: 'Thời lượng ngủ trung bình 5 ngày vừa rồi giảm xuống 6h45. Mục tiêu 22:30 tắt đèn.',
        priority: Priority.HIGH,
        status: AIRecommendationStatus.NEW,
      },
      {
        userId: user.id,
        type: AIRecommendationType.TASK,
        title: 'Chuyển "Đọc sách" sang buổi sáng',
        content: 'Bạn thường bỏ qua task đọc buổi tối. Thử 20 phút sau bữa sáng.',
        priority: Priority.MEDIUM,
        status: AIRecommendationStatus.VIEWED,
      },
      {
        userId: user.id,
        type: AIRecommendationType.BUDGET,
        title: 'Chi tiêu "shopping" đang vượt ngưỡng',
        content: 'Bạn đã dùng 1.2m / 0.5m ngân sách shopping tháng này (240%). Cân nhắc tạm dừng các khoản không thiết yếu.',
        priority: Priority.HIGH,
        status: AIRecommendationStatus.NEW,
        sourceData: { category: 'shopping', used: 1_200_000, budget: 500_000 },
      },
      {
        userId: user.id,
        type: AIRecommendationType.GOAL,
        title: 'Mục tiêu "Half marathon" đang chậm',
        content: 'Quãng đường dài nhất vẫn đang ở 8km, còn 90 ngày tới mốc 10km. Đặt lịch long run cuối tuần này.',
        priority: Priority.MEDIUM,
        status: AIRecommendationStatus.NEW,
      },
    ],
  });
  console.log('  ai-recs     4 (sleep/task/budget/goal)');

  // Yesterday's daily review + last week's weekly review
  await prisma.dailyReview.create({
    data: {
      userId: user.id,
      date: daysAgo(1),
      summary: 'Ngày hiệu quả ở buổi sáng, buổi tối bỏ kế hoạch ăn ở nhà.',
      wins: ['Hoàn thành deep work 3h', 'Đi gym đúng giờ', 'Uống đủ 8 ly nước'],
      issues: ['Ăn ngoài thay vì nấu', 'Đi ngủ muộn (24h)'],
      suggestions: ['Sắp xếp nguyên liệu trước tối', 'Thiết lập quiet hours 22:30'],
    },
  });
  await prisma.weeklyReview.create({
    data: {
      userId: user.id,
      weekStart: mondayOfCurrentWeek(),
      summary: 'Tuần bận rộn, sức khoẻ ổn, tài chính cần chú ý.',
      scheduleInsight: 'Trung bình hoàn thành 78% lịch mỗi ngày.',
      taskInsight: 'Nhiệm vụ cá nhân hay bị đẩy lùi sang ngày hôm sau.',
      habitInsight: 'Water 6/7, meditation 5/7, workout 2/3 — tốt.',
      healthInsight: 'Giấc ngủ trung bình 7h05 — trong vùng chấp nhận được.',
      mealInsight: 'Bỏ 1 bữa tối theo kế hoạch, chi 60k cho phở.',
      financeInsight: 'Shopping vượt ngưỡng cảnh báo 240%.',
      goalInsight: 'Half marathon đang chậm 15% so với kế hoạch.',
      suggestions: [
        'Tạm dừng mua sắm không thiết yếu tháng này',
        'Long run 12km cuối tuần',
        'Chuẩn bị bữa tối trước 18h',
      ],
    },
  });
  console.log('  reviews     daily + weekly');

  // ============================================================================
  // NotificationLog
  // ============================================================================

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
      {
        userId: user.id,
        title: 'Budget alert',
        body: 'Shopping vượt ngân sách tháng',
        type: 'budget',
        scheduledAt: dateAt(13, 15),
        sentAt: dateAt(13, 15),
        status: NotificationStatus.SENT,
      },
    ],
  });
  console.log('  notif-log   3');

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

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuroraScreen, GlassSurface, FlowText, GradientButton, useAurora } from '../../aurora';
import { useCapture } from '../../components/v2';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { useTodayPlan, useGenerateTodayPlan } from '../../hooks/usePlanner';

/**
 * PlanAurora — uses useTodayPlan() (existing v1 hook backed by
 * /api/planner/today) plus dashboard.nextTask for the next-up CTA.
 * Empty state offers "AI generate plan" which calls /api/planner/today/generate.
 */
export function PlanAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const dash = useDashboardSummary();
  const plan = useTodayPlan();
  const generate = useGenerateTodayPlan();
  const days = useMemo(() => buildDayStrip(7), []);
  const todayKey = new Date().toDateString();

  const planSummary = dash.data?.todayPlan;
  const nextTask = dash.data?.nextTask;

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'KẾ HOẠCH' : 'PLAN'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Hôm nay' : 'Today'}
        </FlowText>
      </View>

      {/* Day strip */}
      <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
        {days.map((d) => {
          const isToday = d.date.toDateString() === todayKey;
          return (
            <GlassSurface
              key={d.iso}
              pad="3"
              radius="lg"
              intensity={isToday ? 1.6 : 0.8}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <FlowText variant="caption" tone={isToday ? 'accent' : 'tertiary'}>
                {d.dow}
              </FlowText>
              <FlowText
                variant="titleM"
                tone={isToday ? 'primary' : 'secondary'}
                style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
              >
                {d.day}
              </FlowText>
            </GlassSurface>
          );
        })}
      </View>

      {/* Plan progress */}
      {planSummary ? (
        <GlassSurface pad="6" radius="2xl" intensity={1.2}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'TIẾN ĐỘ HÔM NAY' : "TODAY'S PROGRESS"}
          </FlowText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: t.space['2'],
              marginTop: t.space['3'],
            }}
          >
            <FlowText
              variant="hero"
              tone="primary"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {planSummary.doneItems}
            </FlowText>
            <FlowText variant="titleL" tone="tertiary">
              / {planSummary.totalItems}
            </FlowText>
          </View>
          <FlowText
            variant="bodyM"
            tone="secondary"
            style={{ marginTop: t.space['2'] }}
          >
            {planSummary.totalItems === 0
              ? locale === 'vi'
                ? 'Chưa có việc nào hôm nay.'
                : 'No tasks for today yet.'
              : planSummary.aiGenerated
              ? locale === 'vi'
                ? 'AI đã tạo kế hoạch dựa trên nhịp của bạn.'
                : 'AI generated this plan from your rhythm.'
              : locale === 'vi'
              ? 'Bạn tự lên kế hoạch.'
              : 'Plan made by you.'}
          </FlowText>

          {/* Progress bar */}
          {planSummary.totalItems > 0 ? (
            <View
              style={{
                marginTop: t.space['4'],
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${(planSummary.doneItems / planSummary.totalItems) * 100}%`,
                  height: 4,
                  backgroundColor: t.palette.accent,
                  borderRadius: 2,
                }}
              />
            </View>
          ) : null}

          {planSummary.totalItems === 0 ? (
            <View style={{ marginTop: t.space['5'] }}>
              <GradientButton
                label={
                  generate.isPending
                    ? locale === 'vi'
                      ? 'Đang tạo…'
                      : 'Generating…'
                    : locale === 'vi'
                    ? 'AI lên kế hoạch giúp tôi'
                    : 'Let AI plan my day'
                }
                onPress={() => generate.mutate()}
                disabled={generate.isPending}
              />
            </View>
          ) : null}
        </GlassSurface>
      ) : null}

      {/* Next task highlight */}
      {nextTask ? (
        <GlassSurface pad="5" radius="xl">
          <FlowText variant="kicker" tone="accent">
            {locale === 'vi' ? 'VIỆC TIẾP THEO' : 'NEXT UP'}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {nextTask.title}
          </FlowText>
          {nextTask.dueAt ? (
            <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['1'] }}>
              {locale === 'vi' ? 'Hạn' : 'Due'}: {formatDueLabel(nextTask.dueAt, locale)}
            </FlowText>
          ) : null}
          <FlowText variant="caption" tone="tertiary" style={{ marginTop: t.space['1'] }}>
            {locale === 'vi'
              ? `Mức độ: ${priorityLabel(nextTask.priority, locale)}`
              : `Priority: ${priorityLabel(nextTask.priority, locale)}`}
          </FlowText>
        </GlassSurface>
      ) : (
        <GlassSurface pad="5" radius="xl">
          <FlowText variant="bodyM" tone="secondary">
            {locale === 'vi'
              ? 'Không có việc gấp. Tận hưởng hiện tại.'
              : 'No urgent task. Enjoy the moment.'}
          </FlowText>
        </GlassSurface>
      )}

      {/* Plan items list */}
      {plan.data?.items && plan.data.items.length > 0 ? (
        <View>
          <FlowText variant="titleL" tone="primary">
            {locale === 'vi' ? 'Việc trong ngày' : 'Today list'}
          </FlowText>
          <View style={{ marginTop: t.space['4'], gap: t.space['3'] }}>
            {plan.data.items.slice(0, 8).map((item) => (
              <GlassSurface key={item.id} pad="4" radius="lg" intensity={0.8}>
                <View style={{ flexDirection: 'row', gap: t.space['3'], alignItems: 'center' }}>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 1.5,
                      borderColor:
                        item.status === 'COMPLETED' ? t.palette.accent : 'rgba(255,255,255,0.3)',
                      backgroundColor:
                        item.status === 'COMPLETED' ? t.palette.accent : 'transparent',
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <FlowText
                      variant="bodyM"
                      tone={item.status === 'COMPLETED' ? 'tertiary' : 'primary'}
                      style={
                        item.status === 'COMPLETED'
                          ? { textDecorationLine: 'line-through' }
                          : undefined
                      }
                    >
                      {item.title}
                    </FlowText>
                    {item.startAt ? (
                      <FlowText variant="caption" tone="secondary">
                        {formatTimeRange(item.startAt, item.endAt, locale)}
                      </FlowText>
                    ) : null}
                  </View>
                </View>
              </GlassSurface>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Việc nhanh' : '+ Quick task'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'TASK' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Sự kiện' : '+ Event'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'EVENT' })}
          style={{ flex: 1 }}
        />
      </View>
    </AuroraScreen>
  );
}

function buildDayStrip(days: number) {
  const today = new Date();
  const dows = { vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] };
  const out: { iso: string; date: Date; dow: string; day: number }[] = [];
  for (let i = -2; i < days - 2; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      date: d,
      dow: dows.en[d.getDay()],
      day: d.getDate(),
    });
  }
  return out;
}

function priorityLabel(p: 'LOW' | 'MEDIUM' | 'HIGH', locale: 'vi' | 'en'): string {
  if (locale === 'vi') return p === 'HIGH' ? 'Cao' : p === 'MEDIUM' ? 'Vừa' : 'Thấp';
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function formatTimeRange(start: string, end: string | null, locale: 'vi' | 'en'): string {
  try {
    const s = new Date(start);
    const t1 = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
    if (!end) return t1;
    const e = new Date(end);
    const t2 = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
    return `${t1} – ${t2}`;
  } catch {
    return start;
  }
}

function formatDueLabel(iso: string, locale: 'vi' | 'en'): string {
  try {
    const due = new Date(iso);
    const now = new Date();
    const sameDay =
      due.getFullYear() === now.getFullYear() &&
      due.getMonth() === now.getMonth() &&
      due.getDate() === now.getDate();
    const time = `${String(due.getHours()).padStart(2, '0')}:${String(
      due.getMinutes(),
    ).padStart(2, '0')}`;
    if (sameDay) return locale === 'vi' ? `hôm nay ${time}` : `today ${time}`;
    return due.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
  } catch {
    return iso;
  }
}

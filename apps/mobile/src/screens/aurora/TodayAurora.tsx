import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AuroraScreen,
  AuroraHeader,
  GlassSurface,
  FlowText,
  GradientButton,
  SettingsSheet,
  useAurora,
} from '../../aurora';
import { useAuthStore } from '../../store/auth.store';
import { useCapture } from '../../components/v2';
import { useAiKeyStatus } from '../../hooks/useAiKeyStatus';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { useTodayTasks } from '../../hooks/useFeed';
import type { RootStackParamList } from '../../navigation/types';

/**
 * TodayAurora — Pencil R45 layout.
 *
 * Header (∞ + LifeOS + settings) → date eyebrow → 2-line serif greeting →
 * (optional AI-key banner) → energy hero card (ring + delta) → mood/sleep
 * metric row → "Now" card from smartBrief / nextTask → today's tasks list.
 */
export function TodayAurora() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const userName = useAuthStore((s) => s.user?.displayName ?? null);
  const capture = useCapture();
  const aiKey = useAiKeyStatus();
  const dash = useDashboardSummary();
  const todayTasks = useTodayTasks();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const aiKeyMissing = aiKey.data && !aiKey.data.enabled;
  const greeting = greetingFor(t.moment, locale);
  const summary = dash.data;
  const dateLabel = formatDateLabel(new Date(), locale);

  const sleepHours =
    summary?.moodSleep?.lastSleepMinutes != null
      ? summary.moodSleep.lastSleepMinutes / 60
      : null;
  const energyScore = computeEnergyScore({
    sleepHours,
    sleepQuality: summary?.moodSleep?.lastSleepQuality ?? null,
  });

  return (
    <AuroraScreen>
      <AuroraHeader
        brand="LifeOS"
        iconName="settings-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Cài đặt' : 'Settings'}
      />

      {/* Date eyebrow + serif hero */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: t.palette.accent,
            }}
          />
          <FlowText
            variant="kicker"
            tone="secondary"
            style={{ fontSize: 11, letterSpacing: 1.5 }}
          >
            {dateLabel}
          </FlowText>
        </View>
        <FlowText
          variant="displayM"
          tone="primary"
          style={{ lineHeight: 38 }}
        >
          {greeting},{'\n'}
          {userName ? `${userName}.` : energyHeroLine(energyScore, locale)}
        </FlowText>
      </View>

      {/* AI key banner */}
      {aiKeyMissing ? (
        <Pressable onPress={() => navigation.navigate('AISettings')}>
          <GlassSurface pad="5" radius="xl" intensity={1.4}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
              <View style={{ flex: 1 }}>
                <FlowText variant="kicker" tone="accent">
                  {locale === 'vi' ? 'BẬT AI' : 'ACTIVATE AI'}
                </FlowText>
                <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
                  {locale === 'vi'
                    ? 'Nhập OpenAI key để AI hiểu bạn'
                    : 'Add OpenAI key so AI knows you'}
                </FlowText>
              </View>
              <FlowText variant="titleL" tone="accent">
                →
              </FlowText>
            </View>
          </GlassSurface>
        </Pressable>
      ) : null}

      {/* Energy hero card */}
      <GlassSurface pad="5" radius="2xl" intensity={1.0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['5'] }}>
          <EnergyRing value={energyScore} accent={t.palette.accentGlow} />
          <View style={{ flex: 1, gap: 6 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'NĂNG LƯỢNG' : 'ENERGY'}
            </FlowText>
            <FlowText
              variant="hero"
              tone="primary"
              style={{ fontSize: 56, lineHeight: 56, fontVariant: ['tabular-nums'] }}
            >
              {energyScore}
            </FlowText>
            <FlowText variant="bodyS" tone="secondary">
              {energySubtitle(sleepHours, locale)}
            </FlowText>
          </View>
        </View>
      </GlassSurface>

      {/* Metric row: Mood + Sleep */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'TÂM TRẠNG' : 'MOOD'}
          </FlowText>
          <FlowText
            variant="displayM"
            tone="primary"
            style={{ marginTop: t.space['2'], fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] }}
          >
            {moodScore(summary?.moodSleep?.lastMood ?? null) ?? '—'}
          </FlowText>
          <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['1'] }}>
            {moodSubtitle(summary?.moodSleep?.lastMood ?? null, locale)}
          </FlowText>
        </GlassSurface>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'GIẤC NGỦ' : 'SLEEP'}
          </FlowText>
          <FlowText
            variant="displayM"
            tone="primary"
            style={{ marginTop: t.space['2'], fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] }}
          >
            {sleepHours != null ? `${sleepHours.toFixed(1)}h` : '—'}
          </FlowText>
          <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['1'] }}>
            {sleepQualityLabel(summary?.moodSleep?.lastSleepQuality ?? null, locale)}
          </FlowText>
        </GlassSurface>
      </View>

      {/* Now card — smartBrief or next task */}
      {summary?.smartBrief ? (
        <GlassSurface pad="5" radius="xl" intensity={1.2}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: t.palette.accentGlow,
              }}
            />
            <FlowText
              variant="kicker"
              style={{ color: t.palette.accentGlow, letterSpacing: 1.5 }}
            >
              {locale === 'vi' ? `BÂY GIỜ · ${formatNow()}` : `NOW · ${formatNow()}`}
            </FlowText>
          </View>
          <FlowText
            variant="titleL"
            tone="primary"
            style={{ marginTop: t.space['3'], lineHeight: 28 }}
          >
            {summary.smartBrief.headline}
          </FlowText>
          {summary.smartBrief.body ? (
            <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['2'] }}>
              {summary.smartBrief.body}
            </FlowText>
          ) : null}
          {summary.smartBrief.primaryAction ? (
            <View style={{ marginTop: t.space['4'] }}>
              <GradientButton
                label={summary.smartBrief.primaryAction.label}
                onPress={() => {
                  const action = summary.smartBrief?.primaryAction;
                  if (!action) return;
                  if (action.smartEntryMode) {
                    capture.open({ initialKind: action.smartEntryMode as never });
                  }
                }}
              />
            </View>
          ) : null}
        </GlassSurface>
      ) : summary?.nextTask ? (
        <Pressable onPress={() => navigation.navigate('Tasks')}>
          <GlassSurface pad="5" radius="xl" intensity={1.0}>
            <FlowText variant="kicker" tone="accent">
              {locale === 'vi' ? 'VIỆC TIẾP THEO' : 'NEXT TASK'}
            </FlowText>
            <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['2'], lineHeight: 28 }}>
              {summary.nextTask.title}
            </FlowText>
            {summary.nextTask.dueAt ? (
              <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['1'] }}>
                {locale === 'vi' ? 'Hạn: ' : 'Due: '}
                {formatDueLabel(summary.nextTask.dueAt, locale)}
              </FlowText>
            ) : null}
          </GlassSurface>
        </Pressable>
      ) : null}

      {/* Today tasks compact list */}
      {todayTasks.data?.rows && todayTasks.data.rows.length > 0 ? (
        <GlassSurface pad="4" radius="xl" intensity={0.9}>
          <View style={{ paddingHorizontal: 4, marginBottom: 8 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'VIỆC HÔM NAY' : "TODAY'S TASKS"}
            </FlowText>
          </View>
          <View>
            {todayTasks.data.rows.slice(0, 4).map((task, i) => {
              const isDone = task.status === 'COMPLETED';
              const dotColor = [
                t.palette.accent,
                t.palette.accentGlow,
                t.kind.task,
                t.kind.mood,
              ][i % 4];
              return (
                <Pressable
                  key={task.id}
                  onPress={() => navigation.navigate('Tasks')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: isDone ? 'rgba(255,255,255,0.18)' : dotColor,
                    }}
                  />
                  <FlowText
                    variant="bodyM"
                    tone={isDone ? 'tertiary' : 'primary'}
                    numberOfLines={1}
                    style={[
                      { flex: 1 },
                      isDone ? { textDecorationLine: 'line-through' as const } : undefined,
                    ]}
                  >
                    {task.title}
                  </FlowText>
                  <FlowText variant="caption" tone="tertiary">
                    ›
                  </FlowText>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      ) : null}

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

/** Concentric ring rendered with overlapping circles (no SVG dep). */
function EnergyRing({ value, accent }: { value: number; accent: string }) {
  // Simple ring: outer circle stroke + inner mask
  const SIZE = 96;
  const STROKE = 6;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderColor: accent,
        opacity: 0.85,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: -STROKE,
          top: SIZE / 2 - STROKE,
          width: STROKE * 2,
          height: STROKE * 2,
          borderRadius: STROKE,
          backgroundColor: 'transparent',
          // Visual hint that ring is "in progress" — leave a small transparent gap
        }}
      />
      <FlowText variant="bodyS" tone="tertiary" style={{ fontSize: 10, letterSpacing: 1 }}>
        {value}%
      </FlowText>
    </View>
  );
}

function computeEnergyScore({
  sleepHours,
  sleepQuality,
}: {
  sleepHours: number | null;
  sleepQuality: 'BAD' | 'OK' | 'GOOD' | null;
}): number {
  let score = 60;
  if (sleepHours != null) {
    if (sleepHours >= 7.5) score += 18;
    else if (sleepHours >= 6.5) score += 10;
    else if (sleepHours < 5) score -= 12;
  }
  if (sleepQuality === 'GOOD') score += 8;
  if (sleepQuality === 'BAD') score -= 8;
  return Math.max(20, Math.min(99, Math.round(score)));
}

function energyHeroLine(energy: number, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    if (energy >= 80) return 'năng lượng đang lên.';
    if (energy >= 60) return 'một ngày vào nhịp.';
    return 'nhẹ nhàng từng bước.';
  }
  if (energy >= 80) return 'energy is rising.';
  if (energy >= 60) return 'finding rhythm.';
  return 'one step at a time.';
}

function energySubtitle(sleepHours: number | null, locale: 'vi' | 'en'): string {
  if (sleepHours == null) return locale === 'vi' ? 'Ghi giấc ngủ để theo dõi' : 'Log sleep to track';
  if (sleepHours >= 7.5) {
    return locale === 'vi'
      ? `+${(sleepHours - 7).toFixed(1)}h vs lý tưởng  ↑`
      : `+${(sleepHours - 7).toFixed(1)}h vs ideal  ↑`;
  }
  return locale === 'vi'
    ? `Ngủ ${sleepHours.toFixed(1)}h đêm qua`
    : `${sleepHours.toFixed(1)}h sleep last night`;
}

type MoodLabel = 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';

function moodScore(m: MoodLabel | null): string | null {
  if (!m) return null;
  const map: Record<MoodLabel, string> = {
    GREAT: '9.0',
    GOOD: '7.5',
    OK: '6.0',
    TIRED: '4.5',
    STRESSED: '3.5',
    SAD: '2.5',
  };
  return map[m];
}

function moodSubtitle(m: MoodLabel | null, locale: 'vi' | 'en'): string {
  if (m == null) return locale === 'vi' ? 'Chưa ghi mood' : 'No mood logged';
  if (locale === 'vi') {
    return m === 'GREAT'
      ? 'Tuyệt vời'
      : m === 'GOOD'
      ? 'Lạc quan, ổn định'
      : m === 'OK'
      ? 'Bình thường'
      : m === 'TIRED'
      ? 'Hơi mệt'
      : m === 'STRESSED'
      ? 'Căng thẳng'
      : 'Cần nghỉ ngơi';
  }
  return m === 'GREAT'
    ? 'Great'
    : m === 'GOOD'
    ? 'Optimistic'
    : m === 'OK'
    ? 'Balanced'
    : m === 'TIRED'
    ? 'Tired'
    : m === 'STRESSED'
    ? 'Stressed'
    : 'Low';
}

function greetingFor(moment: string, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    switch (moment) {
      case 'dawn':
        return 'Chào buổi sáng';
      case 'noon':
        return 'Chào buổi trưa';
      case 'afternoon':
        return 'Chào buổi chiều';
      case 'dusk':
        return 'Chào buổi tối';
      case 'night':
      default:
        return 'Đêm khuya rồi';
    }
  }
  switch (moment) {
    case 'dawn':
      return 'Good morning';
    case 'noon':
      return 'Good afternoon';
    case 'afternoon':
      return 'Good afternoon';
    case 'dusk':
      return 'Good evening';
    case 'night':
    default:
      return 'Late night';
  }
}

function formatDateLabel(d: Date, locale: 'vi' | 'en'): string {
  const dows = {
    vi: ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'],
    en: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
  };
  const months = {
    vi: 'THÁNG',
    en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  };
  const dow = dows[locale][d.getDay()];
  if (locale === 'vi') {
    return `${dow} · ${String(d.getDate()).padStart(2, '0')} ${months.vi} ${d.getMonth() + 1}`;
  }
  return `${dow} · ${months.en[d.getMonth()]} ${d.getDate()}`;
}

function formatNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sleepQualityLabel(
  q: 'BAD' | 'OK' | 'GOOD' | null,
  locale: 'vi' | 'en',
): string {
  if (q == null) return locale === 'vi' ? 'Chưa đánh giá' : 'Not rated';
  if (locale === 'vi') {
    return q === 'GOOD' ? 'Ngủ ngon' : q === 'OK' ? 'Tạm ổn' : 'Khó ngủ';
  }
  return q === 'GOOD' ? 'Slept well' : q === 'OK' ? 'OK' : 'Poor';
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

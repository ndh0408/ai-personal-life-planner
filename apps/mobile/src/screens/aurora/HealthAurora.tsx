import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AuroraScreen,
  AuroraHeader,
  GlassSurface,
  FlowText,
  GradientButton,
  SettingsSheet,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';
import { useLatestSleep, useLatestMood, useTodayTasks } from '../../hooks/useFeed';
import { journalService, type Mood, type SleepQuality } from '../../services/api/journal.service';

/**
 * HealthAurora — Pencil R45 layout. Three rings derived from REAL data:
 *  • Recovery (sleep duration vs 7h + quality)
 *  • Vitality (mood + energy from latest mood log)
 *  • Rhythm (today task completion + meal logged %)
 *
 * Sleep card pulls actual /sleep/latest. Heart rate card shows real
 * latest sleep duration + quality (no fake stages or fake HR until
 * HealthKit/HC integration ships).
 */
export function HealthAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sleep = useLatestSleep();
  const mood = useLatestMood();
  const tasks = useTodayTasks();
  const sleepWeek = useQuery({
    queryKey: ['sleep', 'week'],
    queryFn: () => journalService.listSleep('week'),
    staleTime: 60_000,
  });

  const sleepHours = sleep.data?.durationMinutes
    ? sleep.data.durationMinutes / 60
    : null;
  const recoveryScore = useMemo(
    () => computeRecovery(sleepHours, sleep.data?.quality ?? null),
    [sleepHours, sleep.data?.quality],
  );
  const vitalityScore = useMemo(
    () => computeVitality(mood.data?.mood ?? null, mood.data?.energy ?? null),
    [mood.data?.mood, mood.data?.energy],
  );
  const rhythmScore = useMemo(() => {
    const rows = tasks.data?.rows ?? [];
    if (rows.length === 0) return 0;
    const done = rows.filter((r) => r.status === 'COMPLETED').length;
    return Math.round((done / rows.length) * 100);
  }, [tasks.data?.rows]);

  const sleepWeekAvg = useMemo(() => {
    const rows = sleepWeek.data?.rows ?? [];
    if (rows.length === 0) return null;
    const total = rows.reduce((acc, r) => acc + r.durationMinutes, 0);
    return total / rows.length / 60;
  }, [sleepWeek.data?.rows]);

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Sức khỏe' : 'Health'}
        iconName="time-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Lịch sử' : 'History'}
      />

      {/* Hero with 3 derived rings */}
      <GlassSurface pad="5" radius="2xl" intensity={1.1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['5'] }}>
          <ActivityRings
            outer={recoveryScore}
            mid={vitalityScore}
            inner={rhythmScore}
            outerColor={t.kind.expense}
            midColor={t.kind.income}
            innerColor={t.palette.accentGlow}
          />
          <View style={{ flex: 1, gap: 14 }}>
            <RingStat
              label={locale === 'vi' ? 'PHỤC HỒI' : 'RECOVERY'}
              value={
                sleepHours != null
                  ? `${recoveryScore}% · ${sleepHours.toFixed(1)}h`
                  : locale === 'vi'
                  ? 'Chưa ghi giấc'
                  : 'No sleep yet'
              }
              accent={t.kind.expense}
            />
            <RingStat
              label={locale === 'vi' ? 'TÂM TRẠNG' : 'VITALITY'}
              value={
                mood.data
                  ? `${vitalityScore}% · ${moodVietnamese(mood.data.mood, locale)}`
                  : locale === 'vi'
                  ? 'Chưa ghi mood'
                  : 'No mood yet'
              }
              accent={t.kind.income}
            />
            <RingStat
              label={locale === 'vi' ? 'NHỊP NGÀY' : 'RHYTHM'}
              value={
                tasks.data?.rows && tasks.data.rows.length > 0
                  ? `${rhythmScore}% · ${tasks.data.rows.filter((r) => r.status === 'COMPLETED').length}/${tasks.data.rows.length}`
                  : locale === 'vi'
                  ? 'Chưa có việc'
                  : 'No tasks'
              }
              accent={t.palette.accentGlow}
            />
          </View>
        </View>
      </GlassSurface>

      {/* Sleep card — real latest sleep */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
          <View style={{ flex: 1, gap: 6 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'GIẤC NGỦ · GẦN NHẤT' : 'SLEEP · LATEST'}
            </FlowText>
            <FlowText
              variant="hero"
              tone="primary"
              style={{ fontSize: 36, lineHeight: 36, fontVariant: ['tabular-nums'] }}
            >
              {sleepHours != null ? `${formatHours(sleepHours)}` : '—'}
            </FlowText>
            <FlowText
              variant="bodyS"
              style={{
                color: sleepHours != null ? t.palette.accentGlow : t.palette.inkTertiary,
                fontWeight: '500',
              }}
            >
              {sleepHours != null
                ? sleepQualityLabel(sleep.data?.quality ?? null, locale)
                : locale === 'vi'
                ? 'Ghi giấc đầu tiên để bắt đầu'
                : 'Log your first sleep to begin'}
            </FlowText>
          </View>
          <SleepBar value={sleepHours} accent={t.palette.accentGlow} dim={t.palette.inkTertiary} />
        </View>
      </GlassSurface>

      {/* Week sleep avg + mood card */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'GIẤC TB · 7 NGÀY' : 'SLEEP AVG · 7D'}
          </FlowText>
          <FlowText
            variant="displayM"
            tone="primary"
            style={{
              marginTop: t.space['2'],
              fontSize: 32,
              lineHeight: 36,
              fontVariant: ['tabular-nums'],
            }}
          >
            {sleepWeekAvg != null ? formatHours(sleepWeekAvg) : '—'}
          </FlowText>
          <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['1'] }}>
            {sleepWeek.data?.rows?.length
              ? `${sleepWeek.data.rows.length} ${locale === 'vi' ? 'đêm' : 'nights'}`
              : locale === 'vi'
              ? 'Chưa đủ dữ liệu'
              : 'Not enough data'}
          </FlowText>
        </GlassSurface>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'MOOD · GẦN NHẤT' : 'MOOD · LATEST'}
          </FlowText>
          <FlowText
            variant="displayM"
            tone="primary"
            style={{
              marginTop: t.space['2'],
              fontSize: 28,
              lineHeight: 32,
            }}
          >
            {mood.data ? moodVietnamese(mood.data.mood, locale) : '—'}
          </FlowText>
          <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['1'] }}>
            {mood.data
              ? `${locale === 'vi' ? 'NL ' : 'EN '}${energyLabel(mood.data.energy, locale)}`
              : locale === 'vi'
              ? 'Ghi mood để theo dõi'
              : 'Log mood to track'}
          </FlowText>
        </GlassSurface>
      </View>

      {/* Quick add */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Giấc ngủ' : '+ Sleep'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'SLEEP' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Tâm trạng' : '+ Mood'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'MOOD' })}
          style={{ flex: 1 }}
        />
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

function ActivityRings({
  outer,
  mid,
  inner,
  outerColor,
  midColor,
  innerColor,
}: {
  outer: number;
  mid: number;
  inner: number;
  outerColor: string;
  midColor: string;
  innerColor: string;
}) {
  return (
    <View
      style={{
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ring size={120} stroke={6} progress={outer / 100} color={outerColor} />
      <View style={{ position: 'absolute' }}>
        <Ring size={94} stroke={6} progress={mid / 100} color={midColor} />
      </View>
      <View style={{ position: 'absolute' }}>
        <Ring size={68} stroke={6} progress={inner / 100} color={innerColor} />
      </View>
    </View>
  );
}

function Ring({
  size,
  stroke,
  color,
  progress,
}: {
  size: number;
  stroke: number;
  color: string;
  progress: number;
}) {
  // Approximation: full ring whose opacity scales with progress (no SVG dep).
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        opacity: 0.18 + p * 0.7,
      }}
    />
  );
}

function RingStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <FlowText
        variant="kicker"
        style={{ color: accent, fontSize: 9, letterSpacing: 1.2 }}
      >
        {label}
      </FlowText>
      <FlowText
        variant="bodyM"
        tone="primary"
        style={{ fontSize: 14, lineHeight: 18 }}
      >
        {value}
      </FlowText>
    </View>
  );
}

function SleepBar({
  value,
  accent,
  dim,
}: {
  value: number | null;
  accent: string;
  dim: string;
}) {
  // Vertical bar showing sleep duration vs 9h reference (cap at 9h max).
  const ref = 9;
  const filled = value != null ? Math.min(value, ref) / ref : 0;
  const TOTAL = 108;
  return (
    <View
      style={{
        width: 8,
        height: TOTAL,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        justifyContent: 'flex-end',
      }}
    >
      <View
        style={{
          width: 8,
          height: TOTAL * filled,
          backgroundColor: value != null ? accent : dim,
        }}
      />
    </View>
  );
}

function computeRecovery(
  hours: number | null,
  quality: SleepQuality | null,
): number {
  if (hours == null) return 0;
  let score = 0;
  if (hours >= 8) score = 95;
  else if (hours >= 7) score = 85;
  else if (hours >= 6) score = 70;
  else if (hours >= 5) score = 55;
  else score = 35;
  if (quality === 'GOOD') score = Math.min(100, score + 8);
  if (quality === 'BAD') score = Math.max(15, score - 12);
  return score;
}

function computeVitality(m: Mood | null, e: 'LOW' | 'MEDIUM' | 'HIGH' | null): number {
  if (!m) return 0;
  const moodScore: Record<Mood, number> = {
    GREAT: 95,
    GOOD: 80,
    OK: 65,
    TIRED: 45,
    STRESSED: 35,
    SAD: 25,
  };
  let s = moodScore[m];
  if (e === 'HIGH') s = Math.min(100, s + 8);
  if (e === 'LOW') s = Math.max(10, s - 8);
  return s;
}

function moodVietnamese(m: Mood, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    return m === 'GREAT'
      ? 'Tuyệt vời'
      : m === 'GOOD'
      ? 'Lạc quan'
      : m === 'OK'
      ? 'Bình thường'
      : m === 'TIRED'
      ? 'Hơi mệt'
      : m === 'STRESSED'
      ? 'Căng thẳng'
      : 'Buồn';
  }
  return m.charAt(0) + m.slice(1).toLowerCase();
}

function energyLabel(e: 'LOW' | 'MEDIUM' | 'HIGH', locale: 'vi' | 'en'): string {
  if (locale === 'vi') return e === 'HIGH' ? 'cao' : e === 'MEDIUM' ? 'vừa' : 'thấp';
  return e.toLowerCase();
}

function sleepQualityLabel(q: SleepQuality | null, locale: 'vi' | 'en'): string {
  if (q == null) return locale === 'vi' ? 'Chưa đánh giá' : 'Not rated';
  if (locale === 'vi') {
    return q === 'GOOD' ? 'Ngủ ngon' : q === 'OK' ? 'Tạm ổn' : 'Khó ngủ';
  }
  return q === 'GOOD' ? 'Slept well' : q === 'OK' ? 'OK' : 'Poor';
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return `${whole}h ${String(mins).padStart(2, '0')}`;
}

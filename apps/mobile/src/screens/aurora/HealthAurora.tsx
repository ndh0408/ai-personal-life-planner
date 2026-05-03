import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

/**
 * HealthAurora — Pencil R45 layout. Header + ring hero (3 concentric
 * activity rings + stats) + sleep card with vertical gradient stage bar +
 * heart rate card.
 */
export function HealthAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ring percentages (Move/Exercise/Stand) — would come from HealthKit/HC
  const moveProgress = 0.85;
  const exerciseProgress = 0.78;
  const standProgress = 0.72;

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Sức khỏe' : 'Health'}
        iconName="time-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Lịch sử' : 'History'}
      />

      {/* Ring hero card */}
      <GlassSurface pad="5" radius="2xl" intensity={1.1}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['5'] }}>
          <ActivityRings
            move={moveProgress}
            exercise={exerciseProgress}
            stand={standProgress}
            move_color={t.kind.expense}
            exercise_color={t.kind.income}
            stand_color={t.palette.accentGlow}
          />
          <View style={{ flex: 1, gap: 14 }}>
            <RingStat
              label={locale === 'vi' ? 'VẬN ĐỘNG' : 'MOVE'}
              value="720 / 850 kcal"
              accent={t.kind.expense}
            />
            <RingStat
              label={locale === 'vi' ? 'TẬP LUYỆN' : 'EXERCISE'}
              value="38 / 45 phút"
              accent={t.kind.income}
            />
            <RingStat
              label={locale === 'vi' ? 'ĐỨNG DẬY' : 'STAND'}
              value="9 / 12 giờ"
              accent={t.palette.accentGlow}
            />
          </View>
        </View>
      </GlassSurface>

      {/* Sleep card with vertical stage bar */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
          <View style={{ flex: 1, gap: 6 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'GIẤC NGỦ · ĐÊM QUA' : 'SLEEP · LAST NIGHT'}
            </FlowText>
            <FlowText
              variant="hero"
              tone="primary"
              style={{ fontSize: 36, lineHeight: 36, fontVariant: ['tabular-nums'] }}
            >
              7h 32
            </FlowText>
            <FlowText
              variant="bodyS"
              style={{ color: t.palette.accentGlow, fontWeight: '500' }}
            >
              {locale === 'vi' ? 'Sâu 1h 48 · REM 2h 12' : 'Deep 1h 48 · REM 2h 12'}
            </FlowText>
          </View>
          <SleepStagesBar
            colors={[t.palette.accentGlow, t.palette.accent, t.kind.expense, t.kind.mood]}
          />
        </View>
      </GlassSurface>

      {/* Heart rate card */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'NHỊP TIM' : 'HEART RATE'}
          </FlowText>
          <FlowText style={{ color: t.kind.expense, fontSize: 14 }}>♡</FlowText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
            marginTop: t.space['2'],
          }}
        >
          <FlowText
            variant="hero"
            tone="primary"
            style={{ fontSize: 48, lineHeight: 48, fontVariant: ['tabular-nums'] }}
          >
            62
          </FlowText>
          <FlowText
            variant="monoData"
            tone="tertiary"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            {locale === 'vi' ? 'bpm · nhịp nghỉ' : 'bpm · resting'}
          </FlowText>
        </View>
        <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi'
            ? 'Hôm nay 58—142 · TB 7 ngày 64'
            : 'Today 58—142 · 7d avg 64'}
        </FlowText>
      </GlassSurface>

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
  move,
  exercise,
  stand,
  move_color,
  exercise_color,
  stand_color,
}: {
  move: number;
  exercise: number;
  stand: number;
  move_color: string;
  exercise_color: string;
  stand_color: string;
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
      <Ring size={120} stroke={6} progress={move} color={move_color} />
      <View style={{ position: 'absolute' }}>
        <Ring size={94} stroke={6} progress={exercise} color={exercise_color} />
      </View>
      <View style={{ position: 'absolute' }}>
        <Ring size={68} stroke={6} progress={stand} color={stand_color} />
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
  // Approximate ring with full circle stroke + opacity tied to progress.
  // Real arc rendering would require react-native-svg. For visual richness
  // on Pencil parity we layer two concentric: dim track + bright "progress"
  // overlay (full circle, but its opacity scales with progress).
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        opacity: 0.25 + progress * 0.65,
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
        variant="titleL"
        tone="primary"
        style={{ fontSize: 17, lineHeight: 20, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </FlowText>
    </View>
  );
}

function SleepStagesBar({ colors }: { colors: string[] }) {
  // 4-segment vertical bar for sleep stages
  const segments = [
    { color: colors[0], height: 32 },
    { color: colors[1], height: 48 },
    { color: colors[2], height: 18 },
    { color: colors[3], height: 10 },
  ];
  return (
    <View
      style={{
        width: 8,
        height: 108,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {segments.map((s, i) => (
        <View key={i} style={{ width: 8, height: s.height, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

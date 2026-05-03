import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AuroraScreen,
  GlassSurface,
  FlowText,
  OrbDial,
  GradientButton,
  BreathingDot,
  useAurora,
} from '../../aurora';
import { useAuthStore } from '../../store/auth.store';
import { useCapture } from '../../components/v2';
import { useAiKeyStatus } from '../../hooks/useAiKeyStatus';
import { useDashboardSummary } from '../../hooks/useDashboard';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Round 44: TodayAurora reads the existing /api/dashboard/summary endpoint
 * (already used by the v1 HomeScreen since R30) and renders the same data
 * in the Aurora visual language — but with clearer Vietnamese copy and
 * proper empty/loading/error states. No more hardcoded "7.4h sleep"
 * placeholders.
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

  const aiKeyMissing = aiKey.data && !aiKey.data.enabled;
  const greeting = greetingFor(t.moment, locale);
  const summary = dash.data;

  return (
    <AuroraScreen>
      {/* Header: time-of-day kicker + settings gear */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.space['3'],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['3'] }}>
          <BreathingDot color={t.palette.accent} size={6} />
          <FlowText variant="kicker" tone="secondary">
            {momentLabel(t.moment, locale)}
          </FlowText>
        </View>
        <Pressable
          onPress={() => navigation.navigate('AISettings')}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.palette.glassTint,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={locale === 'vi' ? 'Cài đặt' : 'Settings'}
        >
          <FlowText variant="caption" tone="primary">
            ⚙
          </FlowText>
        </Pressable>
      </View>

      {/* Hero greeting */}
      <View>
        <FlowText variant="hero" tone="primary">
          {greeting}
        </FlowText>
        {userName ? (
          <FlowText variant="titleL" tone="secondary" style={{ marginTop: t.space['1'] }}>
            {userName}.
          </FlowText>
        ) : null}
      </View>

      {/* AI key banner — show when not configured */}
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
                <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['2'] }}>
                  {locale === 'vi'
                    ? 'Sau đó AI sẽ học thói quen, gợi ý đúng lúc, đúng việc.'
                    : 'Then AI learns your habits and suggests the right thing at the right time.'}
                </FlowText>
              </View>
              <FlowText variant="titleL" tone="accent">
                →
              </FlowText>
            </View>
          </GlassSurface>
        </Pressable>
      ) : null}

      {/* Smart brief / hero card */}
      {dash.isLoading ? (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="bodyM" tone="secondary">
            {locale === 'vi' ? 'Đang tải…' : 'Loading…'}
          </FlowText>
        </GlassSurface>
      ) : dash.isError ? (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'KHÔNG TẢI ĐƯỢC' : "COULDN'T LOAD"}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Mạng có vấn đề. Kéo xuống để thử lại.'
              : 'Network issue. Pull to retry.'}
          </FlowText>
          <View style={{ marginTop: t.space['4'] }}>
            <GradientButton
              label={locale === 'vi' ? 'Thử lại' : 'Retry'}
              variant="glass"
              onPress={() => dash.refetch()}
            />
          </View>
        </GlassSurface>
      ) : summary?.smartBrief ? (
        <GlassSurface pad="6" radius="2xl" intensity={1.2}>
          <FlowText variant="kicker" tone="accent">
            {locale === 'vi' ? 'TÓM TẮT HÔM NAY' : "TODAY'S BRIEF"}
          </FlowText>
          <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
            {summary.smartBrief.headline}
          </FlowText>
          {summary.smartBrief.body ? (
            <FlowText
              variant="bodyM"
              tone="secondary"
              style={{ marginTop: t.space['3'], lineHeight: 24 }}
            >
              {summary.smartBrief.body}
            </FlowText>
          ) : null}
          {summary.smartBrief.primaryAction ? (
            <View style={{ marginTop: t.space['5'] }}>
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
      ) : (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'CHƯA CÓ DỮ LIỆU' : 'NO DATA YET'}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Ghi vài điều để AI bắt đầu hiểu bạn'
              : 'Capture a few things so AI can start understanding you'}
          </FlowText>
          <View style={{ marginTop: t.space['4'] }}>
            <GradientButton
              label={locale === 'vi' ? 'Ghi nhanh' : 'Quick capture'}
              onPress={() => capture.open()}
            />
          </View>
        </GlassSurface>
      )}

      {/* Two-up tiles: real sleep + real money */}
      {summary ? (
        <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'GIẤC NGỦ GẦN NHẤT' : 'LATEST SLEEP'}
            </FlowText>
            {summary.moodSleep.lastSleepMinutes != null ? (
              <>
                <FlowText
                  variant="displayM"
                  tone="primary"
                  style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}
                >
                  {(summary.moodSleep.lastSleepMinutes / 60).toFixed(1)}
                  <FlowText variant="bodyM" tone="tertiary">
                    {' '}
                    h
                  </FlowText>
                </FlowText>
                <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['1'] }}>
                  {sleepQualityLabel(summary.moodSleep.lastSleepQuality, locale)}
                </FlowText>
              </>
            ) : (
              <>
                <FlowText
                  variant="displayM"
                  tone="tertiary"
                  style={{ marginTop: t.space['2'] }}
                >
                  —
                </FlowText>
                <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['1'] }}>
                  {locale === 'vi' ? 'Chưa ghi giấc nào' : 'No sleep logged yet'}
                </FlowText>
              </>
            )}
          </GlassSurface>

          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'CHI TUẦN NÀY' : 'WEEK SPEND'}
            </FlowText>
            <FlowText
              variant="displayM"
              tone="primary"
              style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}
            >
              {formatVnd(summary.money.weekTotal)}
            </FlowText>
            <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['1'] }}>
              {locale === 'vi'
                ? `Hôm nay: ${formatVnd(summary.money.todayTotal)} ₫`
                : `Today: ${formatVnd(summary.money.todayTotal)} ₫`}
            </FlowText>
          </GlassSurface>
        </View>
      ) : null}

      {/* Next task */}
      {summary?.nextTask ? (
        <Pressable
          onPress={() => {
            navigation.navigate('Tasks');
          }}
        >
          <GlassSurface pad="5" radius="xl">
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'VIỆC TIẾP THEO' : 'NEXT TASK'}
            </FlowText>
            <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
              {summary.nextTask.title}
            </FlowText>
            {summary.nextTask.dueAt ? (
              <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['1'] }}>
                {locale === 'vi' ? 'Hạn' : 'Due'}: {formatDueLabel(summary.nextTask.dueAt, locale)}
              </FlowText>
            ) : null}
          </GlassSurface>
        </Pressable>
      ) : null}

      {/* Suggested captures */}
      {summary?.suggestedCaptures && summary.suggestedCaptures.length > 0 ? (
        <View>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'GỢI Ý GHI NHANH' : 'SUGGESTED CAPTURES'}
          </FlowText>
          <View style={{ marginTop: t.space['3'], gap: t.space['2'] }}>
            {summary.suggestedCaptures.slice(0, 3).map((s, i) => (
              <Pressable
                key={i}
                onPress={() =>
                  capture.open({
                    initialText: s.text,
                    initialKind: (s.mode ?? null) as never,
                  })
                }
              >
                <GlassSurface pad="4" radius="lg" intensity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['3'] }}>
                    <FlowText variant="bodyM" tone="primary" style={{ flex: 1 }}>
                      {s.text}
                    </FlowText>
                    <FlowText variant="caption" tone="accent">
                      +
                    </FlowText>
                  </View>
                </GlassSurface>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Always-available capture chips */}
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'GHI NHANH' : 'CAPTURE'}
        </FlowText>
        <View
          style={{
            flexDirection: 'row',
            gap: t.space['2'],
            marginTop: t.space['3'],
            flexWrap: 'wrap',
          }}
        >
          {[
            { kind: 'EXPENSE' as const, vi: 'Chi tiêu', en: 'Expense' },
            { kind: 'TASK' as const, vi: 'Việc làm', en: 'Task' },
            { kind: 'MEAL' as const, vi: 'Bữa ăn', en: 'Meal' },
            { kind: 'MOOD' as const, vi: 'Tâm trạng', en: 'Mood' },
            { kind: 'SLEEP' as const, vi: 'Giấc ngủ', en: 'Sleep' },
          ].map((s) => (
            <GradientButton
              key={s.kind}
              label={`+ ${locale === 'vi' ? s.vi : s.en}`}
              variant="glass"
              onPress={() => capture.open({ initialKind: s.kind })}
              style={{ minWidth: 110 }}
            />
          ))}
        </View>
      </View>
    </AuroraScreen>
  );
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

function momentLabel(moment: string, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    switch (moment) {
      case 'dawn':
        return 'BÌNH MINH';
      case 'noon':
        return 'GIỮA TRƯA';
      case 'afternoon':
        return 'CHIỀU';
      case 'dusk':
        return 'TỐI';
      case 'night':
      default:
        return 'ĐÊM';
    }
  }
  return moment.toUpperCase();
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

function formatVnd(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return String(amount);
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
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      due.getFullYear() === tomorrow.getFullYear() &&
      due.getMonth() === tomorrow.getMonth() &&
      due.getDate() === tomorrow.getDate();
    if (isTomorrow) return locale === 'vi' ? `mai ${time}` : `tomorrow ${time}`;
    return due.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
  } catch {
    return iso;
  }
}

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
import { useLatestMood } from '../../hooks/useFeed';
import { journalService, type Mood } from '../../services/api/journal.service';

const MOOD_NUMERIC: Record<Mood, number> = {
  GREAT: 9,
  GOOD: 7.5,
  OK: 6,
  TIRED: 4.5,
  STRESSED: 3.5,
  SAD: 2.5,
};

/**
 * MindAurora — Pencil R45 layout. Hero phrase derived from latest mood.
 * 7-day chart driven by REAL /mood-logs?range=week + grouped by day.
 * Reflection card surfaces a recent journal note (if any). AI insight
 * shown only when there's enough mood signal to compute.
 */
export function MindAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const latestMood = useLatestMood();
  const moodWeek = useQuery({
    queryKey: ['mood', 'week'],
    queryFn: () => journalService.listMood('week'),
    staleTime: 60_000,
  });

  const dayValues = useMemo(() => {
    return groupMoodsByDay(moodWeek.data?.rows ?? []);
  }, [moodWeek.data?.rows]);
  const filledDays = dayValues.filter((d) => d.value != null).length;
  const avg = useMemo(() => {
    const vals = dayValues.map((d) => d.value).filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [dayValues]);
  const todayValue =
    dayValues[dayValues.length - 1]?.value ??
    (latestMood.data ? MOOD_NUMERIC[latestMood.data.mood] : null);

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Tâm trí' : 'Mind'}
        iconName="book-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Nhật ký' : 'Journal'}
      />

      {/* Eyebrow + serif hero */}
      <View style={{ gap: 10 }}>
        <FlowText
          variant="kicker"
          tone="secondary"
          style={{ fontSize: 11, letterSpacing: 1.5 }}
        >
          {todayValue != null
            ? locale === 'vi'
              ? `TÂM TRẠNG · ${todayValue.toFixed(1)} / 10`
              : `MOOD · ${todayValue.toFixed(1)} / 10`
            : locale === 'vi'
            ? 'TÂM TRẠNG · CHƯA GHI'
            : 'MOOD · NOT LOGGED'}
        </FlowText>
        <FlowText
          variant="displayM"
          tone="primary"
          style={{ fontSize: 32, lineHeight: 38 }}
        >
          {moodHeroTitle(todayValue, locale)}
        </FlowText>
      </View>

      {/* Mood chart card */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'TÂM TRẠNG · 7 NGÀY' : 'MOOD · 7 DAYS'}
          </FlowText>
          <FlowText
            variant="monoData"
            style={{
              color: avg != null ? t.palette.accentGlow : t.palette.inkTertiary,
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {avg != null
              ? `${locale === 'vi' ? 'TB ' : 'AVG '}${avg.toFixed(1)} · ${filledDays}/7`
              : locale === 'vi'
              ? 'CHƯA CÓ DỮ LIỆU'
              : 'NO DATA'}
          </FlowText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            height: 88,
            gap: 8,
            marginTop: t.space['3'],
          }}
        >
          {dayValues.map((d, i) => {
            const isToday = i === dayValues.length - 1;
            if (d.value == null) {
              return (
                <View
                  key={d.label}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                />
              );
            }
            const h = Math.max(10, (d.value / 10) * 88);
            const color =
              d.value < 5
                ? t.kind.expense
                : d.value >= 8
                ? t.palette.accent
                : t.palette.accentGlow;
            return (
              <View
                key={d.label}
                style={{
                  flex: 1,
                  height: h,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  backgroundColor: color,
                  opacity: isToday ? 1 : 0.7,
                }}
              />
            );
          })}
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 6,
          }}
        >
          {dayValues.map((d, i) => (
            <FlowText
              key={d.label}
              variant="caption"
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 9,
                letterSpacing: 0.5,
                color: i === dayValues.length - 1 ? t.palette.inkSecondary : t.palette.inkTertiary,
              }}
            >
              {d.label}
            </FlowText>
          ))}
        </View>
      </GlassSurface>

      {/* Reflection card — show latest mood note if any, else prompt */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <FlowText variant="kicker" tone="tertiary">
          {latestMood.data?.note
            ? locale === 'vi'
              ? 'GHI CHÉP · GẦN NHẤT'
              : 'REFLECTION · LATEST'
            : locale === 'vi'
            ? 'CÂU HỎI HÔM NAY'
            : "TODAY'S QUESTION"}
        </FlowText>
        <FlowText
          variant="titleL"
          tone="primary"
          style={{
            marginTop: t.space['3'],
            fontStyle: 'italic',
            lineHeight: 26,
          }}
        >
          {latestMood.data?.note
            ? `"${latestMood.data.note}"`
            : locale === 'vi'
            ? 'Điều gì hôm nay khiến bạn cảm thấy "đúng", dù chỉ một chút?'
            : 'What today felt "right", even just a little?'}
        </FlowText>
        {!latestMood.data?.note ? (
          <View style={{ marginTop: t.space['4'] }}>
            <GradientButton
              label={locale === 'vi' ? 'Viết câu trả lời' : 'Write an answer'}
              onPress={() => capture.open({ initialKind: 'NOTE' })}
            />
          </View>
        ) : null}
      </GlassSurface>

      {/* AI insight — only when enough data */}
      {avg != null && filledDays >= 3 ? (
        <GlassSurface pad="5" radius="xl" intensity={1.2}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FlowText style={{ color: t.palette.accent, fontSize: 14 }}>✦</FlowText>
            <FlowText
              variant="kicker"
              style={{
                color: t.palette.accent,
                fontSize: 10,
                letterSpacing: 1.5,
              }}
            >
              {locale === 'vi' ? 'AURORA NHẬN THẤY' : 'AURORA SEES'}
            </FlowText>
          </View>
          <FlowText
            variant="titleL"
            tone="primary"
            style={{ marginTop: t.space['3'], lineHeight: 26 }}
          >
            {auroraInsight(avg, dayValues, locale)}
          </FlowText>
        </GlassSurface>
      ) : (
        <GlassSurface pad="5" radius="xl" intensity={1.0}>
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'CẦN THÊM DỮ LIỆU' : 'NEEDS MORE DATA'}
          </FlowText>
          <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? `Ghi mood ít nhất 3 ngày trong tuần để Aurora rút ra nhận xét. Đã ghi ${filledDays}/7.`
              : `Log mood at least 3 days this week so Aurora can draw insights. Logged ${filledDays}/7.`}
          </FlowText>
        </GlassSurface>
      )}

      {/* Quick add */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Suy nghĩ' : '+ Thought'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'NOTE' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Mood' : '+ Mood'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'MOOD' })}
          style={{ flex: 1 }}
        />
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

interface MoodRow {
  mood: Mood;
  loggedAt: string;
}

/** Bucket mood logs into the last 7 days; average within each day. */
function groupMoodsByDay(rows: MoodRow[]): { label: string; value: number | null }[] {
  const dows = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const today = new Date();
  const days: { date: Date; label: string; values: number[] }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d, label: dows[d.getDay()], values: [] });
  }
  for (const r of rows) {
    const t = new Date(r.loggedAt);
    t.setHours(0, 0, 0, 0);
    const slot = days.find((d) => d.date.getTime() === t.getTime());
    if (slot) slot.values.push(MOOD_NUMERIC[r.mood]);
  }
  return days.map((d) => ({
    label: d.label,
    value: d.values.length === 0 ? null : d.values.reduce((a, b) => a + b, 0) / d.values.length,
  }));
}

function moodHeroTitle(today: number | null, locale: 'vi' | 'en'): string {
  if (today == null) {
    return locale === 'vi' ? 'Hôm nay thế nào?\nGhi mood để bắt đầu.' : 'How is today?\nLog mood to begin.';
  }
  if (locale === 'vi') {
    if (today >= 8) return 'Lạc quan & tỉnh táo.\nNgày để nghĩ lớn.';
    if (today >= 6) return 'Bình ổn, đủ nghĩ.\nHít thở chậm.';
    if (today >= 4) return 'Hơi nặng nề.\nCho mình nghỉ một nhịp.';
    return 'Cần được lắng nghe.\nViết ra một câu thôi.';
  }
  if (today >= 8) return 'Optimistic & clear.\nA day to think big.';
  if (today >= 6) return 'Steady, enough room.\nBreathe slow.';
  if (today >= 4) return 'A little heavy.\nLet yourself pause.';
  return 'Worth being heard.\nWrite even a single line.';
}

function auroraInsight(
  avg: number,
  dayValues: { label: string; value: number | null }[],
  locale: 'vi' | 'en',
): string {
  const peakDay = dayValues
    .filter((d) => d.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const lowDay = dayValues
    .filter((d) => d.value != null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  if (!peakDay || !lowDay) return '';
  if (avg >= 7) {
    return locale === 'vi'
      ? `Tuần này khá vững — đỉnh điểm hôm ${peakDay.label} (${peakDay.value!.toFixed(1)}). Giữ nhịp này.`
      : `Steady week — peak on ${peakDay.label} (${peakDay.value!.toFixed(1)}). Keep this rhythm.`;
  }
  if (avg >= 5) {
    return locale === 'vi'
      ? `Trung bình ${avg.toFixed(1)}. Hôm ${lowDay.label} thấp nhất (${lowDay.value!.toFixed(1)}) — chú ý điều gì khác biệt hôm đó.`
      : `Avg ${avg.toFixed(1)}. ${lowDay.label} was lowest (${lowDay.value!.toFixed(1)}) — notice what was different.`;
  }
  return locale === 'vi'
    ? `Tuần này hơi nặng (TB ${avg.toFixed(1)}). Cân nhắc một bước nhỏ — đi bộ, gọi bạn, hoặc viết.`
    : `Heavy week (avg ${avg.toFixed(1)}). Consider one small step — walk, call a friend, or write.`;
}

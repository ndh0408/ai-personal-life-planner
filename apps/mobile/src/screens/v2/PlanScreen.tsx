import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenContainer,
  SectionHeader,
  Surface,
  Text,
  Insight,
  Tile,
  Chip,
  useCapture,
} from '../../components/v2';
import { useTheme } from '../../theme/v2';

/**
 * Plan — calendar + tasks fused. Day view default. Round 41 uses a
 * placeholder timeline; real Calendar / Tasks query lands in Round 42.
 */
export function PlanScreenV2() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();

  const dayStrip = useMemo(() => buildDayStrip(7), []);
  const today = new Date();
  const todayKey = today.toDateString();

  return (
    <ScreenContainer>
      <View>
        <Text variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'KẾ HOẠCH' : 'PLAN'}
        </Text>
        <Text variant="displayM" tone="primary" style={{ marginTop: t.space['1'] }}>
          {locale === 'vi' ? 'Hôm nay' : 'Today'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: t.space['2'] }}>
        {dayStrip.map((d) => {
          const isToday = d.date.toDateString() === todayKey;
          return (
            <View
              key={d.iso}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: t.space['3'],
                borderRadius: t.radius.lg,
                backgroundColor: isToday ? t.color.accent.soft : 'transparent',
                borderWidth: 1,
                borderColor: isToday ? t.color.accent.base : t.color.border.hairline,
              }}
            >
              <Text variant="micro" tone={isToday ? 'accent' : 'tertiary'}>
                {d.dow.toUpperCase()}
              </Text>
              <Text
                variant="titleL"
                tone={isToday ? 'accent' : 'primary'}
                style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
              >
                {d.day}
              </Text>
            </View>
          );
        })}
      </View>

      <SectionHeader title={locale === 'vi' ? 'Lịch trình' : 'Schedule'} />

      <Surface level="surface" radius="xl" bordered>
        {[
          { time: '09:00', title: locale === 'vi' ? 'Deep work · Spec rebuild' : 'Deep work · Spec rebuild', tone: 'accent' as const, dur: '2h' },
          { time: '11:30', title: locale === 'vi' ? 'Cà phê với Hà' : 'Coffee with Ha', tone: 'neutral' as const, dur: '45m' },
          { time: '14:00', title: locale === 'vi' ? 'Họp đội — review' : 'Team meeting — review', tone: 'invite' as const, dur: '1h' },
          { time: '17:00', title: locale === 'vi' ? 'Tập gym' : 'Gym session', tone: 'celebrate' as const, dur: '1h' },
        ].map((it, idx, arr) => (
          <View
            key={it.time}
            style={{
              flexDirection: 'row',
              padding: t.space['4'],
              borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
              borderBottomColor: t.color.border.hairline,
              gap: t.space['4'],
            }}
          >
            <View style={{ width: 56 }}>
              <Text variant="monoData" tone="primary">
                {it.time}
              </Text>
              <Text variant="caption" tone="tertiary">
                {it.dur}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleM" tone="primary">
                {it.title}
              </Text>
            </View>
          </View>
        ))}
      </Surface>

      <Insight
        tone="invite"
        kicker={locale === 'vi' ? 'AI ĐỀ XUẤT' : 'AI SUGGESTS'}
        title={
          locale === 'vi'
            ? 'Bạn có 90 phút trống lúc 15:00'
            : "You have 90 minutes free at 15:00"
        }
        body={
          locale === 'vi'
            ? 'Phù hợp cho deep work hoặc viết blog. Hôm nay là thứ ba — pattern của bạn cho thấy tỉ lệ hoàn thành cao nhất khung này.'
            : 'Good for deep work or writing. Tuesdays are your highest completion rate in this slot.'
        }
        evidenceCount={2}
        onWhyPress={() => undefined}
        primaryAction={{
          label: locale === 'vi' ? 'Đặt block' : 'Block it',
          onPress: () => undefined,
        }}
      />

      <SectionHeader
        title={locale === 'vi' ? 'Việc cần làm' : 'Tasks'}
        action={{ label: locale === 'vi' ? 'Tất cả' : 'View all', onPress: () => undefined }}
      />
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'HÔM NAY' : 'TODAY'}
            metric="3"
            subtitle={locale === 'vi' ? 'còn lại — 1 deadline' : 'remaining — 1 due'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'TUẦN NÀY' : 'THIS WEEK'}
            metric="14"
            subtitle={locale === 'vi' ? '78% xong' : '78% done'}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: t.space['2'],
          marginTop: t.space['1'],
        }}
      >
        <Chip
          label={locale === 'vi' ? '+ Việc nhanh' : '+ Quick task'}
          accent={t.color.accent.base}
          onPress={() => capture.open({ initialKind: 'TASK' })}
        />
        <Chip
          label={locale === 'vi' ? '+ Sự kiện' : '+ Event'}
          accent={t.color.kind.task}
          onPress={() => capture.open({ initialKind: 'EVENT' })}
        />
      </View>
    </ScreenContainer>
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

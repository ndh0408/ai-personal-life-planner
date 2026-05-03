import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuroraScreen, GlassSurface, FlowText, GradientButton, useAurora } from '../../aurora';
import { useCapture } from '../../components/v2';

export function PlanAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const days = useMemo(() => buildDayStrip(7), []);
  const todayKey = new Date().toDateString();

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'KẾ HOẠCH' : 'PLAN'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Hôm nay.' : 'Today.'}
        </FlowText>
      </View>

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
                {d.dow.toUpperCase()}
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

      <View>
        <FlowText variant="titleL" tone="primary">
          {locale === 'vi' ? 'Lịch trình' : 'Schedule'}
        </FlowText>
        <View style={{ marginTop: t.space['4'], gap: t.space['3'] }}>
          {[
            { time: '09:00', dur: '2h', title: locale === 'vi' ? 'Deep work · Spec rebuild' : 'Deep work · Spec rebuild', accent: t.kind.task },
            { time: '11:30', dur: '45m', title: locale === 'vi' ? 'Cà phê với Hà' : 'Coffee with Ha', accent: t.kind.note },
            { time: '14:00', dur: '1h', title: locale === 'vi' ? 'Họp đội' : 'Team meeting', accent: t.kind.event },
            { time: '17:00', dur: '1h', title: locale === 'vi' ? 'Tập gym' : 'Gym session', accent: t.kind.meal },
          ].map((it) => (
            <GlassSurface key={it.time} pad="5" radius="xl">
              <View style={{ flexDirection: 'row', gap: t.space['4'] }}>
                <View style={{ width: 4, backgroundColor: it.accent, borderRadius: 2 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['3'] }}>
                    <FlowText variant="monoData" tone="primary">
                      {it.time}
                    </FlowText>
                    <FlowText variant="caption" tone="tertiary">
                      {it.dur}
                    </FlowText>
                  </View>
                  <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['1'] }}>
                    {it.title}
                  </FlowText>
                </View>
              </View>
            </GlassSurface>
          ))}
        </View>
      </View>

      <GlassSurface pad="6" radius="2xl" intensity={1.4}>
        <FlowText variant="kicker" tone="accent">
          {locale === 'vi' ? 'AI ĐỀ XUẤT' : 'AI SUGGESTS'}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
          {locale === 'vi' ? 'Bạn có 90 phút trống lúc 15:00' : 'You have 90 min free at 15:00'}
        </FlowText>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? 'Phù hợp deep work hoặc viết. Thứ ba — pattern bạn cho thấy tỉ lệ hoàn thành cao nhất khung này.'
            : 'Good for deep work or writing. Tuesdays — your pattern shows highest completion rate in this slot.'}
        </FlowText>
        <View style={{ marginTop: t.space['5'] }}>
          <GradientButton label={locale === 'vi' ? 'Đặt block' : 'Block it'} onPress={() => undefined} />
        </View>
      </GlassSurface>

      <View>
        <FlowText variant="titleL" tone="primary">
          {locale === 'vi' ? 'Việc cần làm' : 'Tasks'}
        </FlowText>
        <View style={{ flexDirection: 'row', gap: t.space['3'], marginTop: t.space['4'] }}>
          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'HÔM NAY' : 'TODAY'}
            </FlowText>
            <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'] }}>
              3
            </FlowText>
            <FlowText variant="caption" tone="secondary">
              {locale === 'vi' ? 'còn lại · 1 deadline' : 'remaining · 1 due'}
            </FlowText>
          </GlassSurface>
          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'TUẦN' : 'WEEK'}
            </FlowText>
            <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'] }}>
              14
            </FlowText>
            <FlowText variant="caption" tone="secondary">
              {locale === 'vi' ? '78% xong' : '78% done'}
            </FlowText>
          </GlassSurface>
        </View>
        <View style={{ flexDirection: 'row', gap: t.space['3'], marginTop: t.space['4'] }}>
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
      </View>
    </AuroraScreen>
  );
}

function buildDayStrip(days: number) {
  const today = new Date();
  const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const out: { iso: string; date: Date; dow: string; day: number }[] = [];
  for (let i = -2; i < days - 2; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      date: d,
      dow: dows[d.getDay()],
      day: d.getDate(),
    });
  }
  return out;
}

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuroraScreen, GlassSurface, FlowText, GradientButton, useAurora } from '../../aurora';
import { useCapture } from '../../components/v2';

export function MindAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'NỘI TÂM' : 'MIND'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Khoảng lặng.' : 'A pause.'}
        </FlowText>
      </View>

      <GlassSurface pad="7" radius="3xl" intensity={1.3}>
        <FlowText variant="kicker" tone="accent">
          {locale === 'vi' ? 'NHẬT KÝ HÔM NAY' : "TODAY'S JOURNAL"}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'], fontStyle: 'italic' }}>
          {locale === 'vi' ? 'Một câu hỏi nhỏ:' : 'A small question:'}
        </FlowText>
        <FlowText variant="bodyL" tone="primary" style={{ marginTop: t.space['3'], lineHeight: 28 }}>
          {locale === 'vi'
            ? 'Điều gì hôm nay khiến bạn cảm thấy "đúng", dù chỉ một chút?'
            : 'What today felt "right", even just a little?'}
        </FlowText>
        <View style={{ marginTop: t.space['6'] }}>
          <GradientButton
            label={locale === 'vi' ? 'Viết câu trả lời' : 'Write an answer'}
            onPress={() => capture.open({ initialKind: 'NOTE' })}
          />
        </View>
      </GlassSurface>

      <GlassSurface pad="6" radius="2xl" intensity={1.0}>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'TUẦN QUA' : 'PAST WEEK'}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
          {locale === 'vi' ? 'Mood trung bình 3.8/5 — ổn định' : 'Mood avg 3.8/5 — stable'}
        </FlowText>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? '5 lần ghi mood, 0 ngày dưới 3. Cao nhất hôm thứ ba sau buổi chạy bộ.'
            : '5 mood logs, 0 days below 3. Peak was Tuesday after a run.'}
        </FlowText>
      </GlassSurface>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'Ý TƯỞNG' : 'IDEAS'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'] }}>
            12
          </FlowText>
          <FlowText variant="caption" tone="secondary">
            {locale === 'vi' ? 'tháng này' : 'this month'}
          </FlowText>
        </GlassSurface>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'GHI CHÚ' : 'NOTES'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'] }}>
            48
          </FlowText>
          <FlowText variant="caption" tone="secondary">
            {locale === 'vi' ? 'tháng này' : 'this month'}
          </FlowText>
        </GlassSurface>
      </View>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Ý tưởng' : '+ Idea'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'IDEA' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Ghi chú' : '+ Note'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'NOTE' })}
          style={{ flex: 1 }}
        />
      </View>
    </AuroraScreen>
  );
}

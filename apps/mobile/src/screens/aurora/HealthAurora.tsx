import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuroraScreen,
  GlassSurface,
  FlowText,
  OrbDial,
  AuroraSparkline,
  GradientButton,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';

export function HealthAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const sleep7d = [6.8, 7.1, 6.4, 7.8, 7.2, 7.6, 7.4];
  const steps7d = [7.8, 9.2, 5.4, 11.2, 8.6, 6.9, 8.1];
  const hr7d = [62, 64, 61, 60, 63, 65, 62];

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'CƠ THỂ' : 'BODY'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Tuần này.' : 'This week.'}
        </FlowText>
      </View>

      <GlassSurface pad="7" radius="3xl" intensity={1.2}>
        <View style={{ alignItems: 'center', gap: t.space['4'] }}>
          <OrbDial score={74} size={156} label="74" caption={locale === 'vi' ? 'sức khoẻ' : 'wellbeing'} />
          <FlowText variant="bodyL" tone="primary" style={{ textAlign: 'center', maxWidth: 300 }}>
            {locale === 'vi'
              ? 'Tốt — đang vào nhịp.'
              : 'Good — finding rhythm.'}
          </FlowText>
          <FlowText variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
            {locale === 'vi'
              ? 'Ngủ +0:30, bước thiếu 1.2k, mood ổn.'
              : 'Sleep +0:30, 1.2k steps short, mood stable.'}
          </FlowText>
        </View>
      </GlassSurface>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'GIẤC NGỦ' : 'SLEEP'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}>
            7.4h
          </FlowText>
          <View style={{ marginTop: t.space['3'] }}>
            <AuroraSparkline data={sleep7d} width={140} height={40} color={t.kind.sleep} />
          </View>
        </GlassSurface>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'BƯỚC' : 'STEPS'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}>
            8.1k
          </FlowText>
          <View style={{ marginTop: t.space['3'] }}>
            <AuroraSparkline data={steps7d} width={140} height={40} />
          </View>
        </GlassSurface>
      </View>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'NHỊP TIM' : 'HEART RATE'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}>
            62
          </FlowText>
          <FlowText variant="caption" tone="tertiary">
            bpm · resting
          </FlowText>
          <View style={{ marginTop: t.space['3'] }}>
            <AuroraSparkline data={hr7d} width={140} height={40} color={t.kind.expense} />
          </View>
        </GlassSurface>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'TÂM TRẠNG' : 'MOOD'}
          </FlowText>
          <FlowText variant="displayM" tone="primary" style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}>
            3.8
          </FlowText>
          <FlowText variant="caption" tone="tertiary">
            /5 · {locale === 'vi' ? 'ổn định' : 'stable'}
          </FlowText>
        </GlassSurface>
      </View>

      <GlassSurface pad="6" radius="2xl" intensity={1.4}>
        <FlowText variant="kicker" tone="accent">
          {locale === 'vi' ? 'GỢI Ý' : 'NUDGE'}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
          {locale === 'vi' ? '1.2k bước trước 19:00 là vừa đủ' : '1.2k steps before 19:00 hits the target'}
        </FlowText>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? 'Một vòng 12 phút quanh khu là đủ. Tuần trước bạn hay đi lúc 18:30.'
            : 'A 12-minute walk does it. Last week you usually walked at 18:30.'}
        </FlowText>
      </GlassSurface>

      <View style={{ flexDirection: 'row', gap: t.space['3'], flexWrap: 'wrap' }}>
        <GradientButton
          label={locale === 'vi' ? '+ Giấc ngủ' : '+ Sleep'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'SLEEP' })}
          style={{ flex: 1, minWidth: 120 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Tâm trạng' : '+ Mood'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'MOOD' })}
          style={{ flex: 1, minWidth: 120 }}
        />
      </View>
    </AuroraScreen>
  );
}

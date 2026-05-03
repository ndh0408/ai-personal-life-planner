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
  AuroraSparkline,
  GradientButton,
  BreathingDot,
  useAurora,
} from '../../aurora';
import { useAuthStore } from '../../store/auth.store';
import { useCapture } from '../../components/v2';
import { useAiKeyStatus } from '../../hooks/useAiKeyStatus';
import type { RootStackParamList } from '../../navigation/types';

export function TodayAurora() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const aiKey = useAiKeyStatus();
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const userName = useAuthStore((s) => s.user?.displayName ?? null);
  const capture = useCapture();
  const greeting = greetingFor(t.moment, locale);
  const sleep7d = [6.8, 7.1, 6.4, 7.8, 7.2, 7.6, 7.4];

  // Round 43.2: top-right gear icon for the AI key + settings entry. Without
  // this, users on the new Aurora nav had no way to reach AISettings (no
  // Settings tab in Aurora's 5-tab shell). The gear sits in the same spot
  // as the breathing-dot row so it never competes with the hero.
  const aiKeyMissing = aiKey.data && !aiKey.data.enabled;

  return (
    <AuroraScreen>
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
            {locale === 'vi' ? 'BÂY GIỜ' : 'NOW'} · {t.moment.toUpperCase()}
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
          accessibilityLabel={locale === 'vi' ? 'Cài đặt AI' : 'AI settings'}
        >
          <FlowText variant="caption" tone="primary">
            ⚙
          </FlowText>
        </Pressable>
      </View>

      {aiKeyMissing ? (
        <Pressable onPress={() => navigation.navigate('AISettings')}>
          <GlassSurface pad="5" radius="xl" intensity={1.4}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
              <View style={{ flex: 1 }}>
                <FlowText variant="kicker" tone="accent">
                  {locale === 'vi' ? 'KHỞI ĐỘNG AI' : 'ACTIVATE AI'}
                </FlowText>
                <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
                  {locale === 'vi'
                    ? 'Nhập OpenAI key để cá nhân hoá'
                    : 'Add your OpenAI key to personalize'}
                </FlowText>
                <FlowText variant="bodyS" tone="secondary" style={{ marginTop: t.space['2'] }}>
                  {locale === 'vi'
                    ? 'Khi có key, AI sẽ học thói quen + chủ động gợi ý cho bạn.'
                    : "Once set, the AI learns your patterns and proactively suggests."}
                </FlowText>
              </View>
              <FlowText variant="titleL" tone="accent">
                →
              </FlowText>
            </View>
          </GlassSurface>
        </Pressable>
      ) : null}

      <FlowText variant="hero" tone="primary" style={{ marginTop: -t.space['2'] }}>
        {greeting}
      </FlowText>
      {userName ? (
        <FlowText variant="titleL" tone="secondary" style={{ marginTop: -t.space['5'] }}>
          {userName}.
        </FlowText>
      ) : null}

      <GlassSurface pad="6" radius="2xl">
        <View style={{ alignItems: 'center', gap: t.space['4'] }}>
          <OrbDial score={72} label="72" caption={locale === 'vi' ? 'năng lượng' : 'energy'} />
          <FlowText variant="bodyL" tone="primary" style={{ textAlign: 'center', maxWidth: 320 }}>
            {locale === 'vi'
              ? 'Bạn đang ở đỉnh nhịp. Việc khó nên xử lý ngay — 11:30 sẽ là khung tốt nhất.'
              : 'You are at the peak of your rhythm. Hard work belongs here — until 11:30.'}
          </FlowText>
          <FlowText variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
            {locale === 'vi' ? 'Dựa trên 3 ngày giấc ngủ + lịch hôm nay' : 'Based on 3 days of sleep + today\'s calendar'}
          </FlowText>
        </View>
      </GlassSurface>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'GIẤC NGỦ' : 'SLEEP'}
          </FlowText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['1'], marginTop: t.space['2'] }}>
            <FlowText variant="displayL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
              7.4
            </FlowText>
            <FlowText variant="bodyM" tone="tertiary">
              h
            </FlowText>
          </View>
          <View style={{ marginTop: t.space['3'] }}>
            <AuroraSparkline data={sleep7d} width={140} height={40} color={t.kind.sleep} />
          </View>
          <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi' ? '+0:30 vs baseline' : '+0:30 vs baseline'}
          </FlowText>
        </GlassSurface>

        <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
          <FlowText variant="kicker" tone="secondary">
            {locale === 'vi' ? 'CHI 7 NGÀY' : 'SPEND 7D'}
          </FlowText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['1'], marginTop: t.space['2'] }}>
            <FlowText variant="displayL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
              1.24
            </FlowText>
            <FlowText variant="bodyM" tone="tertiary">
              M ₫
            </FlowText>
          </View>
          <View style={{ marginTop: t.space['3'] }}>
            <AuroraSparkline
              data={[180, 220, 90, 340, 180, 120, 110]}
              width={140}
              height={40}
              color={t.kind.expense}
            />
          </View>
          <FlowText variant="caption" tone="secondary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi' ? '−12% so với tuần trước' : '−12% vs last week'}
          </FlowText>
        </GlassSurface>
      </View>

      <GlassSurface pad="6" radius="2xl" intensity={1.2}>
        <FlowText variant="kicker" tone="accent">
          {locale === 'vi' ? 'GỢI Ý' : 'NUDGE'} · CONFIDENCE 0.78
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
          {locale === 'vi'
            ? 'Còn 2 giờ trước cuộc họp. Một block sâu?'
            : 'Two hours before the meeting. Deep work block?'}
        </FlowText>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? 'Lịch trống và năng lượng đang đỉnh. Pattern tuần trước cho thấy tỉ lệ hoàn thành cao nhất ở khung này.'
            : 'Calendar is open and energy is high. Last week, completion rate peaked in this slot.'}
        </FlowText>
        <View style={{ flexDirection: 'row', gap: t.space['3'], marginTop: t.space['5'] }}>
          <GradientButton
            label={locale === 'vi' ? 'Đặt block 90 phút' : 'Block 90 min'}
            onPress={() => undefined}
            style={{ flex: 1 }}
          />
          <GradientButton
            label={locale === 'vi' ? 'Bỏ qua' : 'Skip'}
            variant="ghost"
            onPress={() => undefined}
          />
        </View>
      </GlassSurface>

      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'GHI NHANH' : 'CAPTURE'}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Một thao tác' : 'One tap'}
        </FlowText>
        <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['4'], flexWrap: 'wrap' }}>
          {[
            { kind: 'MEAL' as const, vi: 'Bữa trưa', en: 'Lunch' },
            { kind: 'EXPENSE' as const, vi: 'Cà phê', en: 'Coffee' },
            { kind: 'MOOD' as const, vi: 'Tâm trạng', en: 'Mood' },
            { kind: 'TASK' as const, vi: 'Việc', en: 'Task' },
          ].map((s) => (
            <GradientButton
              key={s.kind}
              label={`+ ${locale === 'vi' ? s.vi : s.en}`}
              variant="glass"
              onPress={() => capture.open({ initialKind: s.kind })}
              style={{ minWidth: 120 }}
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
        return 'Một bình minh mới.';
      case 'noon':
        return 'Đỉnh trưa.';
      case 'afternoon':
        return 'Chiều vàng.';
      case 'dusk':
        return 'Hoàng hôn.';
      case 'night':
      default:
        return 'Đêm sâu.';
    }
  }
  switch (moment) {
    case 'dawn':
      return 'A new dawn.';
    case 'noon':
      return 'High noon.';
    case 'afternoon':
      return 'Golden hour.';
    case 'dusk':
      return 'Soft dusk.';
    case 'night':
    default:
      return 'Deep night.';
  }
}

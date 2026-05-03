import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuroraScreen,
  GlassSurface,
  FlowText,
  AuroraSparkline,
  GradientButton,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';

export function MoneyAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const data30d = [
    320, 180, 240, 90, 410, 280, 150, 200, 370, 110, 90, 220, 340, 180, 260, 130, 90, 410,
    290, 240, 170, 380, 120, 80, 220, 310, 170, 100, 240, 190,
  ];

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'TIỀN' : 'MONEY'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Tháng 5.' : 'May.'}
        </FlowText>
      </View>

      <GlassSurface pad="7" radius="3xl" intensity={1.2}>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'CHI THÁNG' : 'MONTH SPEND'}
        </FlowText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['2'], marginTop: t.space['3'] }}>
          <FlowText variant="hero" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
            6.42
          </FlowText>
          <FlowText variant="titleL" tone="tertiary">
            triệu ₫
          </FlowText>
        </View>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? 'Dự báo cuối tháng 9.1M ₫ — −4% so với tháng trước.'
            : 'End-of-month forecast 9.1M ₫ — −4% vs last month.'}
        </FlowText>
        <View style={{ marginTop: t.space['5'] }}>
          <AuroraSparkline data={data30d} width={300} height={88} color={t.kind.expense} />
        </View>
      </GlassSurface>

      <View>
        <FlowText variant="titleL" tone="primary">
          {locale === 'vi' ? 'Theo danh mục' : 'By category'}
        </FlowText>
        <View style={{ marginTop: t.space['4'], gap: t.space['3'] }}>
          {[
            { vi: 'Ăn uống', en: 'Food', amount: '2.1M', pct: 0.34 },
            { vi: 'Đi lại', en: 'Transport', amount: '850k', pct: 0.13 },
            { vi: 'Nhà cửa', en: 'Home', amount: '1.4M', pct: 0.22 },
            { vi: 'Sức khoẻ', en: 'Health', amount: '420k', pct: 0.07 },
          ].map((c, i) => (
            <GlassSurface key={i} pad="5" radius="xl">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
                <View style={{ flex: 1 }}>
                  <FlowText variant="titleM" tone="primary">
                    {locale === 'vi' ? c.vi : c.en}
                  </FlowText>
                  <View
                    style={{
                      marginTop: t.space['3'],
                      height: 3,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${c.pct * 100}%`,
                        height: 3,
                        backgroundColor: t.palette.accent,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>
                <FlowText variant="titleL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
                  {c.amount}
                </FlowText>
              </View>
            </GlassSurface>
          ))}
        </View>
      </View>

      <GlassSurface pad="6" radius="2xl" intensity={1.4}>
        <FlowText variant="kicker" tone="accent">
          {locale === 'vi' ? 'CHÚ Ý' : 'NOTE'}
        </FlowText>
        <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['3'] }}>
          {locale === 'vi' ? 'Ăn uống tuần này +28% baseline' : 'Food +28% vs baseline this week'}
        </FlowText>
        <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['3'], lineHeight: 24 }}>
          {locale === 'vi'
            ? '5 lần ăn ngoài, 3 lần giao tận nơi. Có thể đặt 2 bữa nấu cuối tuần?'
            : '5 dine-outs, 3 deliveries. Could you batch-cook 2 meals this weekend?'}
        </FlowText>
      </GlassSurface>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Chi tiêu' : '+ Expense'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'EXPENSE' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Thu nhập' : '+ Income'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'INCOME' })}
          style={{ flex: 1 }}
        />
      </View>
    </AuroraScreen>
  );
}

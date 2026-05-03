import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenContainer,
  SectionHeader,
  Surface,
  Text,
  Tile,
  Insight,
  Sparkline,
  Chip,
  useCapture,
} from '../../components/v2';
import { useTheme } from '../../theme/v2';

/**
 * Money — single page that lets the user see flow, categories and forecast.
 * Layout: hero balance card + 30d sparkline, two-up category tiles, AI
 * insight (overspend / underspend). Real data comes from FinanceModule once
 * R42 wires the query.
 */
export function MoneyScreenV2() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();

  const data30d = [
    320, 180, 240, 90, 410, 280, 150, 200, 370, 110, 90, 220, 340, 180,
    260, 130, 90, 410, 290, 240, 170, 380, 120, 80, 220, 310, 170, 100, 240, 190,
  ];

  return (
    <ScreenContainer>
      <View>
        <Text variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'TÀI CHÍNH' : 'MONEY'}
        </Text>
        <Text variant="displayM" tone="primary" style={{ marginTop: t.space['1'] }}>
          {locale === 'vi' ? 'Tháng 5' : 'May'}
        </Text>
      </View>

      <Surface level="surface" radius="2xl" pad="6" bordered>
        <Text variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'CHI TIÊU THÁNG' : 'MONTH SPEND'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space['2'], marginTop: t.space['2'] }}>
          <Text variant="displayL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
            6.42
          </Text>
          <Text variant="titleL" tone="tertiary">
            triệu ₫
          </Text>
        </View>
        <Text variant="bodyM" tone="secondary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi'
            ? 'Dự báo cuối tháng: 9.1M ₫ (−4% so với tháng trước)'
            : 'Month-end forecast: 9.1M ₫ (−4% vs last month)'}
        </Text>
        <View style={{ marginTop: t.space['4'] }}>
          <Sparkline
            data={data30d}
            width={300}
            height={84}
            color={t.color.kind.expense}
            filled
          />
        </View>
      </Surface>

      <SectionHeader
        title={locale === 'vi' ? 'Theo danh mục' : 'By category'}
        action={{ label: locale === 'vi' ? 'Tất cả' : 'View all', onPress: () => undefined }}
      />

      <View style={{ gap: t.space['3'] }}>
        {[
          { key: 'food', vi: 'Ăn uống', en: 'Food', amount: '2.1M', pct: 0.34 },
          { key: 'transport', vi: 'Đi lại', en: 'Transport', amount: '850k', pct: 0.13 },
          { key: 'home', vi: 'Nhà cửa', en: 'Home', amount: '1.4M', pct: 0.22 },
          { key: 'health', vi: 'Sức khoẻ', en: 'Health', amount: '420k', pct: 0.07 },
        ].map((c) => (
          <Surface key={c.key} level="surface" radius="lg" pad="4" bordered>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['4'] }}>
              <View style={{ flex: 1 }}>
                <Text variant="titleM" tone="primary">
                  {locale === 'vi' ? c.vi : c.en}
                </Text>
                <View
                  style={{
                    marginTop: t.space['2'],
                    height: 4,
                    backgroundColor: t.color.border.hairline,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${c.pct * 100}%`,
                      height: 4,
                      backgroundColor: t.color.kind.expense,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
              <Text variant="titleL" tone="primary" style={{ fontVariant: ['tabular-nums'] }}>
                {c.amount}
              </Text>
            </View>
          </Surface>
        ))}
      </View>

      <Insight
        tone="concern"
        kicker={locale === 'vi' ? 'CHÚ Ý' : 'NOTE'}
        title={
          locale === 'vi'
            ? 'Ăn uống tuần này +28% so với baseline'
            : 'Food category +28% vs baseline this week'
        }
        body={
          locale === 'vi'
            ? '5 lần ăn ngoài, 3 lần giao tận nơi. Có thể đặt 2 bữa nấu tại nhà cuối tuần?'
            : '5 dine-outs, 3 deliveries. Could you batch-cook 2 meals this weekend?'
        }
        evidenceCount={2}
        onWhyPress={() => undefined}
        dismiss={() => undefined}
      />

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'TIẾT KIỆM' : 'SAVED'}
            metric="3.2M"
            unit="₫"
            subtitle={locale === 'vi' ? 'tháng này' : 'this month'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'TRUNG BÌNH/NGÀY' : 'AVG/DAY'}
            metric="214k"
            unit="₫"
            subtitle={locale === 'vi' ? '−12% so với tháng trước' : '−12% vs last month'}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: t.space['2'],
        }}
      >
        <Chip
          label={locale === 'vi' ? '+ Chi tiêu' : '+ Expense'}
          accent={t.color.kind.expense}
          onPress={() => capture.open({ initialKind: 'EXPENSE' })}
        />
        <Chip
          label={locale === 'vi' ? '+ Thu nhập' : '+ Income'}
          accent={t.color.kind.income}
          onPress={() => capture.open({ initialKind: 'INCOME' })}
        />
      </View>
    </ScreenContainer>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenContainer,
  SectionHeader,
  Surface,
  Text,
  Tile,
  MetricRing,
  Sparkline,
  Insight,
  Chip,
  useCapture,
} from '../../components/v2';
import { useTheme } from '../../theme/v2';

/**
 * Health — passive sensors first (sleep / steps / HR / mood). The user does
 * NOT log most of this; it streams in from HealthKit / Health Connect via
 * the existing device-data pipeline.
 */
export function HealthScreenV2() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();

  const sleep7d = [6.8, 7.1, 6.4, 7.8, 7.2, 7.6, 7.4];
  const steps7d = [7800, 9200, 5400, 11200, 8600, 6900, 8100];
  const hr7d = [62, 64, 61, 60, 63, 65, 62];

  return (
    <ScreenContainer>
      <View>
        <Text variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'CƠ THỂ' : 'BODY'}
        </Text>
        <Text variant="displayM" tone="primary" style={{ marginTop: t.space['1'] }}>
          {locale === 'vi' ? 'Tuần này' : 'This week'}
        </Text>
      </View>

      <Surface level="surface" radius="2xl" pad="6" bordered>
        <View style={{ flexDirection: 'row', gap: t.space['5'], alignItems: 'center' }}>
          <MetricRing
            value={0.74}
            size={108}
            label="74"
            caption={locale === 'vi' ? 'sức khỏe' : 'wellbeing'}
          />
          <View style={{ flex: 1, gap: t.space['2'] }}>
            <Text variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'TỔNG QUAN' : 'OVERVIEW'}
            </Text>
            <Text variant="titleM" tone="primary">
              {locale === 'vi' ? 'Tốt — đang vào nhịp' : 'Good — finding rhythm'}
            </Text>
            <Text variant="bodyM" tone="secondary">
              {locale === 'vi'
                ? 'Ngủ +0:30 so với baseline. Bước trung bình thiếu 1.2k. Mood ổn.'
                : 'Sleep +0:30 vs baseline. 1.2k steps short. Mood stable.'}
            </Text>
          </View>
        </View>
      </Surface>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'GIẤC NGỦ' : 'SLEEP'}
            metric="7.4"
            unit="h"
            subtitle={locale === 'vi' ? '7 ngày · TB 7.2h' : '7 days · avg 7.2h'}
            accessory={<Sparkline data={sleep7d} width={130} height={32} color={t.color.kind.sleep} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'BƯỚC' : 'STEPS'}
            metric="8.1k"
            subtitle={locale === 'vi' ? '7 ngày · TB 8.2k' : '7 days · avg 8.2k'}
            accessory={<Sparkline data={steps7d.map((s) => s / 1000)} width={130} height={32} />}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'NHỊP TIM NGHỈ' : 'RESTING HR'}
            metric="62"
            unit="bpm"
            subtitle={locale === 'vi' ? '7 ngày · TB 62' : '7 days · avg 62'}
            accessory={<Sparkline data={hr7d} width={130} height={32} color={t.color.status.danger.fg} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'TÂM TRẠNG' : 'MOOD'}
            metric="3.8"
            unit="/5"
            subtitle={locale === 'vi' ? '7 ngày · ổn định' : '7 days · stable'}
          />
        </View>
      </View>

      <Insight
        tone="invite"
        kicker={locale === 'vi' ? 'GỢI Ý' : 'NUDGE'}
        title={locale === 'vi' ? 'Đi 1.2k bước trước 19:00 là vừa đủ' : '1.2k steps before 19:00 hits your target'}
        body={
          locale === 'vi'
            ? 'Một vòng 12 phút quanh khu là đủ. Pattern tuần trước cho thấy bạn hay đi lúc 18:30.'
            : 'A 12-minute walk does it. Last week you usually walked at 18:30.'
        }
        evidenceCount={2}
        onWhyPress={() => undefined}
        primaryAction={{ label: locale === 'vi' ? 'Nhắc tôi' : 'Remind me', onPress: () => undefined }}
      />

      <SectionHeader title={locale === 'vi' ? 'Ghi nhanh' : 'Quick log'} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space['2'] }}>
        <Chip label={locale === 'vi' ? 'Giấc ngủ' : 'Sleep'} accent={t.color.kind.sleep} onPress={() => capture.open({ initialKind: 'SLEEP' })} />
        <Chip label={locale === 'vi' ? 'Tâm trạng' : 'Mood'} accent={t.color.kind.mood} onPress={() => capture.open({ initialKind: 'MOOD' })} />
        <Chip label={locale === 'vi' ? 'Bữa ăn' : 'Meal'} accent={t.color.kind.meal} onPress={() => capture.open({ initialKind: 'MEAL' })} />
      </View>
    </ScreenContainer>
  );
}

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenContainer,
  Greeting,
  EnergyDial,
  Tile,
  Insight,
  Sparkline,
  SectionHeader,
  Surface,
  Text,
  Chip,
  useCapture,
} from '../../components/v2';
import { useTheme } from '../../theme/v2';
import { useAuthStore } from '../../store/auth.store';

/**
 * Today — the "what now?" screen. Adaptive by hour-of-day; for Round 41 we
 * render with placeholder data sourced from the existing dashboard endpoint
 * once wired. Layout is the canonical hero + two-up tiles + insight + recents.
 */
export function TodayScreenV2() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const userName = useAuthStore((s) => s.user?.displayName ?? null);
  const capture = useCapture();

  return (
    <ScreenContainer>
      <Greeting name={userName} locale={locale} />

      <Surface level="surface" radius="2xl" pad="6" bordered>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['5'] }}>
          <EnergyDial score={72} caption={locale === 'vi' ? 'tốt' : 'good'} />
          <View style={{ flex: 1, gap: t.space['2'] }}>
            <Text variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'NHỊP HÔM NAY' : "TODAY'S RHYTHM"}
            </Text>
            <Text variant="titleM" tone="primary">
              {locale === 'vi'
                ? 'Bạn đang ở khung tập trung'
                : 'You are in a focus window'}
            </Text>
            <Text variant="bodyM" tone="secondary">
              {locale === 'vi'
                ? 'Năng lượng đỉnh đến 11:30. Việc khó nên xử lý ngay.'
                : 'Peak energy until 11:30. Hard work belongs here.'}
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
            subtitle={locale === 'vi' ? '+0:30 so với baseline' : '+0:30 vs baseline'}
            accessory={<Sparkline data={[6.8, 7.1, 6.4, 7.8, 7.2, 7.6, 7.4]} width={120} height={32} />}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'CHI TIÊU 7N' : 'SPEND 7D'}
            metric="1.24M"
            unit="₫"
            subtitle={locale === 'vi' ? '−12% so với tuần trước' : '−12% vs last week'}
            accessory={
              <Sparkline
                data={[180, 220, 90, 340, 180, 120, 110]}
                width={120}
                height={32}
                color={t.color.kind.expense}
              />
            }
          />
        </View>
      </View>

      <Insight
        tone="invite"
        kicker={locale === 'vi' ? 'GỢI Ý' : 'NUDGE'}
        title={
          locale === 'vi'
            ? 'Còn 2h trước cuộc họp 14:00 — đặt block deep work?'
            : '2 hours before the 14:00 meeting — schedule a deep-work block?'
        }
        body={
          locale === 'vi'
            ? 'Lịch trống và năng lượng đang ở đỉnh. Một block 90 phút phù hợp với pattern tuần trước của bạn.'
            : 'Calendar is open and energy is high. A 90-min block matches your pattern from last week.'
        }
        evidenceCount={3}
        onWhyPress={() => undefined}
        primaryAction={{
          label: locale === 'vi' ? 'Đặt block' : 'Schedule',
          onPress: () => undefined,
        }}
        dismiss={() => undefined}
      />

      <View>
        <SectionHeader
          kicker={locale === 'vi' ? 'GỢI Ý GHI NHANH' : 'SUGGESTED CAPTURE'}
          title={locale === 'vi' ? 'Một thao tác' : 'One tap away'}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.space['2'],
            marginTop: t.space['3'],
          }}
        >
          {[
            { kind: 'MEAL' as const, vi: 'Bữa trưa', en: 'Log lunch' },
            { kind: 'EXPENSE' as const, vi: 'Cà phê', en: 'Coffee' },
            { kind: 'MOOD' as const, vi: 'Tâm trạng', en: 'Mood' },
            { kind: 'TASK' as const, vi: 'Việc cần làm', en: 'Quick task' },
          ].map((s) => (
            <Chip
              key={s.kind}
              label={locale === 'vi' ? s.vi : s.en}
              accent={t.color.kind[s.kind.toLowerCase() as keyof typeof t.color.kind]}
              onPress={() => capture.open({ initialKind: s.kind })}
            />
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

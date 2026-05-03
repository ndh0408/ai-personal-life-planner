import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AuroraScreen,
  GlassSurface,
  FlowText,
  GradientButton,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';
import { useDashboardSummary } from '../../hooks/useDashboard';
import type { RootStackParamList } from '../../navigation/types';

/**
 * MoneyAurora — uses /dashboard/summary's money block as the canonical
 * money snapshot (todayTotal + weekTotal + walletBalance). When user has
 * no wallet / no expenses yet, shows a clear empty state pointing to
 * quick-capture.
 */
export function MoneyAurora() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const dash = useDashboardSummary();
  const m = dash.data?.money;

  return (
    <AuroraScreen>
      <View>
        <FlowText variant="kicker" tone="secondary">
          {locale === 'vi' ? 'TIỀN' : 'MONEY'}
        </FlowText>
        <FlowText variant="hero" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Tài chính' : 'Finance'}
        </FlowText>
      </View>

      {dash.isLoading ? (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="bodyM" tone="secondary">
            {locale === 'vi' ? 'Đang tải…' : 'Loading…'}
          </FlowText>
        </GlassSurface>
      ) : dash.isError ? (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="titleM" tone="primary">
            {locale === 'vi' ? 'Không tải được. Thử lại?' : "Couldn't load. Retry?"}
          </FlowText>
          <View style={{ marginTop: t.space['4'] }}>
            <GradientButton
              label={locale === 'vi' ? 'Thử lại' : 'Retry'}
              variant="glass"
              onPress={() => dash.refetch()}
            />
          </View>
        </GlassSurface>
      ) : m ? (
        <>
          <GlassSurface pad="7" radius="3xl" intensity={1.2}>
            <FlowText variant="kicker" tone="secondary">
              {locale === 'vi' ? 'CHI HÔM NAY' : 'TODAY SPEND'}
            </FlowText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: t.space['2'],
                marginTop: t.space['3'],
              }}
            >
              <FlowText
                variant="hero"
                tone="primary"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatVnd(m.todayTotal)}
              </FlowText>
              <FlowText variant="titleL" tone="tertiary">
                ₫
              </FlowText>
            </View>
            <FlowText
              variant="bodyM"
              tone="secondary"
              style={{ marginTop: t.space['3'], lineHeight: 24 }}
            >
              {locale === 'vi'
                ? m.todayTotal === 0
                  ? 'Chưa ghi chi tiêu nào hôm nay.'
                  : `Tuần này: ${formatVnd(m.weekTotal)} ₫`
                : m.todayTotal === 0
                ? 'No expenses logged today yet.'
                : `This week: ${formatVnd(m.weekTotal)} ₫`}
            </FlowText>
          </GlassSurface>

          <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
            <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
              <FlowText variant="kicker" tone="secondary">
                {locale === 'vi' ? 'TUẦN NÀY' : 'THIS WEEK'}
              </FlowText>
              <FlowText
                variant="displayM"
                tone="primary"
                style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}
              >
                {formatVnd(m.weekTotal)}
              </FlowText>
              <FlowText variant="caption" tone="tertiary">
                ₫
              </FlowText>
            </GlassSurface>
            <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
              <FlowText variant="kicker" tone="secondary">
                {locale === 'vi' ? 'SỐ DƯ VÍ' : 'WALLET'}
              </FlowText>
              <FlowText
                variant="displayM"
                tone="primary"
                style={{ marginTop: t.space['2'], fontVariant: ['tabular-nums'] }}
              >
                {formatVnd(m.walletBalance)}
              </FlowText>
              <FlowText variant="caption" tone="tertiary">
                ₫
              </FlowText>
            </GlassSurface>
          </View>
        </>
      ) : null}

      {/* Quick add */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Chi tiêu' : '+ Expense'}
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

      {m && m.todayTotal === 0 && m.weekTotal === 0 ? (
        <GlassSurface pad="6" radius="2xl">
          <FlowText variant="kicker" tone="accent">
            {locale === 'vi' ? 'BẮT ĐẦU' : 'GET STARTED'}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Ghi vài chi tiêu để xem bức tranh'
              : 'Log a few expenses to see the picture'}
          </FlowText>
          <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['2'], lineHeight: 22 }}>
            {locale === 'vi'
              ? 'Cứ ghi như nhắn tin: "cà phê 35k" hay "điện 320k". AI sẽ tự phân loại.'
              : 'Type like a message: "coffee 35k" or "electricity 320k". AI auto-classifies.'}
          </FlowText>
        </GlassSurface>
      ) : null}

      <Pressable onPress={() => navigation.navigate('Tasks')}>
        <GlassSurface pad="5" radius="xl" intensity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space['3'] }}>
            <FlowText variant="bodyM" tone="primary" style={{ flex: 1 }}>
              {locale === 'vi' ? 'Mở chi tiết tài chính (v1)' : 'Open finance details (v1)'}
            </FlowText>
            <FlowText variant="bodyM" tone="accent">
              →
            </FlowText>
          </View>
        </GlassSurface>
      </Pressable>
    </AuroraScreen>
  );
}

function formatVnd(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return String(amount);
}

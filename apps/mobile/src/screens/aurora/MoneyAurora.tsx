import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AuroraScreen,
  AuroraHeader,
  GlassSurface,
  FlowText,
  GradientButton,
  SettingsSheet,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';
import { useDashboardSummary } from '../../hooks/useDashboard';
import { financeService } from '../../services/api/finance.service';

function useTodayExpenses() {
  return useQuery({
    queryKey: ['expenses', 'today'],
    queryFn: () => financeService.list('today'),
    staleTime: 30_000,
  });
}

/**
 * MoneyAurora — Pencil R45 layout. Header + balance hero card (huge serif
 * VND) + Thu/Chi metric tiles + recent transactions list with category
 * dots. Pulls money block from /dashboard/summary + today expenses list.
 */
export function MoneyAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const dash = useDashboardSummary();
  const expenses = useTodayExpenses();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const m = dash.data?.money;

  const monthLabel = formatMonthLabel(new Date(), locale);

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Tài chính' : 'Finance'}
        iconName="calendar-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Lịch' : 'Calendar'}
      />

      {/* Hero balance card */}
      <GlassSurface pad="6" radius="3xl" intensity={1.1}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlowText
            variant="kicker"
            tone="tertiary"
            style={{ fontSize: 10, letterSpacing: 1.5 }}
          >
            {locale === 'vi'
              ? `TỔNG SỐ DƯ · ${monthLabel}`
              : `TOTAL BALANCE · ${monthLabel}`}
          </FlowText>
        </View>
        <FlowText
          variant="hero"
          tone="primary"
          style={{
            marginTop: t.space['3'],
            fontSize: 48,
            lineHeight: 52,
            fontVariant: ['tabular-nums'],
          }}
        >
          {m ? formatVndFull(m.walletBalance) : '—'}
        </FlowText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            marginTop: t.space['2'],
          }}
        >
          <FlowText variant="monoData" tone="tertiary" style={{ fontSize: 12, letterSpacing: 1 }}>
            VND
          </FlowText>
          <FlowText
            variant="bodyS"
            style={{ color: t.kind.income, fontWeight: '500' }}
          >
            {m && m.weekTotal != null
              ? locale === 'vi'
                ? `Tuần này chi ${formatVndShort(m.weekTotal)}`
                : `Spent ${formatVndShort(m.weekTotal)} this week`
              : ''}
          </FlowText>
        </View>
      </GlassSurface>

      {/* Thu / Chi metric row */}
      {m ? (
        <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'CHI HÔM NAY' : 'TODAY SPEND'}
            </FlowText>
            <FlowText
              variant="displayM"
              tone="primary"
              style={{
                marginTop: t.space['2'],
                fontSize: 32,
                lineHeight: 36,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatVndShort(m.todayTotal)}
            </FlowText>
            <FlowText
              variant="bodyS"
              style={{ color: t.kind.expense, marginTop: t.space['1'], fontWeight: '500' }}
            >
              {locale === 'vi' ? 'so với tuần' : 'vs week'}
            </FlowText>
          </GlassSurface>
          <GlassSurface pad="5" radius="xl" style={{ flex: 1 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'TUẦN NÀY' : 'THIS WEEK'}
            </FlowText>
            <FlowText
              variant="displayM"
              tone="primary"
              style={{
                marginTop: t.space['2'],
                fontSize: 32,
                lineHeight: 36,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatVndShort(m.weekTotal)}
            </FlowText>
            <FlowText
              variant="bodyS"
              style={{ color: t.kind.income, marginTop: t.space['1'], fontWeight: '500' }}
            >
              {locale === 'vi' ? '32% ngân sách' : '32% of budget'}
            </FlowText>
          </GlassSurface>
        </View>
      ) : null}

      {/* Recent transactions */}
      {expenses.data?.rows && expenses.data.rows.length > 0 ? (
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'GẦN ĐÂY' : 'RECENT'}
            </FlowText>
            <FlowText variant="titleL" tone="primary" style={{ fontSize: 22 }}>
              {locale === 'vi' ? 'Giao dịch hôm nay' : "Today's transactions"}
            </FlowText>
          </View>

          <GlassSurface pad="4" radius="xl" intensity={0.9}>
            {expenses.data.rows.slice(0, 8).map((e, i) => {
              const dotColor = [t.kind.expense, t.kind.income, t.kind.mood, t.kind.sleep][
                i % 4
              ];
              return (
                <View
                  key={e.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: dotColor,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <FlowText variant="bodyM" tone="primary" numberOfLines={1}>
                      {e.title}
                    </FlowText>
                    <FlowText variant="caption" tone="tertiary" style={{ fontSize: 11 }}>
                      {e.category} · {formatTimeShort(e.expenseDate)} ·{' '}
                      −{formatVndFull(e.amount)}đ
                    </FlowText>
                  </View>
                  <FlowText variant="caption" tone="tertiary">
                    ›
                  </FlowText>
                </View>
              );
            })}
          </GlassSurface>
        </View>
      ) : m && m.todayTotal === 0 ? (
        <GlassSurface pad="6" radius="2xl" intensity={1.0}>
          <FlowText variant="kicker" tone="accent">
            {locale === 'vi' ? 'BẮT ĐẦU' : 'GET STARTED'}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Ghi vài chi tiêu để xem bức tranh'
              : 'Log a few expenses to see the picture'}
          </FlowText>
          <FlowText variant="bodyM" tone="secondary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Cứ ghi như nhắn tin: "cà phê 35k". AI sẽ tự phân loại.'
              : 'Type like a message: "coffee 35k". AI auto-classifies.'}
          </FlowText>
        </GlassSurface>
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

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function formatVndFull(amount: number): string {
  return amount.toLocaleString('vi-VN').replace(/,/g, '.');
}

function formatVndShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return String(amount);
}

function formatMonthLabel(d: Date, locale: 'vi' | 'en'): string {
  if (locale === 'vi') return `THÁNG ${d.getMonth() + 1}`;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return months[d.getMonth()];
}

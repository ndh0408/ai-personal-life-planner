/**
 * Banner-row that surfaces lightweight, local nudges between the hero and
 * the dashboard cards on Home:
 *  - "No breakfast yet today" — fires after wake+2h with no meal logged.
 *  - "Spending higher than usual" — when today's spend > 1.7× this month's
 *    daily average.
 *
 * Pure derivation from data already cached by useFeed / useExpensesSummary
 * style queries — no extra requests. The user-visible text comes from i18n.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Icon, Text } from '../ui';
import { colors, radius, spacing } from '../../theme';
import { formatMoney } from '../../utils/format';

interface Props {
  /** "07:00" or null. */
  usualWakeTime: string | null;
  /** Number of meals logged today. */
  mealsToday: number;
  /** VND spent today. */
  todaySpendVnd: number;
  /** VND spent this month. */
  monthSpendVnd: number;
  /** 1..31 day of month for averaging. */
  dayOfMonth: number;
}

export function SmartNudges({
  usualWakeTime,
  mealsToday,
  todaySpendVnd,
  monthSpendVnd,
  dayOfMonth,
}: Props) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const banners: Array<{ id: string; tone: 'warning' | 'danger'; title: string; body: string }> =
    [];

  // No breakfast yet — only meaningful before 11am local.
  const localHour = new Date().getHours();
  const wakeAbsMin = parseHHMM(usualWakeTime, 6, 30);
  const elapsedH = wakeAbsMin != null ? localHour + new Date().getMinutes() / 60 - wakeAbsMin / 60 : null;
  if (mealsToday === 0 && elapsedH != null && elapsedH >= 2 && elapsedH < 6) {
    banners.push({
      id: 'no-breakfast',
      tone: 'warning',
      title: t('nudges.noBreakfastTitle'),
      body: t('nudges.noBreakfastBody', { hours: elapsedH.toFixed(0) }),
    });
  }

  // Spending higher than usual — vs this month's running daily average.
  if (dayOfMonth > 2 && monthSpendVnd > 0) {
    // Exclude today from the baseline so we don't compare today to itself.
    const baseline = (monthSpendVnd - todaySpendVnd) / Math.max(dayOfMonth - 1, 1);
    if (baseline > 0 && todaySpendVnd > baseline * 1.7 && todaySpendVnd > 100_000) {
      banners.push({
        id: 'high-spend',
        tone: 'danger',
        title: t('nudges.highSpendTitle'),
        body: t('nudges.highSpendBody', {
          spent: formatMoney(todaySpendVnd),
          pct: Math.round((todaySpendVnd / baseline - 1) * 100),
        }),
      });
    }
  }

  const visible = banners.filter((b) => !hidden.has(b.id));
  if (visible.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
      {visible.map((b) => (
        <Card
          key={b.id}
          style={{
            borderLeftWidth: 4,
            borderLeftColor: b.tone === 'danger' ? colors.expense.base : colors.accent.base,
            paddingLeft: spacing.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon
              name={b.tone === 'danger' ? 'arrow-up-circle' : 'time-outline'}
              size={20}
              color={b.tone === 'danger' ? colors.expense.base : colors.accent.base}
            />
            <Text variant="bodyEm" style={{ flex: 1 }}>
              {b.title}
            </Text>
            <Pressable
              onPress={() => setHidden((s) => new Set([...s, b.id]))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('nudges.dismiss')}
            >
              <Text variant="caption" style={{ color: colors.text.muted, fontWeight: '700' }}>
                ✕
              </Text>
            </Pressable>
          </View>
          <Text variant="caption" style={{ marginTop: 4 }}>
            {b.body}
          </Text>
        </Card>
      ))}
    </View>
  );
}

function parseHHMM(s: string | null, fbH: number, fbM: number): number | null {
  if (!s) return fbH * 60 + fbM;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return fbH * 60 + fbM;
  return Math.min(23, Math.max(0, Number(m[1]))) * 60 + Math.min(59, Math.max(0, Number(m[2])));
}


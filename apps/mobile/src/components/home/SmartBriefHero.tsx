/**
 * Home command-center hero (round 32).
 *
 * Replaces the old "two-state HomeHero" card with a single banner that
 * surfaces the SmartBrief from the dashboard. The headline is the loudest
 * thing on the screen; the body adds one line of context; reasonLabels
 * form a short chip strip so the user can see *why* this brief surfaced
 * (not feel surprised by an opaque suggestion).
 *
 * Tone palette comes from `tokens.tone.*` so the redesign stays
 * deterministic — gentle is olive, urgent is clay, celebratory is
 * sienna, neutral is panel.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Icon, Text } from '../ui';
import { spacing, tokens, radius, typography } from '../../theme';
import type { SmartBrief, SmartBriefAction } from '../../services/api/dashboard.service';

interface Props {
  brief: SmartBrief | null;
  greetingName: string;
  onAction?: (action: SmartBriefAction) => void;
}

const TONE_TO_TOKEN = {
  neutral: tokens.tone.neutral,
  gentle: tokens.tone.success,
  urgent: tokens.tone.danger,
  celebratory: tokens.tone.ai,
} as const;

export function SmartBriefHero({ brief, greetingName, onAction }: Props) {
  const { t } = useTranslation();

  // No brief — render a calm greeting card so the screen has a hero
  // anchor. This is the "everything is fine" state, not a placeholder.
  if (!brief) {
    return (
      <Card style={[styles.card, { borderLeftColor: tokens.tone.neutral.fg }]}>
        <Text variant="kicker" style={styles.kicker}>
          {t('home.smartBrief.label', { defaultValue: 'Brief hôm nay' })}
        </Text>
        <Text variant="display" numberOfLines={2} style={styles.headline}>
          {t('home.smartBrief.noBrief', { defaultValue: 'Hôm nay yên — không có gì cần báo gấp.' })}
        </Text>
        {greetingName ? (
          <Text variant="caption" style={styles.body}>
            {t('home.greeting', { name: greetingName })}
          </Text>
        ) : null}
      </Card>
    );
  }

  const tone = TONE_TO_TOKEN[brief.tone];
  const sourceLabel =
    brief.source === 'AI'
      ? t('home.smartBrief.sourceAi', { defaultValue: 'AI' })
      : t('home.smartBrief.sourceRule', { defaultValue: 'Quy tắc' });

  return (
    <Card style={[styles.card, { borderLeftColor: tone.fg }]}>
      <View style={styles.header}>
        <Text variant="kicker" style={[styles.kicker, { color: tone.fg }]}>
          {t('home.smartBrief.label', { defaultValue: 'Brief hôm nay' })}
        </Text>
        <Text variant="caption" style={styles.source}>
          {t('home.smartBrief.from', { defaultValue: 'Từ {{source}}', source: sourceLabel })}
        </Text>
      </View>

      <Text variant="display" numberOfLines={2} style={styles.headline}>
        {brief.headline}
      </Text>

      {brief.body ? (
        <Text variant="caption" numberOfLines={3} style={styles.body}>
          {brief.body}
        </Text>
      ) : null}

      {brief.reasonLabels.length > 0 ? (
        <View style={styles.reasonRow}>
          {brief.reasonLabels.map((r) => (
            <View key={r} style={[styles.reasonChip, { backgroundColor: tone.bg }]}>
              <Text variant="caption" style={{ color: tone.fg, fontWeight: '700' }}>
                {r}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {brief.primaryAction && onAction ? (
        <Pressable
          onPress={() => brief.primaryAction && onAction(brief.primaryAction)}
          accessibilityRole="button"
          accessibilityLabel={brief.primaryAction.label}
          hitSlop={8}
          style={styles.cta}
        >
          <Text variant="bodyEm" style={{ color: tone.fg }}>
            {brief.primaryAction.label}
          </Text>
          <Icon name="arrow-forward-outline" size={16} color={tone.fg} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    paddingLeft: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: { textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  source: { opacity: 0.75 },
  headline: { lineHeight: 30, marginTop: 2 },
  body: { ...typography.caption, opacity: 0.85, lineHeight: 19 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    minHeight: tokens.hitSize,
    alignSelf: 'flex-start',
  },
});

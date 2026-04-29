/**
 * Compact card surfacing privacy-limited domains (round 32).
 *
 * When the user has hidden one or more domains from AI (finance, health,
 * meals, tasks), the redesigned Home shows this banner so suggestions
 * elsewhere on the screen don't feel arbitrarily incomplete. CTA jumps
 * to the privacy screen if the user wants to revisit.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Icon, Text } from '../ui';
import { spacing, tokens, typography } from '../../theme';
import type { PrivacyLimitedDomain } from '../../services/api/dashboard.service';

interface Props {
  domains: PrivacyLimitedDomain[];
  onOpenPrivacy: () => void;
}

export function PrivacyLimitedCard({ domains, onOpenPrivacy }: Props) {
  const { t } = useTranslation();
  if (!domains || domains.length === 0) return null;

  const labels = domains.map((d) =>
    t(`privacy.limited.${d}`, { defaultValue: d }),
  );

  return (
    <Card style={[styles.card, { borderColor: tokens.tone.info.fg }]}>
      <View style={styles.header}>
        <Icon name="lock-closed-outline" size={16} color={tokens.tone.info.fg} />
        <Text variant="bodyEm" style={{ color: tokens.tone.info.fg }}>
          {t('home.privacyLimited.title', { defaultValue: 'AI đang bị giới hạn' })}
        </Text>
      </View>
      <Text style={styles.body}>
        {t('home.privacyLimited.body', {
          defaultValue: 'Bạn đã ẩn: {{domains}}.',
          domains: labels.join(', '),
        })}
      </Text>
      <Pressable
        onPress={onOpenPrivacy}
        accessibilityRole="button"
        accessibilityLabel={t('home.privacyLimited.cta', { defaultValue: 'Mở quyền riêng tư' })}
        hitSlop={8}
        style={styles.cta}
      >
        <Text variant="caption" style={{ color: tokens.tone.info.fg, fontWeight: '700' }}>
          {t('home.privacyLimited.cta', { defaultValue: 'Mở quyền riêng tư' })}
        </Text>
        <Icon name="chevron-forward" size={14} color={tokens.tone.info.fg} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { ...typography.caption, color: tokens.text.secondary, lineHeight: 18 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: tokens.hitSize,
    alignSelf: 'flex-start',
  },
});

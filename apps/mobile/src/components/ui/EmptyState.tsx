import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

interface Props {
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ title, body, ctaLabel, onCta }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onCta ? (
        <View style={styles.cta}>
          <Button label={ctaLabel} onPress={onCta} variant="secondary" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing['2xl'], alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.heading, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
  cta: { marginTop: spacing.md },
});

import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useTranslation } from 'react-i18next';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Renders an eye toggle that flips secureTextEntry. */
  secret?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, secret = false, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const isSecret = secret && !revealed;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={isSecret}
          placeholderTextColor={colors.text.muted}
          autoCapitalize={rest.autoCapitalize ?? 'none'}
          autoCorrect={rest.autoCorrect ?? false}
          style={styles.input}
        />
        {secret ? (
          <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={12} style={styles.toggle}>
            <Text style={styles.toggleLabel}>
              {revealed ? t('common.hidePassword') : t('common.showPassword')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: {
    color: colors.text.muted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  fieldError: { borderColor: colors.status.danger },
  input: {
    flex: 1,
    color: colors.text.primary,
    paddingVertical: 14,
    ...typography.body,
  },
  toggle: { paddingLeft: spacing.md, paddingVertical: 4 },
  toggleLabel: { color: colors.accent.base, ...typography.caption, fontWeight: '600' },
  errorText: { color: colors.status.danger, marginTop: 6, ...typography.caption },
  hint: { color: colors.text.muted, marginTop: 6, ...typography.caption },
});

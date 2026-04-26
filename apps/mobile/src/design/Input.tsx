import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { palette, radius, space, typography } from './theme';
import { useI18n } from '../i18n';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  /** Render an eye toggle that flips secureTextEntry. */
  secret?: boolean;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, secret = false, ...rest },
  ref,
) {
  const { t } = useI18n();
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
          placeholderTextColor={palette.textMuted}
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
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: {
    color: palette.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  fieldError: { borderColor: palette.danger },
  input: {
    flex: 1,
    color: palette.textPrimary,
    paddingVertical: 14,
    ...typography.body,
  },
  toggle: { paddingLeft: space.md, paddingVertical: 4 },
  toggleLabel: { color: palette.accent, ...typography.caption, fontWeight: '600' },
  errorText: { color: palette.danger, marginTop: 6, ...typography.caption },
});

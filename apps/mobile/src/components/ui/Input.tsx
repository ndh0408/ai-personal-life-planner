import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
};

export function Input({ label, error, helper, style, onFocus, onBlur, ...rest }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: '100%' }}>
      {label ? (
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            marginBottom: spacing.xs + 2,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            color: colors.text,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            fontSize: 15,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={{ ...typography.small, color: colors.danger, marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={{ ...typography.small, color: colors.textMuted, marginTop: spacing.xs }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const _styles = StyleSheet.create({});

import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { getActiveLocale, setLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n';

type Option = { code: SupportedLocale; labelKey: string };

const OPTIONS: Option[] = [
  { code: 'vi', labelKey: 'settings.language.vi' },
  { code: 'en', labelKey: 'settings.language.en' },
];

export function LanguageSettingsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const [active, setActive] = useState<SupportedLocale>(getActiveLocale());
  const [busy, setBusy] = useState(false);

  async function onSelect(code: SupportedLocale) {
    if (busy || code === active) return;
    setBusy(true);
    try {
      await setLocale(code);
      setActive(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={[typography.h1, { color: colors.text }]}>
          {t('settings.language.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted }]}>
          {t('settings.language.description')}
        </Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {OPTIONS.map((opt) => {
            const selected = opt.code === active;
            return (
              <TouchableOpacity
                key={opt.code}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                disabled={busy}
                onPress={() => onSelect(opt.code)}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={[typography.bodyStrong, { color: colors.text }]}>
                  {t(opt.labelKey)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {opt.code.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

export { SUPPORTED_LOCALES };

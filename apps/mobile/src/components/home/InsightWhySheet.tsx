/**
 * "Why this suggestion?" rationale sheet (round 37).
 *
 * Tapping the (i) affordance on a recommendation opens this sheet.
 * Renders the explainText one-liner + a bullet list of evidence items,
 * each with the data-source badge (Manual / Device / Inferred /
 * Computed). No business logic — pure presentation.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Text } from '../ui';
import { spacing, tokens, radius, typography } from '../../theme';

interface EvidenceItem {
  label: string;
  value: string;
  source?: 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  explainText?: string | null;
  evidence?: EvidenceItem[];
}

const SOURCE_LABEL: Record<NonNullable<EvidenceItem['source']>, string> = {
  MANUAL: 'Bạn nhập',
  DEVICE: 'Thiết bị',
  INFERRED: 'Phỏng đoán',
  COMPUTED: 'Tính toán',
};

const SOURCE_TONE: Record<NonNullable<EvidenceItem['source']>, 'neutral' | 'success' | 'info' | 'warning'> = {
  MANUAL: 'neutral',
  DEVICE: 'success',
  INFERRED: 'warning',
  COMPUTED: 'info',
};

export function InsightWhySheet({ visible, onClose, title, explainText, evidence }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.55}>
      <View style={{ gap: spacing.md }}>
        <Text variant="kicker" style={styles.kicker}>
          {t('insights.why.kicker', { defaultValue: 'Vì sao có gợi ý này?' })}
        </Text>
        <Text variant="title">{title}</Text>
        {explainText ? (
          <Text variant="caption" style={styles.body}>
            {explainText}
          </Text>
        ) : null}

        {evidence && evidence.length > 0 ? (
          <View style={styles.evidenceList}>
            {evidence.map((row, i) => {
              const source = row.source ?? 'COMPUTED';
              const tone = tokens.tone[SOURCE_TONE[source]];
              return (
                <View key={`${row.label}-${i}`} style={styles.evidenceRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" style={styles.evidenceLabel}>
                      {row.label}
                    </Text>
                    <Text variant="bodyEm">{row.value}</Text>
                  </View>
                  <View style={[styles.sourceBadge, { backgroundColor: tone.bg }]}>
                    <Text variant="caption" style={{ color: tone.fg, fontWeight: '700' }}>
                      {SOURCE_LABEL[source]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text variant="caption" style={{ color: tokens.text.muted }}>
            {t('insights.why.noEvidence', {
              defaultValue: 'Gợi ý này dựa trên ngữ cảnh chung — chưa có số liệu cụ thể.',
            })}
          </Text>
        )}

        <Button label={t('common.ok')} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  kicker: { textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  body: { ...typography.caption, color: tokens.text.secondary, lineHeight: 19 },
  evidenceList: { gap: spacing.sm },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: tokens.bg.panel,
    borderRadius: radius.md,
  },
  evidenceLabel: { textTransform: 'uppercase', letterSpacing: 1, opacity: 0.75 },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});

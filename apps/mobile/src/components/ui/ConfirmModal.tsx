import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button label={cancelLabel} variant="ghost" onPress={onCancel} />
              </View>
              <View style={styles.flex}>
                <Button
                  label={confirmLabel}
                  variant={destructive ? 'danger' : 'primary'}
                  onPress={onConfirm}
                />
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.xl },
  cardWrap: {},
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  title: { ...typography.heading, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
});

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CaptureKind } from '@lifeos/taxonomy';
import { useAurora } from './AuroraProvider';
import { FlowText } from './FlowText';
import { haptic } from '../platform/haptics';

interface CaptureSubmission {
  text: string;
  kind: CaptureKind;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (s: CaptureSubmission) => void | Promise<void>;
  initialText?: string;
  /** Suggested kind from on-device classifier (debounced upstream). */
  suggestedKind?: CaptureKind | null;
  locale?: 'vi' | 'en';
  submitting?: boolean;
}

interface ChipDef {
  kind: CaptureKind;
  vi: string;
  en: string;
  icon: string;
}

const CHIPS: ChipDef[] = [
  { kind: 'UNKNOWN', vi: 'Tự nhận', en: 'Auto', icon: 'sparkles' },
  { kind: 'EXPENSE', vi: 'Tiền', en: 'Money', icon: 'wallet-outline' },
  { kind: 'TASK', vi: 'Việc', en: 'Task', icon: 'checkmark-circle-outline' },
  { kind: 'SLEEP', vi: 'Sức khỏe', en: 'Health', icon: 'pulse-outline' },
  { kind: 'NOTE', vi: 'Suy nghĩ', en: 'Note', icon: 'create-outline' },
];

/**
 * Aurora CaptureSheet — Pencil R45 layout.
 *
 * Bottom sheet with grabber + serif "Ghi nhanh" + glass-tinted input
 * (kicker eyebrow + multiline TextInput in italic serif placeholder) +
 * 5 category chips (active = champagne pearl) + voice icon button +
 * full-width save button.
 *
 * The category chip you tap becomes the kind sent to /capture/confirm.
 * "Tự nhận" leaves the on-device classifier suggestion in place.
 */
export function CaptureSheet({
  visible,
  onClose,
  onSubmit,
  initialText = '',
  suggestedKind = null,
  locale = 'vi',
  submitting = false,
}: Props) {
  const t = useAurora();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState(initialText);
  const [kind, setKind] = useState<CaptureKind>(suggestedKind ?? 'UNKNOWN');
  const overriddenRef = useRef(false);

  const sheetY = useSharedValue(40);
  const scrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sheetY.value = withSpring(0, t.motion.spring.soft);
      scrimOpacity.value = withTiming(1, { duration: t.motion.duration.standard });
      const id = setTimeout(() => inputRef.current?.focus(), t.motion.duration.standard);
      return () => clearTimeout(id);
    }
    sheetY.value = withTiming(40, { duration: t.motion.duration.micro });
    scrimOpacity.value = withTiming(0, { duration: t.motion.duration.micro });
    return undefined;
  }, [visible, sheetY, scrimOpacity, t.motion]);

  // Sync classifier suggestion if user hasn't picked one yet.
  useEffect(() => {
    if (!overriddenRef.current && suggestedKind && suggestedKind !== kind) {
      setKind(suggestedKind);
    }
  }, [suggestedKind, kind]);

  // Reset overrides when the sheet reopens.
  useEffect(() => {
    if (visible) {
      setText(initialText);
      overriddenRef.current = false;
    }
  }, [visible, initialText]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value * 8 }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const canSubmit = text.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    haptic('confirm');
    await onSubmit({ text: text.trim(), kind });
    setText('');
    overriddenRef.current = false;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(14,11,31,0.70)',
            },
            scrimStyle,
          ]}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={onClose}
            accessibilityLabel={locale === 'vi' ? 'Đóng' : 'Close'}
          />
        </Animated.View>

        <Animated.View style={sheetStyle}>
          <View
            style={{
              backgroundColor: t.palette.canvasB,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              paddingTop: 16,
              paddingHorizontal: 24,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
              gap: 24,
            }}
          >
            {/* Grabber */}
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                }}
              />
            </View>

            {/* Title */}
            <FlowText
              variant="displayM"
              tone="primary"
              style={{ fontSize: 28, lineHeight: 32 }}
            >
              {locale === 'vi' ? 'Ghi nhanh' : 'Quick capture'}
            </FlowText>

            {/* Glass input */}
            <View
              style={{
                padding: 20,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.20)',
                gap: 8,
                minHeight: 140,
              }}
            >
              <FlowText
                variant="kicker"
                tone="tertiary"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                {locale === 'vi' ? 'BẠN ĐANG LÀM GÌ?' : 'WHAT ARE YOU DOING?'}
              </FlowText>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  // Don't reset overriddenRef on text change; user already picked kind
                }}
                placeholder={
                  locale === 'vi'
                    ? 'Mua cà phê hết 45.000đ tại Highlands…'
                    : "Bought coffee 45k at Highlands…"
                }
                placeholderTextColor={t.palette.inkTertiary}
                multiline
                style={{
                  color: t.palette.inkPrimary,
                  fontFamily: t.fontFamily.display.android,
                  fontSize: 18,
                  lineHeight: 25,
                  fontStyle: 'italic',
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
                accessibilityLabel={locale === 'vi' ? 'Nội dung ghi' : 'Capture text'}
              />
            </View>

            {/* Category chips */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {CHIPS.map((c) => {
                const active = c.kind === kind;
                return (
                  <Pressable
                    key={c.kind}
                    onPress={() => {
                      haptic('selection');
                      overriddenRef.current = true;
                      setKind(c.kind);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      backgroundColor: active
                        ? t.palette.accent
                        : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: active ? t.palette.accent : 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <Ionicons
                      name={c.icon}
                      size={12}
                      color={active ? t.palette.canvasA : t.palette.inkSecondary}
                    />
                    <FlowText
                      variant="bodyS"
                      style={{
                        fontSize: 12,
                        fontWeight: active ? '600' : '500',
                        color: active ? t.palette.canvasA : t.palette.inkSecondary,
                      }}
                    >
                      {locale === 'vi' ? c.vi : c.en}
                    </FlowText>
                  </Pressable>
                );
              })}
            </View>

            {/* Action row: voice + save */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => haptic('soft')}
                accessibilityLabel={locale === 'vi' ? 'Thu âm' : 'Voice input'}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="mic-outline" size={18} color={t.palette.inkPrimary} />
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: canSubmit
                    ? t.palette.accent
                    : 'rgba(255,255,255,0.10)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {submitting ? (
                  <FlowText
                    variant="bodyM"
                    style={{
                      color: canSubmit ? t.palette.canvasA : t.palette.inkTertiary,
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    {locale === 'vi' ? 'Đang lưu…' : 'Saving…'}
                  </FlowText>
                ) : (
                  <>
                    <Ionicons
                      name="sparkles"
                      size={18}
                      color={canSubmit ? t.palette.canvasA : t.palette.inkTertiary}
                    />
                    <FlowText
                      variant="bodyM"
                      style={{
                        color: canSubmit ? t.palette.canvasA : t.palette.inkTertiary,
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                    >
                      {locale === 'vi' ? 'Lưu ghi chép' : 'Save capture'}
                    </FlowText>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

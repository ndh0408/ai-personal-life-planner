import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CAPTURE_KIND_META, type CaptureKind } from '@lifeos/taxonomy';
import { useTheme } from '../../theme/v2';
import { useMotion } from '../../theme/v2/motion';
import { elevationStyle } from '../../theme/v2/elevation';
import { Surface } from './Surface';
import { Text } from './Text';
import { Button } from './Button';
import { KindChipRow } from './KindChipRow';
import { haptic } from '../../platform/haptics';

interface CaptureSubmission {
  text: string;
  kind: CaptureKind;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (s: CaptureSubmission) => void | Promise<void>;
  /** Initial text — useful for share-extension entry, voice transcript. */
  initialText?: string;
  /** Suggested kind from on-device classifier (debounced upstream). */
  suggestedKind?: CaptureKind | null;
  locale?: 'vi' | 'en';
  /** "Send" button label override; defaults to type-aware text. */
  submitLabel?: string;
  submitting?: boolean;
}

/**
 * CaptureSheetV2 — the centerpiece of LifeOS. One free-form input, one
 * inferred kind row, one type-aware submit. No tabs, no required fields,
 * no "are you sure?" — capture is sacred and must always succeed.
 *
 * Keyboard handling: Modal + KeyboardAvoidingView is finicky on Android;
 * we let the OS handle the slide and pin the sheet to the bottom with
 * insets. The sheet's max height is 70% on small phones so even with
 * keyboard up, the user sees their text and the submit button.
 */
export function CaptureSheetV2({
  visible,
  onClose,
  onSubmit,
  initialText = '',
  suggestedKind = null,
  locale = 'vi',
  submitLabel,
  submitting = false,
}: Props) {
  const t = useTheme();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState(initialText);
  const [kind, setKind] = useState<CaptureKind>(suggestedKind ?? 'UNKNOWN');

  const sheetY = useSharedValue(40);
  const scrimOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sheetY.value = withSpring(0, motion.spring.soft);
      scrimOpacity.value = withTiming(1, { duration: motion.duration.standard });
      // Focus the input after the sheet has settled. Trying to focus during
      // the slide-in fights with native modal animation on Android.
      const id = setTimeout(() => inputRef.current?.focus(), motion.duration.standard);
      return () => clearTimeout(id);
    } else {
      sheetY.value = withTiming(40, { duration: motion.duration.micro });
      scrimOpacity.value = withTiming(0, { duration: motion.duration.micro });
    }
  }, [visible, sheetY, scrimOpacity, motion]);

  // Keep local kind state in sync as the on-device classifier emits new
  // suggestions, but only if the user hasn't already overridden it.
  const overriddenRef = useRef(false);
  useEffect(() => {
    if (!overriddenRef.current && suggestedKind && suggestedKind !== kind) {
      setKind(suggestedKind);
    }
  }, [suggestedKind, kind]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value * 8 }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const canSubmit = text.trim().length > 0 && !submitting;
  const buttonLabel =
    submitLabel ??
    (() => {
      if (kind === 'UNKNOWN') return locale === 'vi' ? 'Lưu' : 'Save';
      const meta = CAPTURE_KIND_META[kind];
      const verb = locale === 'vi' ? 'Thêm' : 'Add';
      return `${verb} ${(locale === 'vi' ? meta.labelVi : meta.labelEn).toLowerCase()}`;
    })();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    haptic('success');
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
          style={[
            { ...StyleSheetAbsoluteFill, backgroundColor: t.color.scrim.medium },
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
          <Surface
            level="elevated"
            radius="2xl"
            bordered
            style={[
              {
                paddingTop: t.space['4'],
                paddingBottom: Math.max(insets.bottom, t.space['4']),
                marginHorizontal: t.space['2'],
                marginBottom: t.space['2'],
                ...elevationStyle('floating'),
              },
            ]}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: t.color.border.strong,
                alignSelf: 'center',
                marginBottom: t.space['3'],
              }}
              accessible={false}
            />

            <View style={{ paddingHorizontal: t.space['5'] }}>
              <Text variant="kicker" tone="tertiary">
                {locale === 'vi' ? 'GHI NHANH' : 'CAPTURE'}
              </Text>

              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={
                  locale === 'vi' ? 'Bạn muốn ghi gì?' : "What's on your mind?"
                }
                placeholderTextColor={t.color.text.tertiary}
                multiline
                style={{
                  marginTop: t.space['2'],
                  minHeight: 96,
                  maxHeight: 200,
                  color: t.color.text.primary,
                  fontSize: 17,
                  lineHeight: 24,
                }}
                accessibilityLabel={locale === 'vi' ? 'Nội dung ghi' : 'Capture text'}
              />
            </View>

            <View style={{ marginTop: t.space['3'] }}>
              <KindChipRow
                selected={kind}
                onSelect={(k) => {
                  overriddenRef.current = true;
                  setKind(k);
                }}
                suggestedKind={suggestedKind}
                locale={locale}
              />
            </View>

            <View
              style={{
                paddingHorizontal: t.space['5'],
                marginTop: t.space['4'],
              }}
            >
              <Button
                label={buttonLabel}
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={submitting}
                testID="capture-sheet-submit"
              />
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 0..1 fraction of screen height; default 0.6 */
  heightRatio?: number;
}

export function BottomSheet({ visible, onClose, children, heightRatio = 0.6 }: Props) {
  // Window dimensions are reactive — survives orientation/foldable/keyboard
  // resize. The previous module-level Dimensions.get crashed the layout when
  // the keyboard pushed content up.
  const { height: screenH, width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(screenH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenH,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity, screenH]);

  // Cap sheet width on tablets — full-bleed bottom sheets at 1024dp look wrong.
  const maxSheetWidth = Math.min(screenW, 560);
  const sheetHeight = Math.min(screenH * heightRatio, screenH - insets.top - 24);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              width: maxSheetWidth,
              alignSelf: 'center',
              height: sheetHeight,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  content: { flex: 1 },
});

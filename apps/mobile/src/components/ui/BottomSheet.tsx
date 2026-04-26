import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 0..1 fraction of screen height; default 0.6 */
  heightRatio?: number;
}

const SCREEN_H = Dimensions.get('window').height;

export function BottomSheet({ visible, onClose, children, heightRatio = 0.6 }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
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
          toValue: SCREEN_H,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { height: SCREEN_H * heightRatio, transform: [{ translateY }] },
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
    paddingBottom: spacing['2xl'],
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

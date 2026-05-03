import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAurora } from './AuroraProvider';
import { GlassSurface } from './GlassSurface';
import { FlowText } from './FlowText';
import { GradientButton } from './GradientButton';
import { useAuthStore } from '../store/auth.store';
import { useAiKeyStatus } from '../hooks/useAiKeyStatus';
import type { RootStackParamList } from '../navigation/types';
import { i18n as i18nInstance } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Aurora's "settings" entry — a bottom sheet reachable from the gear icon
 * in the Today header. Surfaces the four affordances Aurora's 5-tab shell
 * was missing: AI key, privacy controls, language, sign-out, plus a link
 * to the legacy Settings screen for the long tail (preferences, memory,
 * meal log, etc).
 */
export function SettingsSheet({ visible, onClose }: Props) {
  const t = useAurora();
  const insets = useSafeAreaInsets();
  const { t: tr, i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const signOut = useAuthStore((s) => s.signOut);
  const userEmail = useAuthStore((s) => s.user?.email ?? null);
  const userName = useAuthStore((s) => s.user?.displayName ?? null);
  const aiKey = useAiKeyStatus();

  const sheetY = useSharedValue(40);
  const scrimOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      sheetY.value = withSpring(0, t.motion.spring.soft);
      scrimOpacity.value = withTiming(1, { duration: t.motion.duration.standard });
    } else {
      sheetY.value = withTiming(40, { duration: t.motion.duration.micro });
      scrimOpacity.value = withTiming(0, { duration: t.motion.duration.micro });
    }
  }, [visible, sheetY, scrimOpacity, t]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value * 8 }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const switchLanguage = (next: 'vi' | 'en') => {
    void i18nInstance.changeLanguage(next);
  };

  const goAndClose = (route: keyof RootStackParamList) => {
    onClose();
    setTimeout(() => navigation.navigate(route as never), t.motion.duration.micro);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.48)' },
            scrimStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <Animated.View style={[sheetStyle]}>
          <GlassSurface
            pad="6"
            radius="2xl"
            intensity={1.6}
            style={{
              marginHorizontal: t.space['2'],
              marginBottom: t.space['2'],
              paddingBottom: Math.max(insets.bottom, t.space['4']) + t.space['4'],
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignSelf: 'center',
                marginBottom: t.space['4'],
              }}
            />

            {/* Identity */}
            <View style={{ marginBottom: t.space['5'] }}>
              <FlowText variant="kicker" tone="secondary">
                {locale === 'vi' ? 'TÀI KHOẢN' : 'ACCOUNT'}
              </FlowText>
              <FlowText variant="titleL" tone="primary" style={{ marginTop: t.space['2'] }}>
                {userName ?? userEmail ?? '—'}
              </FlowText>
              {userEmail && userName ? (
                <FlowText variant="caption" tone="tertiary">
                  {userEmail}
                </FlowText>
              ) : null}
            </View>

            {/* Rows */}
            <View style={{ gap: t.space['2'] }}>
              <Row
                label={locale === 'vi' ? 'OpenAI key' : 'OpenAI key'}
                value={
                  aiKey.data?.enabled
                    ? aiKey.data.maskedApiKey ?? '✓'
                    : locale === 'vi'
                    ? 'Chưa nhập'
                    : 'Not set'
                }
                accent={!aiKey.data?.enabled}
                onPress={() => goAndClose('AISettings')}
              />
              <Row
                label={locale === 'vi' ? 'Quyền riêng tư' : 'Privacy'}
                value={locale === 'vi' ? 'Mở' : 'Open'}
                onPress={() => goAndClose('Privacy')}
              />
              <Row
                label={locale === 'vi' ? 'Ký ức AI' : 'AI memory'}
                value={locale === 'vi' ? 'Mở' : 'Open'}
                onPress={() => goAndClose('Memory')}
              />
              <Row
                label={locale === 'vi' ? 'Tuỳ chọn' : 'Preferences'}
                value={locale === 'vi' ? 'Mở' : 'Open'}
                onPress={() => goAndClose('Preferences')}
              />
            </View>

            {/* Language */}
            <View style={{ marginTop: t.space['5'] }}>
              <FlowText variant="kicker" tone="secondary">
                {locale === 'vi' ? 'NGÔN NGỮ' : 'LANGUAGE'}
              </FlowText>
              <View style={{ flexDirection: 'row', gap: t.space['2'], marginTop: t.space['3'] }}>
                <LangChip
                  label="Tiếng Việt"
                  active={locale === 'vi'}
                  onPress={() => switchLanguage('vi')}
                />
                <LangChip
                  label="English"
                  active={locale === 'en'}
                  onPress={() => switchLanguage('en')}
                />
              </View>
            </View>

            {/* Sign out */}
            <View style={{ marginTop: t.space['7'] }}>
              <GradientButton
                label={locale === 'vi' ? 'Đăng xuất' : 'Sign out'}
                variant="ghost"
                onPress={handleSignOut}
              />
            </View>
          </GlassSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  onPress,
  accent,
}: {
  label: string;
  value: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const t = useAurora();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: t.space['3'],
          gap: t.space['3'],
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <FlowText variant="bodyM" tone="primary" style={{ flex: 1 }}>
          {label}
        </FlowText>
        <FlowText variant="bodyM" tone={accent ? 'accent' : 'tertiary'}>
          {value}
        </FlowText>
        <FlowText variant="bodyM" tone="tertiary">
          ›
        </FlowText>
      </View>
    </Pressable>
  );
}

function LangChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useAurora();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          paddingHorizontal: t.space['4'],
          paddingVertical: t.space['2'],
          borderRadius: t.radius.pill,
          borderWidth: 1,
          borderColor: active ? t.palette.accent : 'rgba(255,255,255,0.12)',
          backgroundColor: active ? t.palette.glassTint : 'transparent',
        }}
      >
        <FlowText variant="caption" tone={active ? 'accent' : 'secondary'}>
          {label}
        </FlowText>
      </View>
    </Pressable>
  );
}

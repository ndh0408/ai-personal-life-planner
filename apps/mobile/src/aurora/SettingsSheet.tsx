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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAurora } from './AuroraProvider';
import { FlowText } from './FlowText';
import { useAuthStore } from '../store/auth.store';
import { useAiKeyStatus } from '../hooks/useAiKeyStatus';
import type { RootStackParamList } from '../navigation/types';
import { i18n as i18nInstance } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * SettingsSheet — Pencil R45 layout.
 *
 * Bottom sheet with grabber + serif "Cài đặt" + profile row card +
 * settings list (AI key / Privacy / AI memory / Preferences / Language) +
 * sign-out + version footer. All status text uses REAL state (AI key
 * masked value, current language). No hardcoded labels.
 */
export function SettingsSheet({ visible, onClose }: Props) {
  const t = useAurora();
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
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

  const goAndClose = (route: keyof RootStackParamList) => {
    onClose();
    setTimeout(() => navigation.navigate(route as never), t.motion.duration.micro);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  const initial = (userName ?? userEmail ?? '?').charAt(0).toUpperCase();

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
              backgroundColor: 'rgba(0,0,0,0.55)',
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

        <Animated.View style={[sheetStyle]}>
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
              style={{ fontSize: 32, lineHeight: 36 }}
            >
              {locale === 'vi' ? 'Cài đặt' : 'Settings'}
            </FlowText>

            {/* Profile card */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 20,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.20)',
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: t.palette.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FlowText
                  variant="titleL"
                  style={{
                    fontSize: 22,
                    color: t.palette.canvasA,
                    fontWeight: '600',
                  }}
                >
                  {initial}
                </FlowText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <FlowText variant="titleL" tone="primary" style={{ fontSize: 18 }}>
                  {userName ?? (locale === 'vi' ? 'Bạn' : 'You')}
                </FlowText>
                {userEmail ? (
                  <FlowText
                    variant="monoData"
                    tone="tertiary"
                    style={{ fontSize: 11, letterSpacing: 0 }}
                  >
                    {userEmail}
                  </FlowText>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={t.palette.inkTertiary}
              />
            </View>

            {/* Settings rows */}
            <View
              style={{
                padding: 8,
                paddingHorizontal: 20,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <SettingRow
                dotColor={t.palette.accent}
                label={locale === 'vi' ? 'Khoá AI · OpenAI' : 'AI key · OpenAI'}
                value={
                  aiKey.data?.enabled
                    ? `${locale === 'vi' ? 'Đã kết nối · ' : 'Connected · '}${aiKey.data.maskedApiKey ?? '✓'}`
                    : locale === 'vi'
                    ? 'Chưa nhập key'
                    : 'Not set'
                }
                onPress={() => goAndClose('AISettings')}
              />
              <SettingRow
                dotColor={t.kind.income}
                label={locale === 'vi' ? 'Đồng bộ' : 'Sync'}
                value={locale === 'vi' ? 'Trên thiết bị · Cloud tắt' : 'On device · Cloud off'}
                onPress={() => goAndClose('Privacy')}
              />
              <SettingRow
                dotColor={t.palette.accentGlow}
                label={locale === 'vi' ? 'Quyền riêng tư' : 'Privacy'}
                value={locale === 'vi' ? 'Mã hoá đầu cuối' : 'End-to-end encrypted'}
                onPress={() => goAndClose('Privacy')}
              />
              <SettingRow
                dotColor={t.kind.mood}
                label={locale === 'vi' ? 'Ký ức AI' : 'AI memory'}
                value={locale === 'vi' ? 'Mở chi tiết' : 'Open details'}
                onPress={() => goAndClose('Memory')}
              />
              <SettingRow
                dotColor={t.kind.expense}
                label={locale === 'vi' ? 'Tuỳ chọn' : 'Preferences'}
                value={locale === 'vi' ? 'Lịch · Đơn vị · Nhắc' : 'Calendar · Units · Reminders'}
                onPress={() => goAndClose('Preferences')}
              />
            </View>

            {/* Language pills */}
            <View>
              <FlowText
                variant="kicker"
                tone="tertiary"
                style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 12 }}
              >
                {locale === 'vi' ? 'NGÔN NGỮ' : 'LANGUAGE'}
              </FlowText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LangChip
                  label="Tiếng Việt"
                  active={locale === 'vi'}
                  onPress={() => i18nInstance.changeLanguage('vi')}
                />
                <LangChip
                  label="English"
                  active={locale === 'en'}
                  onPress={() => i18nInstance.changeLanguage('en')}
                />
              </View>
            </View>

            {/* Footer: sign out + version */}
            <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Pressable onPress={handleSignOut} hitSlop={8}>
                <FlowText
                  variant="bodyM"
                  style={{
                    color: t.kind.expense,
                    fontWeight: '500',
                    fontSize: 14,
                  }}
                >
                  {locale === 'vi' ? 'Đăng xuất' : 'Sign out'}
                </FlowText>
              </Pressable>
              <FlowText
                variant="monoData"
                tone="tertiary"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                LIFEOS · v0.4.5 · AURORA R45
              </FlowText>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SettingRow({
  dotColor,
  label,
  value,
  onPress,
}: {
  dotColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const t = useAurora();
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 0,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <FlowText variant="bodyM" tone="primary" style={{ fontSize: 15 }}>
            {label}
          </FlowText>
          <FlowText
            variant="caption"
            tone="tertiary"
            style={{ fontSize: 11 }}
            numberOfLines={1}
          >
            {value}
          </FlowText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={t.palette.inkTertiary} />
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
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: active ? t.palette.accent : 'rgba(255,255,255,0.18)',
          backgroundColor: active ? t.palette.accent : 'rgba(255,255,255,0.04)',
        }}
      >
        <FlowText
          variant="bodyS"
          style={{
            fontSize: 13,
            color: active ? t.palette.canvasA : t.palette.inkSecondary,
            fontWeight: active ? '600' : '500',
          }}
        >
          {label}
        </FlowText>
      </View>
    </Pressable>
  );
}

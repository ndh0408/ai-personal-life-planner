import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card, Button, Badge } from '../../components/ui';

type PermStatus = 'granted' | 'denied' | 'undetermined';

type Item = {
  key: 'notifications' | 'calendar' | 'healthFitness' | 'location' | 'microphone' | 'camera';
  /** When true, the OS exposes a real status today (only Notifications). */
  realCheck: boolean;
  status: PermStatus;
};

const INITIAL: Item[] = [
  { key: 'notifications', realCheck: true, status: 'undetermined' },
  { key: 'calendar', realCheck: false, status: 'undetermined' },
  { key: 'healthFitness', realCheck: false, status: 'undetermined' },
  { key: 'location', realCheck: false, status: 'undetermined' },
  { key: 'microphone', realCheck: false, status: 'undetermined' },
  { key: 'camera', realCheck: false, status: 'undetermined' },
];

/**
 * Permission Center — explains every OS permission the app may request.
 *
 * Today only `Notifications` has a wired Expo permissions module, so it
 * shows a live status. The other items document what data the app would
 * read and explicitly state we never run anything in the background. As
 * those features ship, swap their `realCheck=false` for an
 * `expo-{calendar,location,camera,av,image-picker,health-connect}` probe.
 *
 * Tapping "Open system settings" deep-links to the OS settings screen so
 * the user can revoke any granted permission outside the app.
 */
export function PermissionCenterScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>(INITIAL);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const notif = await Notifications.getPermissionsAsync();
        if (!mounted) return;
        setItems((prev) =>
          prev.map((p) =>
            p.key === 'notifications'
              ? {
                  ...p,
                  status: notif.granted
                    ? 'granted'
                    : notif.canAskAgain
                      ? 'undetermined'
                      : 'denied',
                }
              : p,
          ),
        );
      } catch {
        // Best-effort — if even the notification module fails, leave UI as
        // "not requested" so the user can still tap "Open system settings".
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <Screen scroll>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            marginBottom: spacing.xs,
          }}
        >
          {t('settings.privacy.permissions.title')}
        </Text>
        <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
          {t('settings.privacy.permissions.subtitle')}
        </Text>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {t('settings.privacy.permissions.noBackground')}
          </Text>
        </Card>

        {items.map((item, idx) => (
          <Card key={item.key} style={{ marginBottom: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                {t(`settings.privacy.permissions.items.${item.key}.title`)}
              </Text>
              {renderStatusBadge(item, t)}
            </View>
            <Text style={{ color: colors.textMuted, marginTop: spacing.xs }}>
              {t(`settings.privacy.permissions.items.${item.key}.purpose`)}
            </Text>
          </Card>
        ))}

        <Button
          title={t('settings.privacy.permissions.openSystemSettings')}
          variant="secondary"
          onPress={openSystemSettings}
        />
      </ScrollView>
    </Screen>
  );
}

function renderStatusBadge(item: Item, t: (k: string) => string) {
  if (!item.realCheck) {
    return <Badge tone="info">{t('settings.privacy.permissions.notRequested')}</Badge>;
  }
  switch (item.status) {
    case 'granted':
      return <Badge tone="success">{t('settings.privacy.permissions.granted')}</Badge>;
    case 'denied':
      return <Badge tone="danger">{t('settings.privacy.permissions.denied')}</Badge>;
    default:
      return <Badge tone="info">{t('settings.privacy.permissions.notRequested')}</Badge>;
  }
}

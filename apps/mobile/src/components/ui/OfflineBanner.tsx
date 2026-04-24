import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { networkStatus } from '../../services/offline/network-status';
import { syncQueue } from '../../services/offline/sync-queue';

/**
 * Global offline banner. Lives above all screens in RootNavigator. Shows:
 *   - "You're offline — showing cached data." while the probe is red.
 *   - "Syncing N pending actions…" briefly after reconnect while the queue
 *     drains (driven by the pending-count subscription).
 * Auto-hides when online AND the queue is empty.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const [online, setOnline] = useState(networkStatus.get());
  const [pending, setPending] = useState(0);

  useEffect(() => networkStatus.subscribe(setOnline), []);
  useEffect(() => syncQueue.subscribe(setPending), []);

  if (online && pending === 0) return null;

  const isSyncing = online && pending > 0;
  const bg = isSyncing ? colors.primary : colors.warning;
  const fg = '#FFFFFF';
  const message = !online
    ? t('offline.banner.offline')
    : t('offline.banner.syncing', { count: pending });

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.small, { color: fg, fontWeight: '600' }]}>{message}</Text>
    </View>
  );
}

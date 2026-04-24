import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Screen, Card } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ReportTile = {
  key: keyof RootStackParamList;
  title: string;
  body: string;
  icon: string;
};

export function ReportsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const nav = useNavigation<Nav>();

  const tiles: ReportTile[] = [
    {
      key: 'DailyReview',
      title: t('reports.daily'),
      body: t('reports.dailyDescription'),
      icon: '☀️',
    },
    {
      key: 'WeeklyReport',
      title: t('reports.weekly'),
      body: t('reports.weeklyDescription'),
      icon: '📊',
    },
    {
      key: 'MonthlyFinanceReport',
      title: t('reports.monthly'),
      body: t('reports.monthlyShortDescription'),
      icon: '💰',
    },
    {
      key: 'GoalProgressReport',
      title: t('reports.goalProgress'),
      body: t('reports.goalProgressDescription'),
      icon: '🎯',
    },
  ];

  return (
    <Screen scroll>
      <Text style={[typography.display, { color: colors.text }]}>{t('reports.title')}</Text>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {t('reports.subtitle')}
      </Text>
      <View style={{ gap: spacing.md }}>
        {tiles.map((tile) => (
          <TouchableOpacity key={tile.key} onPress={() => nav.navigate(tile.key as never)}>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontSize: 28 }}>{tile.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>
                    {tile.title}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {tile.body}
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 20 }}>›</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

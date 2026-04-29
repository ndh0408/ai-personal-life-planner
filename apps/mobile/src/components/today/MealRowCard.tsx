import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Text } from '../ui';
import { formatMoney } from '../../utils/format';
import type { MealRow } from '../../services/api/journal.service';

export function MealRowCard({ row }: { row: MealRow }) {
  const { t } = useTranslation();
  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="bodyEm" style={{ flex: 1 }}>
          {row.title}
        </Text>
        <Badge label={t(`capture.mealTypes.${row.mealType}`)} tone="success" />
      </View>
      {row.cost != null ? <Text variant="caption">{formatMoney(row.cost)}</Text> : null}
    </Card>
  );
}

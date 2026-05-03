import React from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAurora } from './AuroraProvider';
import { FlowText } from './FlowText';

interface Props {
  brand: string;
  iconName?: string;
  onIconPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Aurora screen header — lemniscate ∞ glyph + serif brand text on the
 * left, glass icon button on the right. Pencil R45 pattern shared by all
 * five tab screens.
 */
export function AuroraHeader({
  brand,
  iconName = 'settings-outline',
  onIconPress,
  accessibilityLabel,
}: Props) {
  const t = useAurora();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <FlowText
          variant="titleL"
          style={{
            fontSize: 32,
            lineHeight: 32,
            fontWeight: '300',
            color: t.palette.accentGlow,
          }}
        >
          ∞
        </FlowText>
        <FlowText
          variant="titleL"
          tone="primary"
          style={{ fontSize: 20, lineHeight: 24, fontWeight: '500' }}
        >
          {brand}
        </FlowText>
      </View>

      {onIconPress ? (
        <Pressable
          onPress={onIconPress}
          hitSlop={12}
          accessibilityLabel={accessibilityLabel ?? brand}
          accessibilityRole="button"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.20)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={iconName} size={18} color={t.palette.inkPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

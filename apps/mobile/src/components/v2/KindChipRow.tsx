import React from 'react';
import { ScrollView } from 'react-native';
import { CAPTURE_KINDS, CAPTURE_KIND_META, type CaptureKind } from '@lifeos/taxonomy';
import { useTheme } from '../../theme/v2';
import { Chip } from './Chip';

interface Props {
  selected: CaptureKind;
  onSelect: (kind: CaptureKind) => void;
  /** Optional locale; defaults to vi to match primary user base. */
  locale?: 'vi' | 'en';
  /** When provided, only these kinds appear as chips. */
  visibleKinds?: readonly CaptureKind[];
  /** True ⇒ classifier confidence chip wraps the suggested kind with a soft glow. */
  suggestedKind?: CaptureKind | null;
}

/**
 * Horizontal scrollable kind picker. Used inside CaptureSheetV2; the
 * suggested kind (from on-device classifier) shows a subtle glow on the
 * matching chip.
 */
export function KindChipRow({
  selected,
  onSelect,
  locale = 'vi',
  visibleKinds = CAPTURE_KINDS.filter((k) => k !== 'UNKNOWN'),
  suggestedKind = null,
}: Props) {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: t.space['5'], gap: t.space['2'] }}
    >
      {visibleKinds.map((kind) => {
        const meta = CAPTURE_KIND_META[kind];
        const label = locale === 'vi' ? meta.labelVi : meta.labelEn;
        const isSelected = selected === kind;
        const isSuggested = suggestedKind === kind && !isSelected;
        return (
          <Chip
            key={kind}
            label={label}
            selected={isSelected || isSuggested}
            onPress={() => onSelect(kind)}
            accent={t.color.kind[kind.toLowerCase() as keyof typeof t.color.kind] ?? undefined}
            testID={`kind-chip-${kind}`}
          />
        );
      })}
    </ScrollView>
  );
}

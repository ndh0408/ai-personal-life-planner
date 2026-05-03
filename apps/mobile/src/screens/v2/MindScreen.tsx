import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ScreenContainer,
  SectionHeader,
  Surface,
  Text,
  Insight,
  Tile,
  Chip,
  useCapture,
} from '../../components/v2';
import { useTheme } from '../../theme/v2';

/**
 * Mind — journal, mood, ideas. The introspective tab. By design has fewer
 * metrics and more white space; the goal is calm reflection, not
 * gamification.
 */
export function MindScreenV2() {
  const t = useTheme();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();

  return (
    <ScreenContainer>
      <View>
        <Text variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'NỘI TÂM' : 'MIND'}
        </Text>
        <Text variant="displayM" tone="primary" style={{ marginTop: t.space['1'] }}>
          {locale === 'vi' ? 'Khoảng lặng' : 'A pause'}
        </Text>
      </View>

      <Surface level="surface" radius="2xl" pad="6" bordered>
        <Text variant="kicker" tone="accent">
          {locale === 'vi' ? 'NHẬT KÝ HÔM NAY' : "TODAY'S JOURNAL"}
        </Text>
        <Text variant="titleL" tone="primary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Một câu hỏi nhỏ:' : 'A small question:'}
        </Text>
        <Text variant="bodyL" tone="secondary" style={{ marginTop: t.space['2'], lineHeight: 26 }}>
          {locale === 'vi'
            ? 'Điều gì hôm nay khiến bạn cảm thấy “đúng”, dù chỉ một chút?'
            : 'What today felt “right”, even just a little?'}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: t.space['4'] }}>
          <Chip
            label={locale === 'vi' ? 'Viết câu trả lời' : 'Write an answer'}
            selected
            onPress={() => capture.open({ initialKind: 'NOTE' })}
          />
        </View>
      </Surface>

      <Insight
        tone="celebrate"
        kicker={locale === 'vi' ? 'TUẦN QUA' : 'PAST WEEK'}
        title={locale === 'vi' ? 'Mood trung bình 3.8/5 — ổn định' : 'Mood avg 3.8/5 — stable'}
        body={
          locale === 'vi'
            ? '5 lần ghi mood, 0 ngày dưới 3. Cao nhất hôm thứ ba sau buổi chạy bộ.'
            : '5 mood logs, 0 days under 3. Peak was Tuesday after a run.'
        }
        evidenceCount={3}
        onWhyPress={() => undefined}
      />

      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'Ý TƯỞNG' : 'IDEAS'}
            metric="12"
            subtitle={locale === 'vi' ? 'tháng này' : 'this month'}
            onPress={() => undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Tile
            kicker={locale === 'vi' ? 'GHI CHÚ' : 'NOTES'}
            metric="48"
            subtitle={locale === 'vi' ? 'tháng này' : 'this month'}
            onPress={() => undefined}
          />
        </View>
      </View>

      <SectionHeader
        title={locale === 'vi' ? 'Đánh giá tuần' : 'Weekly review'}
        action={{ label: locale === 'vi' ? 'Mở' : 'Open', onPress: () => undefined }}
      />

      <Surface level="surface" radius="xl" pad="5" bordered>
        <Text variant="bodyM" tone="secondary" style={{ lineHeight: 22 }}>
          {locale === 'vi'
            ? 'AI đang chuẩn bị bản đánh giá cho tuần kết thúc Chủ Nhật. Hãy ghi lại 1-2 điều bạn muốn được hỏi.'
            : 'AI is drafting a review for the week ending Sunday. Note 1-2 things you want it to ask about.'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space['2'], marginTop: t.space['4'] }}>
          <Chip
            label={locale === 'vi' ? '+ Ý tưởng' : '+ Idea'}
            accent={t.color.accent.base}
            onPress={() => capture.open({ initialKind: 'IDEA' })}
          />
          <Chip
            label={locale === 'vi' ? '+ Ghi chú' : '+ Note'}
            onPress={() => capture.open({ initialKind: 'NOTE' })}
          />
        </View>
      </Surface>
    </ScreenContainer>
  );
}

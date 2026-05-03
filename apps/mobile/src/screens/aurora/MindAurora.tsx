import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AuroraScreen,
  AuroraHeader,
  GlassSurface,
  FlowText,
  GradientButton,
  SettingsSheet,
  useAurora,
} from '../../aurora';
import { useCapture } from '../../components/v2';

/**
 * MindAurora — Pencil R45 layout. Header + 2-line serif hero (mood phrase)
 * + 7-day mood bar chart + reflection card (recent journal in italic) +
 * AI insight card.
 */
export function MindAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 7-day mood values (0–10) — mock until /mood endpoint wired
  const mood7d = [5.5, 7.0, 4.2, 8.0, 6.5, 9.0, 8.5];
  const avg = mood7d.reduce((a, b) => a + b, 0) / mood7d.length;
  const today = mood7d[mood7d.length - 1];

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Tâm trí' : 'Mind'}
        iconName="book-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Nhật ký' : 'Journal'}
      />

      {/* Eyebrow + serif hero */}
      <View style={{ gap: 10 }}>
        <FlowText
          variant="kicker"
          tone="secondary"
          style={{ fontSize: 11, letterSpacing: 1.5 }}
        >
          {locale === 'vi'
            ? `TÂM TRẠNG · ${today.toFixed(1)} / 10`
            : `MOOD · ${today.toFixed(1)} / 10`}
        </FlowText>
        <FlowText
          variant="displayM"
          tone="primary"
          style={{ fontSize: 32, lineHeight: 38 }}
        >
          {moodHeroTitle(today, locale)}
        </FlowText>
      </View>

      {/* Mood chart card */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlowText variant="kicker" tone="tertiary">
            {locale === 'vi' ? 'TÂM TRẠNG · 7 NGÀY' : 'MOOD · 7 DAYS'}
          </FlowText>
          <FlowText
            variant="monoData"
            style={{
              color: t.palette.accentGlow,
              fontSize: 11,
              letterSpacing: 1,
            }}
          >
            {locale === 'vi' ? 'TB ' : 'AVG '}
            {avg.toFixed(1)} ↑
          </FlowText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            height: 88,
            gap: 8,
            marginTop: t.space['3'],
          }}
        >
          {mood7d.map((v, i) => {
            const h = Math.max(10, (v / 10) * 88);
            const color = v < 5 ? t.kind.expense : v >= 8 ? t.palette.accent : t.palette.accentGlow;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  backgroundColor: color,
                  opacity: i === mood7d.length - 1 ? 1 : 0.7,
                }}
              />
            );
          })}
        </View>
      </GlassSurface>

      {/* Reflection card */}
      <GlassSurface pad="5" radius="xl" intensity={0.95}>
        <FlowText variant="kicker" tone="tertiary">
          {locale === 'vi' ? 'GHI CHÉP · SÁNG NAY' : 'REFLECTION · THIS MORNING'}
        </FlowText>
        <FlowText
          variant="titleL"
          tone="primary"
          style={{
            marginTop: t.space['3'],
            fontStyle: 'italic',
            lineHeight: 26,
          }}
        >
          {locale === 'vi'
            ? '"Nhẹ người sau khi quyết định dừng dự án cũ. Năng lượng mới đang về."'
            : '"Lighter after dropping the old project. New energy on the way."'}
        </FlowText>
        <FlowText variant="caption" tone="tertiary" style={{ marginTop: t.space['2'] }}>
          {locale === 'vi' ? 'Ghi nhanh · 24 từ' : 'Quick note · 24 words'}
        </FlowText>
      </GlassSurface>

      {/* AI insight card */}
      <GlassSurface pad="5" radius="xl" intensity={1.2}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FlowText style={{ color: t.palette.accent, fontSize: 14 }}>✦</FlowText>
          <FlowText
            variant="kicker"
            style={{
              color: t.palette.accent,
              fontSize: 10,
              letterSpacing: 1.5,
            }}
          >
            {locale === 'vi' ? 'AURORA NHẬN THẤY' : 'AURORA SEES'}
          </FlowText>
        </View>
        <FlowText
          variant="titleL"
          tone="primary"
          style={{ marginTop: t.space['3'], lineHeight: 26 }}
        >
          {locale === 'vi'
            ? 'Tâm trạng cao điểm rơi vào sáng thứ Hai và thứ Ba, sau khi bạn ngủ trên 7 tiếng. Bảo vệ giờ đi ngủ tối Chủ nhật.'
            : 'Peak mood falls on Monday and Tuesday mornings after 7+ hours of sleep. Protect your Sunday bedtime.'}
        </FlowText>
      </GlassSurface>

      {/* Quick add */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Suy nghĩ' : '+ Thought'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'NOTE' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Mood' : '+ Mood'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'MOOD' })}
          style={{ flex: 1 }}
        />
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

function moodHeroTitle(today: number, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    if (today >= 8) return 'Lạc quan & tỉnh táo.\nNgày để nghĩ lớn.';
    if (today >= 6) return 'Bình ổn, đủ nghĩ.\nHít thở chậm.';
    return 'Cần nghỉ một nhịp.\nCho phép mình chậm.';
  }
  if (today >= 8) return 'Optimistic & clear.\nA day to think big.';
  if (today >= 6) return 'Steady, enough room.\nBreathe slow.';
  return 'A pause is okay.\nLet yourself slow.';
}

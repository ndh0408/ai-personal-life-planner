import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import { useDashboardSummary } from '../../hooks/useDashboard';
import {
  useTodayPlan,
  useGenerateTodayPlan,
  useSetItemStatus,
} from '../../hooks/usePlanner';

type Filter = 'today' | 'week' | 'month';

/**
 * PlanAurora — Pencil R45 layout. Header + filter pills + timeline list
 * grouped by time block. Tasks come from /api/planner/today (existing
 * hook). Empty state offers AI generate.
 */
export function PlanAurora() {
  const t = useAurora();
  const { i18n } = useTranslation();
  const locale = (i18n.language === 'vi' ? 'vi' : 'en') as 'vi' | 'en';
  const capture = useCapture();
  const dash = useDashboardSummary();
  const plan = useTodayPlan();
  const generate = useGenerateTodayPlan();
  const setStatus = useSetItemStatus();
  const [filter, setFilter] = useState<Filter>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const planSummary = dash.data?.todayPlan;
  const items = plan.data?.items ?? [];
  const blocks = useMemo(() => groupByTimeBlock(items), [items]);
  const doneCount = items.filter((i) => i.status === 'COMPLETED').length;
  const totalCount = items.length;

  return (
    <AuroraScreen>
      <AuroraHeader
        brand={locale === 'vi' ? 'Kế hoạch' : 'Plan'}
        iconName="options-outline"
        onIconPress={() => setSettingsOpen(true)}
        accessibilityLabel={locale === 'vi' ? 'Tùy chọn' : 'Filter'}
      />

      {/* Eyebrow + serif hero */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: t.kind.mood,
            }}
          />
          <FlowText
            variant="kicker"
            tone="secondary"
            style={{ fontSize: 11, letterSpacing: 1.5 }}
          >
            {locale === 'vi'
              ? `${totalCount} VIỆC · ${doneCount} ĐÃ XONG`
              : `${totalCount} TASKS · ${doneCount} DONE`}
          </FlowText>
        </View>
        <FlowText variant="displayM" tone="primary" style={{ lineHeight: 38 }}>
          {totalCount === 0
            ? locale === 'vi'
              ? 'Chưa có việc nào.\nLên kế hoạch nhé.'
              : 'Nothing planned.\nShape today.'
            : locale === 'vi'
            ? 'Tập trung\nvào ba việc lớn.'
            : 'Focus on three\nbig things.'}
        </FlowText>
      </View>

      {/* Filter pills */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['today', 'week', 'month'] as Filter[]).map((f) => {
          const active = f === filter;
          const label = filterLabel(f, locale);
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 9999,
                backgroundColor: active ? t.palette.accent : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: active ? t.palette.accent : 'rgba(255,255,255,0.14)',
              }}
            >
              <FlowText
                variant="bodyS"
                style={{
                  fontSize: 13,
                  fontWeight: active ? '600' : '500',
                  color: active ? t.palette.canvasA : t.palette.inkSecondary,
                }}
              >
                {label}
              </FlowText>
            </Pressable>
          );
        })}
      </View>

      {/* Plan progress bar (when items exist) */}
      {planSummary && planSummary.totalItems > 0 ? (
        <GlassSurface pad="5" radius="xl" intensity={1.0}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <FlowText variant="kicker" tone="tertiary">
              {locale === 'vi' ? 'TIẾN ĐỘ' : 'PROGRESS'}
            </FlowText>
            <FlowText
              variant="monoData"
              tone="primary"
              style={{ fontSize: 12, letterSpacing: 1 }}
            >
              {planSummary.doneItems}/{planSummary.totalItems}
            </FlowText>
          </View>
          <View
            style={{
              marginTop: t.space['3'],
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${
                  (planSummary.doneItems / Math.max(1, planSummary.totalItems)) * 100
                }%`,
                height: 4,
                backgroundColor: t.palette.accent,
                borderRadius: 2,
              }}
            />
          </View>
        </GlassSurface>
      ) : null}

      {/* Timeline list */}
      {blocks.length > 0 ? (
        <GlassSurface pad="4" radius="xl" intensity={0.9}>
          <View style={{ gap: 0 }}>
            {blocks.map((b, bi) => (
              <View key={bi}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 8,
                    paddingTop: bi === 0 ? 8 : 16,
                    paddingBottom: 8,
                  }}
                >
                  <FlowText
                    variant="monoData"
                    tone="tertiary"
                    style={{ fontSize: 11, letterSpacing: 1.2 }}
                  >
                    {b.label}
                  </FlowText>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.10)',
                    }}
                  />
                </View>
                {b.items.map((item, ii) => {
                  const isDone = item.status === 'COMPLETED';
                  const dotColor = [
                    t.palette.accent,
                    t.kind.task,
                    t.kind.expense,
                    t.kind.mood,
                  ][ii % 4];
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        setStatus.mutate({
                          id: item.id,
                          status: isDone ? 'PENDING' : 'COMPLETED',
                        })
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: isDone ? 'rgba(255,255,255,0.18)' : dotColor,
                        }}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <FlowText
                          variant="bodyM"
                          tone={isDone ? 'tertiary' : 'primary'}
                          numberOfLines={1}
                          style={
                            isDone
                              ? { textDecorationLine: 'line-through' as const }
                              : undefined
                          }
                        >
                          {item.title}
                        </FlowText>
                        <FlowText
                          variant="caption"
                          tone="tertiary"
                          style={{ fontSize: 11 }}
                        >
                          {formatTimeRange(item.startAt, item.endAt) ?? ' '}
                        </FlowText>
                      </View>
                      <FlowText variant="caption" tone="tertiary">
                        ›
                      </FlowText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </GlassSurface>
      ) : (
        <GlassSurface pad="6" radius="2xl" intensity={1.0}>
          <FlowText variant="kicker" tone="accent">
            {locale === 'vi' ? 'CHƯA CÓ KẾ HOẠCH' : 'NO PLAN YET'}
          </FlowText>
          <FlowText variant="titleM" tone="primary" style={{ marginTop: t.space['2'] }}>
            {locale === 'vi'
              ? 'Để AI gợi ý 3 việc lớn cho hôm nay?'
              : 'Let AI shape 3 big things for today?'}
          </FlowText>
          <View style={{ marginTop: t.space['4'] }}>
            <GradientButton
              label={
                generate.isPending
                  ? locale === 'vi'
                    ? 'Đang tạo…'
                    : 'Generating…'
                  : locale === 'vi'
                  ? 'AI lên kế hoạch'
                  : 'AI plan my day'
              }
              onPress={() => generate.mutate()}
              disabled={generate.isPending}
            />
          </View>
        </GlassSurface>
      )}

      {/* Quick add buttons */}
      <View style={{ flexDirection: 'row', gap: t.space['3'] }}>
        <GradientButton
          label={locale === 'vi' ? '+ Việc nhanh' : '+ Quick task'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'TASK' })}
          style={{ flex: 1 }}
        />
        <GradientButton
          label={locale === 'vi' ? '+ Sự kiện' : '+ Event'}
          variant="glass"
          onPress={() => capture.open({ initialKind: 'EVENT' })}
          style={{ flex: 1 }}
        />
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuroraScreen>
  );
}

interface PlanItem {
  id: string;
  title: string;
  status: 'COMPLETED' | 'PENDING' | string;
  startAt?: string | null;
  endAt?: string | null;
}

function groupByTimeBlock(items: PlanItem[]): { label: string; items: PlanItem[] }[] {
  const sorted = [...items].sort((a, b) => {
    const ta = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
  const groups = new Map<string, PlanItem[]>();
  for (const it of sorted) {
    const label = it.startAt ? hourBlockLabel(new Date(it.startAt)) : 'Bất kỳ';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(it);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function hourBlockLabel(d: Date): string {
  const h = d.getHours();
  // Round to nearest hour block (3-hour buckets)
  const block = Math.floor(h / 3) * 3;
  return `${String(block).padStart(2, '0')}:00`;
}

function filterLabel(f: Filter, locale: 'vi' | 'en'): string {
  if (locale === 'vi') {
    return f === 'today' ? 'Hôm nay' : f === 'week' ? 'Tuần này' : 'Tháng';
  }
  return f === 'today' ? 'Today' : f === 'week' ? 'This week' : 'Month';
}

function formatTimeRange(start?: string | null, end?: string | null): string | null {
  if (!start) return null;
  try {
    const s = new Date(start);
    const t1 = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
    if (!end) return t1;
    const e = new Date(end);
    const t2 = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
    return `${t1} – ${t2}`;
  } catch {
    return null;
  }
}

import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import {
  Card,
  Badge,
  Button,
  Chip,
  Input,
  Loading,
  ErrorView,
  ProgressCard,
  EmptyState,
} from '../../components/ui';
import {
  goalsApi,
  type GoalMilestone,
  type GoalStatus,
  type MilestoneStatus,
} from '../../services/api/goals.api';
import { aiApi } from '../../services/api/ai.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { formatDateByLocale } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Route = RouteProp<RootStackParamList, 'GoalDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_TARGETS: GoalStatus[] = ['COMPLETED', 'PAUSED', 'CANCELLED'];

export function GoalDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { t } = useTranslation();
  const translateError = useErrorMessage();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { goalId } = route.params;
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['goals', goalId], queryFn: () => goalsApi.getById(goalId) });
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | 'milestones' | 'today' | 'check'>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['goals'] });
    qc.invalidateQueries({ queryKey: ['goals', goalId] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const statusMut = useMutation({
    mutationFn: (status: GoalStatus) => goalsApi.update(goalId, { status }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const milestoneStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MilestoneStatus }) =>
      goalsApi.patchMilestoneStatus(id, status),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  const removeMilestoneMut = useMutation({
    mutationFn: (id: string) => goalsApi.removeMilestone(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e)),
  });

  async function addMilestone() {
    const trimmed = newMilestoneTitle.trim();
    if (!trimmed) {
      Alert.alert(t('goals.milestone.invalidTitle'), t('goals.milestone.invalidTitleBody'));
      return;
    }
    const trimmedDate = newMilestoneDate.trim();
    if (trimmedDate && !DATE_RE.test(trimmedDate)) {
      Alert.alert(t('goals.milestone.invalidTitle'), t('goals.milestone.invalidDateBody'));
      return;
    }
    setAddingMilestone(true);
    try {
      await goalsApi.addMilestone(goalId, {
        title: trimmed,
        targetDate: trimmedDate || undefined,
      });
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
      invalidate();
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setAddingMilestone(false);
    }
  }

  function confirmRemoveMilestone(m: GoalMilestone) {
    Alert.alert(t('goals.milestone.confirmDeleteTitle'), t('goals.milestone.confirmDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => removeMilestoneMut.mutate(m.id),
      },
    ]);
  }

  function confirmStatusChange(s: GoalStatus) {
    const key =
      s === 'COMPLETED'
        ? 'goals.confirmComplete'
        : s === 'PAUSED'
          ? 'goals.confirmPause'
          : 'goals.confirmCancel';
    Alert.alert(t(`${key}.title`), t(`${key}.body`), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () => statusMut.mutate(s),
      },
    ]);
  }

  async function askAi(mode: 'milestones' | 'today' | 'check') {
    if (!q.data) return;
    const g = q.data;
    setAiBusy(mode);
    try {
      const base = `${t('goals.category.' + g.category)} goal "${g.title}"`;
      const numeric =
        g.targetValue != null && g.currentValue != null
          ? ` — progress ${g.currentValue}/${g.targetValue}${g.unit ? ' ' + g.unit : ''}`
          : '';
      const deadlineStr = g.deadline ? ` · deadline ${g.deadline.slice(0, 10)}` : '';
      const msCount = `${g.milestones.length} milestones`;
      const context = `${base}${numeric}${deadlineStr} · ${msCount}`;
      const message =
        mode === 'milestones'
          ? t('goals.ai.milestonePrompt', { context })
          : mode === 'today'
            ? t('goals.ai.todayPrompt', { context })
            : t('goals.ai.checkPrompt', { context });
      const res = await aiApi.chat({ message, contextType: 'goals-helper' });
      Alert.alert(
        mode === 'milestones'
          ? t('goals.ai.milestoneTitle')
          : mode === 'today'
            ? t('goals.ai.todayTitle')
            : t('goals.ai.checkTitle'),
        res.reply.answer,
        [{ text: t('common.ok') }],
      );
    } catch (e) {
      Alert.alert(t('errors.UNKNOWN_ERROR'), translateError(e));
    } finally {
      setAiBusy(null);
    }
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorView message={translateError(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data) return <EmptyState title={t('goals.notFound')} />;

  const g = q.data;
  const hasNumeric = g.targetValue != null && g.currentValue != null && g.targetValue > 0;
  const completed = g.milestones.filter((m) => m.status === 'COMPLETED').length;
  const msTotal = g.milestones.length;
  const msPct = msTotal > 0 ? Math.round((completed / msTotal) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: 160 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xs,
          flexWrap: 'wrap',
          marginBottom: spacing.xs,
        }}
      >
        <Badge tone="neutral">{t(`goals.category.${g.category}`)}</Badge>
        <Badge
          tone={g.priority === 'HIGH' ? 'danger' : g.priority === 'MEDIUM' ? 'warning' : 'neutral'}
        >
          {t(`tasks.priority.${g.priority}`)}
        </Badge>
        <Badge tone={g.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {t(`goals.status.${g.status}`)}
        </Badge>
      </View>

      <Text style={[typography.h1, { color: colors.text }]}>{g.title}</Text>
      {g.description ? (
        <Text style={[typography.body, { color: colors.textMuted }]}>{g.description}</Text>
      ) : null}
      {g.deadline ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {t('goals.deadline')}: {formatDateByLocale(g.deadline, { weekday: undefined })}
        </Text>
      ) : null}

      <Button title={t('goals.edit')} variant="ghost" onPress={() => nav.navigate('CreateGoal', { goalId })} />

      {hasNumeric ? (
        <ProgressCard
          title={t('goals.progress')}
          current={g.currentValue!}
          target={g.targetValue!}
          currentLabel={`${g.currentValue} / ${g.targetValue} ${g.unit ?? ''}`.trim()}
        />
      ) : null}

      {msTotal > 0 ? (
        <ProgressCard
          title={t('goals.milestonesProgress')}
          current={completed}
          target={msTotal}
          currentLabel={`${completed}/${msTotal} · ${msPct}%`}
        />
      ) : null}

      {/* Status actions */}
      <Card>
        <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
          {t('goals.statusActions')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {STATUS_TARGETS.filter((s) => s !== g.status).map((s) => (
            <Chip
              key={s}
              label={t(`goals.markAs.${s}`)}
              selected={false}
              onPress={() => confirmStatusChange(s)}
            />
          ))}
          {g.status !== 'ACTIVE' ? (
            <Chip
              label={t('goals.markAs.ACTIVE')}
              selected={false}
              onPress={() => statusMut.mutate('ACTIVE')}
            />
          ) : null}
        </View>
      </Card>

      {/* Milestones list */}
      <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md }]}>
        {t('goals.milestones')}
      </Text>
      {g.milestones.length === 0 ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {t('goals.milestone.empty')}
        </Text>
      ) : (
        g.milestones.map((m) => {
          const isDone = m.status === 'COMPLETED';
          const isCancelled = m.status === 'CANCELLED';
          return (
            <Card key={m.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      typography.bodyStrong,
                      {
                        color: colors.text,
                        textDecorationLine: isDone || isCancelled ? 'line-through' : 'none',
                        opacity: isDone || isCancelled ? 0.6 : 1,
                      },
                    ]}
                  >
                    {m.title}
                  </Text>
                  {m.targetDate ? (
                    <Text
                      style={[typography.small, { color: colors.textMuted, marginTop: 2 }]}
                    >
                      {t('goals.milestone.target')}:{' '}
                      {formatDateByLocale(m.targetDate, { weekday: undefined })}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                    <Badge
                      tone={isDone ? 'success' : isCancelled ? 'neutral' : 'warning'}
                    >
                      {t(`goals.milestone.status.${m.status}`)}
                    </Badge>
                  </View>
                </View>
                <View style={{ gap: spacing.xs }}>
                  {!isDone ? (
                    <TouchableOpacity
                      onPress={() =>
                        milestoneStatusMut.mutate({ id: m.id, status: 'COMPLETED' })
                      }
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.primary }]}>
                        {t('goals.milestone.complete')}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => milestoneStatusMut.mutate({ id: m.id, status: 'TODO' })}
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.text }]}>
                        {t('goals.milestone.reopen')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => confirmRemoveMilestone(m)}
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={[typography.caption, { color: colors.danger }]}>
                      {t('common.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        })
      )}

      {/* Add milestone */}
      <Card>
        <Text style={[typography.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>
          {t('goals.milestone.addTitle')}
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Input
            placeholder={t('goals.milestone.titlePlaceholder')}
            value={newMilestoneTitle}
            onChangeText={setNewMilestoneTitle}
          />
          <Input
            placeholder="2026-06-30"
            value={newMilestoneDate}
            onChangeText={setNewMilestoneDate}
            autoCapitalize="none"
          />
          <Button
            title={addingMilestone ? t('common.loading') : t('goals.milestone.add')}
            size="sm"
            onPress={addMilestone}
            disabled={addingMilestone}
          />
        </View>
      </Card>

      {/* AI helpers */}
      <Card>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>
          {t('goals.ai.sectionTitle')}
        </Text>
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {t('goals.ai.sectionBody')}
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title={aiBusy === 'milestones' ? t('common.loading') : t('goals.ai.milestoneCta')}
            variant="ghost"
            size="sm"
            onPress={() => askAi('milestones')}
            disabled={aiBusy !== null}
          />
          <Button
            title={aiBusy === 'today' ? t('common.loading') : t('goals.ai.todayCta')}
            variant="ghost"
            size="sm"
            onPress={() => askAi('today')}
            disabled={aiBusy !== null}
          />
          <Button
            title={aiBusy === 'check' ? t('common.loading') : t('goals.ai.checkCta')}
            variant="ghost"
            size="sm"
            onPress={() => askAi('check')}
            disabled={aiBusy !== null}
          />
        </View>
        <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
          {t('goals.ai.disclaimer')}
        </Text>
      </Card>
    </ScrollView>
  );
}

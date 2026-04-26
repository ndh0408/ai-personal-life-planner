import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme, useResponsive } from '../../theme';
import { Screen, Card, Button, Input, Chip, Badge } from '../../components/ui';
import { voiceCompanionApi } from '../../services/api/voice-companion.api';
import { expensesApi, walletsApi } from '../../services/api/finance.api';
import { tasksApi } from '../../services/api/tasks.api';
import { userAiProvidersApi } from '../../services/api/user-ai-providers.api';
import { useErrorMessage } from '../../i18n/useErrorMessage';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { QUERY_KEYS } from '../../constants';
import { formatMoneyByLocale } from '../../utils/format';
import {
  parseQuickCapture as ruleParse,
  type CaptureDraft,
} from '../../services/quickCapture/ruleParser';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Quick Capture — type one line, app routes it.
 *
 * Round 20.5 redesign:
 *   - Rule-based parser runs locally so users without an AI key can
 *     still capture an expense / task in one line.
 *   - When the user has a configured AI provider we expose an opt-in
 *     "Use AI for richer parsing" button that hits
 *     `POST /ai/parse-quick-capture` (existing backend) and routes
 *     results through `SuggestedActionsReviewScreen`.
 *   - Drafts always require user confirmation before any API write.
 *
 * Voice STT is intentionally not wired in this build. The screen no
 * longer claims voice as a feature; the section reads "coming soon".
 */
export function QuickCaptureScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t, i18n } = useTranslation();
  const { isTablet } = useResponsive();
  const messageFor = useErrorMessage();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<CaptureDraft[]>([]);
  const [didParse, setDidParse] = useState(false);

  const providersQ = useQuery({
    queryKey: QUERY_KEYS.aiProviders,
    queryFn: userAiProvidersApi.list,
    staleTime: 60_000,
  });
  const walletsQ = useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.list(),
    staleTime: 60_000,
  });
  const hasAi = (providersQ.data ?? []).length > 0;

  // Voice — Round 21 wires real Whisper-backed transcription via the
  // backend `/voice/transcribe` route. Press-and-hold pattern; the
  // mic is OFF until the user actively presses the button.
  const recorder = useVoiceRecorder();
  const transcribeMut = useMutation({
    mutationFn: (input: { audioBase64: string; mimeType: string }) =>
      voiceCompanionApi.transcribe({
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        locale: (i18n.language === 'en' ? 'en' : 'vi') as 'vi' | 'en',
      }),
    onSuccess: (res) => {
      if (res.notImplemented) {
        Alert.alert(
          t('errors.AI_PROVIDER_NOT_CONFIGURED'),
          t('settings.aiSetup.noKeyBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.aiSetup.addKey'), onPress: () => nav.navigate('AISetup') },
          ],
        );
        return;
      }
      const transcript = (res.transcript ?? '').trim();
      if (!transcript) {
        Alert.alert(t('settings.quickCapture.errorTitle'), t('settings.quickCapture.transcribeEmpty'));
        return;
      }
      setText(transcript);
      setDidParse(false);
      // Auto-parse so the user immediately sees a draft after their
      // recording stops talking — saves a tap.
      const found = ruleParse(transcript);
      setDrafts(found);
      setDidParse(true);
    },
    onError: (e) => Alert.alert(t('settings.quickCapture.errorTitle'), messageFor(e)),
  });

  const onMicPressIn = async () => {
    await recorder.start();
  };
  const onMicPressOut = async () => {
    if (!recorder.recording) return;
    const out = await recorder.stopAndGetBase64();
    if (!out) return;
    transcribeMut.mutate(out);
  };

  const examples = useMemo<string[]>(() => {
    const raw = i18n.t('settings.quickCapture.examples', { returnObjects: true }) as unknown;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [i18n.language]);

  const runRuleParse = () => {
    const found = ruleParse(text);
    setDrafts(found);
    setDidParse(true);
  };

  const aiMut = useMutation({
    mutationFn: () =>
      voiceCompanionApi.parseQuickCapture({
        transcript: text.trim(),
        source: 'TEXT_FALLBACK',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pendingActions });
      setText('');
      setDrafts([]);
      nav.navigate('SuggestedActionsReview');
    },
    onError: (e) => Alert.alert(t('settings.quickCapture.errorTitle'), messageFor(e)),
  });

  const saveExpenseMut = useMutation({
    mutationFn: async (d: Extract<CaptureDraft, { kind: 'EXPENSE' }>) => {
      const wallet = (walletsQ.data ?? [])[0];
      return expensesApi.create({
        title: d.title,
        amount: d.amount,
        category: d.category,
        expenseDate: d.expenseDate,
        walletId: wallet?.id,
      });
    },
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDrafts((cur) => cur.filter((x) => x !== d));
      Alert.alert(t('settings.quickCapture.savedExpense'));
      if (drafts.length <= 1) {
        setText('');
        setDidParse(false);
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const saveTaskMut = useMutation({
    mutationFn: (d: Extract<CaptureDraft, { kind: 'TASK' }>) =>
      tasksApi.create({
        title: d.title,
        priority: 'MEDIUM',
        dueDate: d.dueDate,
      }),
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDrafts((cur) => cur.filter((x) => x !== d));
      Alert.alert(t('settings.quickCapture.savedTask'));
      if (drafts.length <= 1) {
        setText('');
        setDidParse(false);
      }
    },
    onError: (e) => Alert.alert(t('errors.UNKNOWN_ERROR'), messageFor(e)),
  });

  const onConfirm = (d: CaptureDraft) => {
    if (d.kind === 'EXPENSE') saveExpenseMut.mutate(d);
    else saveTaskMut.mutate(d);
  };

  const onDiscard = (d: CaptureDraft) => {
    setDrafts((cur) => cur.filter((x) => x !== d));
  };

  const savingId = saveExpenseMut.isPending || saveTaskMut.isPending;

  return (
    <Screen scroll>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120,
          maxWidth: isTablet ? 720 : undefined,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Text style={[typography.h1, { color: colors.text }]}>
          {t('settings.quickCapture.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          {t('settings.quickCapture.subtitle')}
        </Text>

        <Input
          label={t('settings.quickCapture.title')}
          placeholder={t('settings.quickCapture.placeholder')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setDidParse(false);
          }}
          multiline
          autoCapitalize="sentences"
          style={{ minHeight: 96 }}
        />

        {/* Press-and-hold mic — sends audio to OpenAI Whisper via the
            backend; the transcript becomes the input text and is
            auto-parsed. The mic is OFF until pressed. */}
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Pressable
            onPressIn={onMicPressIn}
            onPressOut={onMicPressOut}
            disabled={transcribeMut.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('settings.quickCapture.holdToTalk')}
            accessibilityState={{ busy: recorder.recording || transcribeMut.isPending }}
            style={(state: { pressed: boolean }) => ({
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: recorder.recording ? colors.danger : colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: state.pressed ? 0.85 : 1,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 8,
              elevation: 4,
            })}
          >
            <Ionicons
              name={recorder.recording ? 'stop' : 'mic'}
              size={36}
              color="#FFFFFF"
            />
          </Pressable>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {recorder.recording
              ? t('settings.quickCapture.recordingTimer', {
                  seconds: Math.floor(recorder.durationMs / 1000),
                })
              : transcribeMut.isPending
                ? t('settings.quickCapture.transcribing')
                : t('settings.quickCapture.holdToTalkHint')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <Button
            title={t('settings.quickCapture.parse')}
            onPress={runRuleParse}
            disabled={!text.trim()}
            fullWidth
            size="lg"
          />
        </View>

        {/* Example chips help users learn what the parser handles. */}
        {examples.length > 0 && drafts.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              {t('settings.quickCapture.examplesHeading')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {examples.map((ex) => (
                <Chip
                  key={ex}
                  label={ex}
                  onPress={() => {
                    setText(ex);
                    setDidParse(false);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Drafts — user confirms before any data is persisted. */}
        {drafts.length > 0 ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {drafts.map((d, idx) => (
              <DraftCard
                key={`${d.kind}-${idx}`}
                draft={d}
                walletName={(walletsQ.data ?? [])[0]?.name}
                onConfirm={() => onConfirm(d)}
                onDiscard={() => onDiscard(d)}
                disabled={savingId}
                locale={i18n.language}
              />
            ))}
          </View>
        ) : didParse ? (
          <Card style={{ marginTop: spacing.xl }}>
            <Text style={[typography.body, { color: colors.textMuted }]}>
              {t('settings.quickCapture.noDraft')}
            </Text>
          </Card>
        ) : null}

        {/* Optional AI parse — only when the user actually has a key. */}
        {text.trim() && hasAi ? (
          <View style={{ marginTop: spacing.xl }}>
            <Button
              title={
                aiMut.isPending
                  ? t('settings.quickCapture.aiBusy')
                  : t('settings.quickCapture.useAi')
              }
              variant="secondary"
              onPress={() => aiMut.mutate()}
              loading={aiMut.isPending}
              fullWidth
            />
          </View>
        ) : null}

      </ScrollView>
    </Screen>
  );
}

function DraftCard({
  draft,
  walletName,
  onConfirm,
  onDiscard,
  disabled,
  locale,
}: {
  draft: CaptureDraft;
  walletName?: string;
  onConfirm: () => void;
  onDiscard: () => void;
  disabled: boolean;
  locale: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const isExpense = draft.kind === 'EXPENSE';
  const heading = isExpense
    ? t('settings.quickCapture.draftExpense')
    : t('settings.quickCapture.draftTask');
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Badge tone={isExpense ? 'warning' : 'primary'}>{heading}</Badge>
        {draft.confidence === 'medium' ? (
          <Badge tone="info">~</Badge>
        ) : null}
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>
        {draft.title}
      </Text>
      {isExpense ? (
        <View style={{ marginTop: spacing.xs, gap: 2 }}>
          <Text style={[typography.body, { color: colors.text }]}>
            {formatMoneyByLocale(draft.amount, 'VND')}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {draft.category}
            {walletName ? ` · ${walletName}` : ''}
          </Text>
        </View>
      ) : draft.dueDate ? (
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {new Date(draft.dueDate).toLocaleString(locale)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Button
          title={t('settings.quickCapture.confirm')}
          onPress={onConfirm}
          disabled={disabled}
        />
        <Button
          title={t('settings.quickCapture.discard')}
          variant="ghost"
          onPress={onDiscard}
          disabled={disabled}
        />
      </View>
    </Card>
  );
}

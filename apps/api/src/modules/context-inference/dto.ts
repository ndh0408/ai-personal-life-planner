import type {
  ContextInference,
  ContextSignal,
  UserPattern,
} from '@prisma/client';
import type {
  ContextEvidenceItemDto,
  ContextInferenceDto,
  ContextSignalDto,
  UserPatternDto,
} from '@planner/shared';

export function toContextSignalDto(row: ContextSignal): ContextSignalDto {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    confidence: row.confidence,
    occurredAt: row.occurredAt.toISOString(),
    value: (row.value as Record<string, unknown>) ?? {},
  };
}

export function toContextInferenceDto(row: ContextInference): ContextInferenceDto {
  const ev = (row.evidence as { locale?: string; items?: ContextEvidenceItemDto[] } | null) ?? {};
  return {
    id: row.id,
    type: row.type,
    confidence: row.confidence,
    evidence: {
      locale: ev.locale ?? 'vi',
      items: ev.items ?? [],
    },
    suggestedAction:
      (row.suggestedAction as { type: string; [k: string]: unknown } | null) ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toUserPatternDto(row: UserPattern): UserPatternDto {
  return {
    id: row.id,
    patternType: row.patternType,
    value: (row.value as Record<string, unknown>) ?? {},
    confidence: row.confidence,
    lastObservedAt: row.lastObservedAt.toISOString(),
  };
}

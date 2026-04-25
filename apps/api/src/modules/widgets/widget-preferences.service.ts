import { Injectable } from '@nestjs/common';
import type { WidgetPreferences } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateWidgetPreferencesInput } from '@planner/shared';

const DEFAULTS = {
  enabled: true,
  showTasks: true,
  showRecommendations: true,
  showHealthData: true,
  showFinance: true,
  /// Off by default — user must explicitly opt in to seeing money on the
  /// home-screen widget. Lock-screen previews are a real risk surface.
  showFinanceAmounts: false,
  /// Default to HIDE_SENSITIVE so finance widget shows percent/dash even if
  /// the user toggles `showFinance` on without thinking about lock-screen.
  privacyMode: 'HIDE_SENSITIVE' as const,
};

@Injectable()
export class WidgetPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<WidgetPreferences> {
    const found = await this.prisma.widgetPreferences.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...DEFAULTS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as WidgetPreferences;
  }

  update(userId: string, input: UpdateWidgetPreferencesInput): Promise<WidgetPreferences> {
    return this.prisma.widgetPreferences.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...input },
      update: input,
    });
  }
}

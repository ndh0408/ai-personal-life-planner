import { AiFinanceService } from './ai-finance.service';
import { AiProviderService } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { MockAiProvider } from '../providers/mock.provider';
import { makeStubResolver, makeStubPrivacy } from './test-helpers';
import { makeStubUsage } from './test-helpers';
import type { LocaleService } from '../../../common/i18n/locale.service';

function mockLocale(tag: 'vi' | 'en' = 'vi'): LocaleService {
  return {
    forUser: jest.fn(() => Promise.resolve(tag)),
    fromRequest: jest.fn(() => tag),
    get default() {
      return tag;
    },
  } as unknown as LocaleService;
}

// Minimal stub covering only the methods the service touches in happy-path.
function makePrisma() {
  const api = {
    userProfile: {
      findUnique: jest.fn(() =>
        Promise.resolve({ monthlySalary: 25_000_000, currency: 'VND' }),
      ),
    },
    wallet: {
      findMany: jest.fn(() => Promise.resolve([{ balance: 18_500_000 }, { balance: 1_200_000 }])),
    },
    income: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { title: 'Salary', amount: 25_000_000, category: 'salary', incomeDate: new Date('2026-04-05') },
        ]),
      ),
    },
    expense: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { title: 'Rent', amount: 6_000_000, category: 'housing', needLevel: 'NEED' },
          { title: 'Coffee', amount: 65_000, category: 'food', needLevel: 'WANT' },
          { title: 'Shopping', amount: 1_200_000, category: 'shopping', needLevel: 'WASTE' },
        ]),
      ),
    },
    budget: {
      findMany: jest.fn(() =>
        Promise.resolve([
          { category: 'shopping', amount: 500_000, alertThresholdPercent: 60 },
          { category: 'food', amount: 3_000_000, alertThresholdPercent: 80 },
        ]),
      ),
    },
    debt: { findMany: jest.fn(() => Promise.resolve([])) },
    savingGoal: { findMany: jest.fn(() => Promise.resolve([])) },
    $transaction: jest.fn((calls: Promise<unknown>[]) => Promise.all(calls)),
  };
  return api;
}

describe('AiFinanceService', () => {
  it('returns analysis with server-computed totals (happy path, vi)', async () => {
    const prisma = makePrisma();
    const provider = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const svc = new AiFinanceService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('vi'),
      makeStubResolver(provider),
      makeStubPrivacy(),
    );
    const result = await svc.analyze('u1', { month: '2026-04' }, {});
    expect(result.usedFallback).toBe(false);
    // Totals are overwritten from aggregated expenses, regardless of what the AI returned.
    expect(result.analysis.totalIncome).toBe(25_000_000);
    expect(result.analysis.totalExpense).toBe(7_265_000);
    expect(result.analysis.remainingMoney).toBe(17_735_000);
    expect(result.locale).toBe('vi');
  });

  it('falls back to locale-specific safe template on invalid JSON', async () => {
    const prisma = makePrisma();
    const mock = new MockAiProvider();
    mock.setBroken(true);
    mock.setNextResponse('still garbage'); // repair attempt also broken
    const provider = new AiProviderService(mock, makeStubUsage());
    const svc = new AiFinanceService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('en'),
      makeStubResolver(provider),
      makeStubPrivacy(),
    );
    const result = await svc.analyze('u1', { month: '2026-04' }, {});
    expect(result.usedFallback).toBe(true);
    expect(result.analysis.usefulAdvice[0]).toMatch(/fallback/i);
    // Even on fallback, real totals are preserved.
    expect(result.analysis.totalIncome).toBe(25_000_000);
  });

  it('falls back when AI hangs past timeout', async () => {
    const prisma = makePrisma();
    const mock = new MockAiProvider();
    mock.setHang(200);
    const provider = new AiProviderService(mock, makeStubUsage());
    const svc = new AiFinanceService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('vi'),
      makeStubResolver(provider),
      makeStubPrivacy(),
    );
    // Tight timeout to trigger the fallback path deterministically.
    jest
      .spyOn(provider, 'complete')
      .mockImplementationOnce(() =>
        AiProviderService.prototype.complete.call(provider, { system: '', prompt: '' }, { timeoutMs: 50, maxAttempts: 1 }),
      );
    const result = await svc.analyze('u1', { month: '2026-04' }, {});
    expect(result.usedFallback).toBe(true);
  });
});

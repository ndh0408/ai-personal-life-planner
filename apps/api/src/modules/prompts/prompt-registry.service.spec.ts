import { PromptRegistryService } from './prompt-registry.service';

describe('PromptRegistryService', () => {
  const service = new PromptRegistryService();

  it('lists all registered prompts', () => {
    const list = service.list();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const ids = list.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'capture-classifier',
        'assistant-system',
        'weekly-review',
      ]),
    );
  });

  it('resolves capture-classifier latest version', () => {
    const p = service.resolve('capture-classifier');
    expect(p.id).toBe('capture-classifier');
    expect(p.version).toBe('1.0.0');
    expect(p.defaultModel).toBe('gpt-4o-mini');
  });

  it('resolves a specific version when pinned', () => {
    const p = service.resolve('capture-classifier', '1.0.0');
    expect(p.version).toBe('1.0.0');
  });

  it('throws on unknown prompt id', () => {
    expect(() => service.resolve('nope')).toThrow(/Prompt not found/);
  });

  it('throws on missing pinned version', () => {
    expect(() => service.resolve('capture-classifier', '99.9.9')).toThrow(/Prompt not found/);
  });

  it('renders capture-classifier with valid input and stamps metadata', () => {
    const out = service.render('capture-classifier', {
      text: 'cà phê 35k',
      capturedAtLocal: '2026-05-03T08:00:00+07:00',
      locale: 'vi',
    });
    expect(out.system).toMatch(/Capture Classifier/);
    expect(out.user).toContain('cà phê 35k');
    expect(out.promptId).toBe('capture-classifier');
    expect(out.promptVersion).toBe('1.0.0');
    expect(out.defaultModel).toBe('gpt-4o-mini');
    expect(out.temperature).toBeLessThanOrEqual(0.2);
  });

  it('rejects invalid input via the registered zod schema', () => {
    expect(() =>
      service.render('capture-classifier', {
        text: '',
        capturedAtLocal: '2026-05-03T08:00:00+07:00',
        locale: 'vi',
      }),
    ).toThrow();
  });
});

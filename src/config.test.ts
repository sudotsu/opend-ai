import { describe, it, expect } from 'vitest';
import { mergeConfig } from './config.js';

describe('mergeConfig precedence: DEFAULTS < home file < cwd file < env', () => {
  it('falls back to defaults when nothing is set', () => {
    const cfg = mergeConfig({}, {}, {});
    expect(cfg.model).toBe('olafangensan-glm-4.7-flash-heretic');
    expect(cfg.posture).toBe('coding');
    expect(cfg.contextTokens).toBe(96000);
    expect(cfg.maxRetries).toBe(3);
    expect(cfg.pricing).toEqual({ in: 0, out: 0 });
    expect(cfg.apiKey).toBe('');
  });

  it('home config overrides defaults', () => {
    const cfg = mergeConfig({ model: 'home-model', maxRetries: 5 }, {}, {});
    expect(cfg.model).toBe('home-model');
    expect(cfg.maxRetries).toBe(5);
  });

  it('cwd config overrides home config', () => {
    const cfg = mergeConfig({ model: 'home-model' }, { model: 'cwd-model' }, {});
    expect(cfg.model).toBe('cwd-model');
  });

  it('env overrides both files for apiKey, model, and posture', () => {
    const cfg = mergeConfig(
      { model: 'home-model', apiKey: 'home-key', posture: 'raw' },
      { model: 'cwd-model' },
      { VENICE_API_KEY: 'env-key', VENICE_MODEL: 'env-model', VENICE_POSTURE: 'coding' }
    );
    expect(cfg.apiKey).toBe('env-key');
    expect(cfg.model).toBe('env-model');
    expect(cfg.posture).toBe('coding');
  });

  it('ignores an invalid VENICE_POSTURE env value', () => {
    const cfg = mergeConfig({ posture: 'raw' }, {}, { VENICE_POSTURE: 'nonsense' } as any);
    expect(cfg.posture).toBe('raw');
  });

  it('deep-merges pricing rather than replacing it wholesale', () => {
    const cfg = mergeConfig({}, { pricing: { in: 2 } }, {});
    expect(cfg.pricing).toEqual({ in: 2, out: 0 });
  });

  it('falls back to file apiKey when env is unset', () => {
    const cfg = mergeConfig({}, { apiKey: 'file-key' }, {});
    expect(cfg.apiKey).toBe('file-key');
  });

  it('defaults baseUrl to Venice', () => {
    const cfg = mergeConfig({}, {}, {});
    expect(cfg.baseUrl).toBe('https://api.venice.ai/api/v1');
  });

  it('resolves baseUrl with env > cwd > home > default precedence', () => {
    expect(mergeConfig({ baseUrl: 'home-url' }, {}, {}).baseUrl).toBe('home-url');
    expect(mergeConfig({ baseUrl: 'home-url' }, { baseUrl: 'cwd-url' }, {}).baseUrl).toBe('cwd-url');
    expect(
      mergeConfig(
        { baseUrl: 'home-url' },
        { baseUrl: 'cwd-url' },
        { VENICE_BASE_URL: 'http://localhost:11434/v1' }
      ).baseUrl
    ).toBe('http://localhost:11434/v1');
  });
});

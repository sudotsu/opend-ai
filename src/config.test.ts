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

describe('mergeConfig temperature validation', () => {
  it('is undefined by default (omitted from requests)', () => {
    expect(mergeConfig({}, {}, {}).temperature).toBeUndefined();
  });

  it('keeps a finite numeric temperature from file config', () => {
    expect(mergeConfig({ temperature: 0.7 }, {}, {}).temperature).toBe(0.7);
    expect(mergeConfig({ temperature: 0 }, {}, {}).temperature).toBe(0);
  });

  it('treats a null temperature as unset', () => {
    expect(mergeConfig({ temperature: null } as any, {}, {}).temperature).toBeUndefined();
  });

  it('rejects a string temperature', () => {
    expect(mergeConfig({ temperature: '0.7' } as any, {}, {}).temperature).toBeUndefined();
  });

  it('rejects a non-finite temperature', () => {
    expect(mergeConfig({ temperature: Infinity } as any, {}, {}).temperature).toBeUndefined();
    expect(mergeConfig({ temperature: NaN } as any, {}, {}).temperature).toBeUndefined();
  });

  it('lets a valid env override replace the file value', () => {
    const cfg = mergeConfig({ temperature: 0.2 }, {}, { VENICE_TEMPERATURE: '0.9' });
    expect(cfg.temperature).toBe(0.9);
  });

  it('ignores a non-numeric env override, keeping the valid file value', () => {
    const cfg = mergeConfig({ temperature: 0.2 }, {}, { VENICE_TEMPERATURE: 'hot' });
    expect(cfg.temperature).toBe(0.2);
  });

  it('env override rescues an invalid file temperature', () => {
    const cfg = mergeConfig({ temperature: null } as any, {}, { VENICE_TEMPERATURE: '0.5' });
    expect(cfg.temperature).toBe(0.5);
  });
});

describe('mergeConfig numeric limit validation', () => {
  it('uses defaults when limits are unset', () => {
    const cfg = mergeConfig({}, {}, {});
    expect(cfg.maxIterations).toBe(50);
    expect(cfg.commandTimeoutMs).toBe(30000);
  });

  it('keeps a valid maxIterations and commandTimeoutMs', () => {
    const cfg = mergeConfig({ maxIterations: 10, commandTimeoutMs: 5000 }, {}, {});
    expect(cfg.maxIterations).toBe(10);
    expect(cfg.commandTimeoutMs).toBe(5000);
  });

  it('rejects maxIterations of 0, keeping the default', () => {
    expect(mergeConfig({ maxIterations: 0 }, {}, {}).maxIterations).toBe(50);
  });

  it('rejects a negative maxIterations', () => {
    expect(mergeConfig({ maxIterations: -5 }, {}, {}).maxIterations).toBe(50);
  });

  it('rejects a null maxIterations', () => {
    expect(mergeConfig({ maxIterations: null } as any, {}, {}).maxIterations).toBe(50);
  });

  it('rejects a string maxIterations', () => {
    expect(mergeConfig({ maxIterations: '10' } as any, {}, {}).maxIterations).toBe(50);
  });

  it('rejects a non-integer maxIterations', () => {
    expect(mergeConfig({ maxIterations: 3.5 }, {}, {}).maxIterations).toBe(50);
  });

  it('rejects commandTimeoutMs of 0 (would remove the hard timeout)', () => {
    expect(mergeConfig({ commandTimeoutMs: 0 }, {}, {}).commandTimeoutMs).toBe(30000);
  });

  it('rejects a negative commandTimeoutMs', () => {
    expect(mergeConfig({ commandTimeoutMs: -1000 }, {}, {}).commandTimeoutMs).toBe(30000);
  });

  it('rejects a commandTimeoutMs below the 1000ms safe minimum', () => {
    expect(mergeConfig({ commandTimeoutMs: 500 }, {}, {}).commandTimeoutMs).toBe(30000);
  });

  it('rejects a null / string commandTimeoutMs', () => {
    expect(mergeConfig({ commandTimeoutMs: null } as any, {}, {}).commandTimeoutMs).toBe(30000);
    expect(mergeConfig({ commandTimeoutMs: '5000' } as any, {}, {}).commandTimeoutMs).toBe(30000);
  });

  it('cwd config still overrides home for a valid limit', () => {
    const cfg = mergeConfig({ maxIterations: 10 }, { maxIterations: 20 }, {});
    expect(cfg.maxIterations).toBe(20);
  });
});

import { describe, it, expect } from 'vitest';
import { splitThink, type ThinkState } from './think.js';

function freshState(): ThinkState {
  return { inThink: false, pending: '' };
}

// Feeds a string through splitThink one character at a time to simulate the
// worst-case streaming scenario: a <think> tag split across many tiny chunks.
function streamChar(text: string, state: ThinkState) {
  let visible = '';
  let thinking = '';
  for (const ch of text) {
    const r = splitThink(ch, state);
    visible += r.visible;
    thinking += r.thinking;
  }
  return { visible, thinking };
}

describe('splitThink', () => {
  it('passes plain text through untouched when there is no think tag', () => {
    const state = freshState();
    const { visible, thinking } = splitThink('just a normal sentence.', state);
    expect(visible).toBe('just a normal sentence.');
    expect(thinking).toBe('');
  });

  it('extracts a complete inline <think> block delivered in one chunk', () => {
    const state = freshState();
    const { visible, thinking } = splitThink('before<think>reasoning here</think>after', state);
    expect(visible).toBe('beforeafter');
    expect(thinking).toBe('reasoning here');
  });

  it('handles a <think> tag split across many one-character chunks', () => {
    const { visible, thinking } = streamChar('before<think>reasoning here</think>after', freshState());
    expect(visible).toBe('beforeafter');
    expect(thinking).toBe('reasoning here');
  });

  it('holds back a partial opening tag until it resolves or is confirmed not a tag', () => {
    const state = freshState();
    const r1 = splitThink('hello <thi', state);
    // "<thi" could be the start of "<think>" — must not be emitted as visible yet.
    expect(r1.visible).toBe('hello ');
    expect(state.pending).toBe('<thi');

    const r2 = splitThink('nk>reasoning</think>after', state);
    expect(r2.thinking).toBe('reasoning');
    // "after" trails the closing tag within this same chunk, so it's plain
    // visible text immediately — nothing left to hold back.
    expect(r2.visible).toBe('after');
  });

  it('emits held-back text as visible once it turns out not to be a tag', () => {
    const state = freshState();
    const r1 = splitThink('a <thi', state);
    expect(r1.visible).toBe('a ');
    const r2 = splitThink('ng is broken', state);
    expect(r2.visible).toBe('<thing is broken');
    expect(state.pending).toBe('');
  });

  it('carries inThink state across multiple chunks with no tags in between', () => {
    const state = freshState();
    splitThink('<think>part one ', state);
    const r2 = splitThink('part two ', state);
    const r3 = splitThink('part three</think>done', state);
    expect(r2.thinking).toBe('part two ');
    expect(r3.thinking).toBe('part three');
    expect(r3.visible).toBe('done');
  });

  it('supports multiple separate think blocks in one stream', () => {
    const { visible, thinking } = streamChar(
      'a<think>one</think>b<think>two</think>c',
      freshState()
    );
    expect(visible).toBe('abc');
    expect(thinking).toBe('onetwo');
  });
});

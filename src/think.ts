// Pure helpers for splitting inline <think>...</think> reasoning out of a
// streamed content fragment. This is the fallback path for models that inline
// reasoning in `content` rather than emitting a separate `reasoning_content`
// field. Kept separate from the agent so the chunk-boundary logic is
// unit-testable without spinning up a network client.

export const THINK_OPEN = '<think>';
export const THINK_CLOSE = '</think>';

// Length of the longest suffix of `buf` that is a prefix of `tag`. Used to hold
// back a few trailing chars that might be the start of a tag split across chunks.
export function partialTagSuffix(buf: string, tag: string): number {
  const max = Math.min(buf.length, tag.length - 1);
  for (let n = max; n > 0; n--) {
    if (buf.slice(buf.length - n) === tag.slice(0, n)) return n;
  }
  return 0;
}

export interface ThinkState {
  inThink: boolean;
  pending: string;
}

// Splits a streamed content fragment into visible text and inline <think> text,
// carrying tag state (open/closed + a partial-tag buffer) across chunk boundaries.
export function splitThink(
  fragment: string,
  state: ThinkState
): { visible: string; thinking: string } {
  let buf = state.pending + fragment;
  state.pending = '';
  let visible = '';
  let thinking = '';

  while (buf.length > 0) {
    if (!state.inThink) {
      const openIdx = buf.indexOf(THINK_OPEN);
      if (openIdx === -1) {
        const hold = partialTagSuffix(buf, THINK_OPEN);
        visible += buf.slice(0, buf.length - hold);
        state.pending = buf.slice(buf.length - hold);
        break;
      }
      visible += buf.slice(0, openIdx);
      buf = buf.slice(openIdx + THINK_OPEN.length);
      state.inThink = true;
    } else {
      const closeIdx = buf.indexOf(THINK_CLOSE);
      if (closeIdx === -1) {
        const hold = partialTagSuffix(buf, THINK_CLOSE);
        thinking += buf.slice(0, buf.length - hold);
        state.pending = buf.slice(buf.length - hold);
        break;
      }
      thinking += buf.slice(0, closeIdx);
      buf = buf.slice(closeIdx + THINK_CLOSE.length);
      state.inThink = false;
    }
  }

  return { visible, thinking };
}

export const enableFatCursor = () => {
  const callback = () => {
    const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

    if (cursor && !cursor.classList.contains('cm-fat-cursor')) {
      cursor.classList.add('cm-fat-cursor');
    }
  };

  window.setTimeout(callback, 0);
};

export const disableFatCursor = () => {
  const callback = () => {
    const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

    if (cursor && cursor.classList.contains('cm-fat-cursor')) {
      cursor.classList.remove('cm-fat-cursor');
    }
  };
  window.setTimeout(callback, 0);
};

export const offsetCursor = (cur, chs = 0, lines = 0) => {
  return { ch: cur.ch + chs, line: cur.line + lines };
};

export const isBefore = (cursorTarget, cursorRef) => {
  if (cursorTarget.line < cursorRef.line) {
    return true;
  } else if (cursorTarget.line > cursorRef.line) {
    return false;
  } else {
    return cursorTarget.ch < cursorRef.ch;
  }
};

export const isOneCharBefore = (cursorTarget, cursorRef) => {
  return cursorRef.line === cursorTarget.line && cursorRef.ch - cursorTarget.ch === 1;
};

export const headPassedAnchor = (anchor, oldHead, newHead, forward) => {
  return forward
    ? isBefore(oldHead, anchor) && isBefore(anchor, newHead)
    : isBefore(newHead, anchor) && isBefore(anchor, oldHead);
};

export const isCursorEqual = (cur1, cur2) => {
  return cur1.line === cur2.line && cur1.ch === cur2.ch;
};

export const adjustSelection = (oldAnchor, oldHead, newHead) => {
  const movedForward = isBefore(oldHead, newHead);
  const wasOverlapped = isCursorEqual(oldHead, oldAnchor);

  if (!wasOverlapped && isOneCharBefore(newHead, oldAnchor)) {
    return {
      anchor: newHead,
      head: newHead,
    };
  }

  if (!movedForward && wasOverlapped) {
    return {
      anchor: { line: oldAnchor.line, ch: oldAnchor.ch + 1 },
      head: newHead,
    };
  }

  const anchorChOffset = movedForward ? -1 : 1;
  if (headPassedAnchor(oldAnchor, oldHead, newHead, movedForward)) {
    return {
      anchor: { line: oldAnchor.line, ch: oldAnchor.ch + anchorChOffset },
      head: {
        line: newHead.line,
        ch: newHead.ch,
      },
    };
  }

  return { anchor: oldAnchor, head: newHead };
};

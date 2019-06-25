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

export const isBeforeOrSame = (cursorTarget, cursorRef) => {
  if (cursorTarget.line < cursorRef.line) {
    return true;
  } else if (cursorTarget.line > cursorRef.line) {
    return false;
  } else {
    return cursorTarget.ch <= cursorRef.ch;
  }
};

export const headPassedAnchor = (anchor, oldHead, newHead, forward) => {
  return forward
    ? isBeforeOrSame(oldHead, anchor) && isBeforeOrSame(anchor, newHead)
    : isBeforeOrSame(newHead, anchor) && isBeforeOrSame(anchor, oldHead);
};

export const adjustSelection = (oldAnchor, oldHead, newHead) => {
  const movedForward = isBeforeOrSame(oldHead, newHead);
  const anchorChOffset = movedForward ? -1 : 1;
  if (headPassedAnchor(oldAnchor, oldHead, newHead, movedForward)) {
    return {
      anchor: { line: oldAnchor.line, ch: oldAnchor.ch + anchorChOffset },
      head: { line: newHead.line, ch: newHead.ch - anchorChOffset },
    };
  }

  return { anchor: oldAnchor, head: newHead };
};

export const enableFatCursor = () => {
  const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

  if (!cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.add('cm-fat-cursor');
  }
};

export const disableFatCursor = () => {
  const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

  if (cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.remove('cm-fat-cursor');
  }
};

const clip = (x, lower, upper) => {
  return Math.min(upper, Math.max(lower, x));
};

export const offsetCursor = (cur, chs = 0, lines = 0) => {
  return { ch: cur.ch + chs, line: cur.line + lines };
};

export const removeRange = (cm, range) => {
  cm.replaceRange('', range.from, range.to);
};

export const getLine = cm => {
  return cm.getLine(cm.getCursor().line);
};

export const getLineOffset = (cm, offset = 0) => {
  const { line } = cm.getCursor();
  return cm.getLine(line + offset);
};

export const getLineLength = (cm, line) => {
  return cm.getLine(line).length;
};

export const getIndent = cm => {
  const line = getLine(cm);
  return line.match(/^\s*/)[0];
};

export const isFirstLine = cm => {
  return cm.getCursor().line === cm.firstLine();
};

export const isLastLine = cm => {
  return cm.getCursor().line === cm.lastLine();
};

export const isStartOfLine = cm => {
  return cm.getCursor().ch === 0;
};

export const isEndOfLine = cm => {
  const { line, ch } = cm.getCursor();
  return cm.getLine(line).length === ch;
};

export const getIndentLength = cm => {
  const line = getLine(cm);
  return line.match(/^\s*/)[0].length;
};

export const isEmptyLine = (cm, line) => {
  return !/\S/.test(cm.getLine(line));
};

export const moveCursor = (cm, chs = 0, lines = 0) => {
  // Move the cursor from the current position
  const cur = cm.getCursor();
  const newCur = offsetCursor(cur, chs, lines);
  cm.setCursor(newCur);
};

export const moveToStartOfLine = cm => {
  const { line } = cm.getCursor();
  cm.setCursor({ line, ch: 0 });
};

export const moveToFirstNonBlank = cm => {
  const { line } = cm.getCursor();
  const ch = findFirstNonBlank(cm, line);
  cm.setCursor({ line, ch });
};

export const moveToEndOfLine = cm => {
  const { line } = cm.getCursor();
  const ch = getLineLength(cm, line);
  cm.setCursor({ line, ch });
};

export const findFirstNonBlank = (cm, line) => {
  const match = /\S/.exec(cm.getLine(line));
  return match ? match.index : 0;
};

export const findParagraph = (cm, forward) => {
  const dir = forward ? 1 : -1;
  const { line } = cm.getCursor();

  const boundary = forward ? cm.lastLine() : cm.firstLine();

  let i = line;
  while (isEmptyLine(cm, i) && i != boundary) {
    i += dir;
  }

  while (!isEmptyLine(cm, i) && i != boundary) {
    i += dir;
  }
  return i;
};

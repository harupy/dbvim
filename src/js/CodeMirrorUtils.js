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

export const offsetCursor = (cur, chs = 0, lines = 0) => {
  return { ch: cur.ch + chs, line: cur.line + lines };
};

export const removeRange = (cm, range) => {
  cm.replaceRange('', range.from, range.to);
};

export const getLine = cm => {
  return cm.getLine(cm.getCursor().line);
};

export const getLineLength = cm => {
  return cm.getLine(cm.getCursor().line).length;
};

export const getIndent = cm => {
  const line = getLine(cm);
  return line.match(/^\s*/)[0];
};

export const getIndentLength = cm => {
  const line = getLine(cm);
  return line.match(/^\s*/)[0].length;
};

export const isEndOfLine = cm => {
  const { line, ch } = cm.getCursor();
  return cm.getLine(line).length === ch;
};

export const isEmptyLine = cm => {
  return getIndentLength(cm) === getLineLength(cm);
};

export const moveCursor = (cm, chs = 0, lines = 0) => {
  // Move the cursor from the current positin
  const cur = cm.getCursor();
  const newCur = offsetCursor(cur, chs, lines);
  cm.setCursor(newCur);
};

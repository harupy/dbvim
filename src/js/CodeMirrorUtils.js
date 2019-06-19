export const enableFatCursor = () => {
  const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

  if (cursor && !cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.add('cm-fat-cursor');
  }
};

export const disableFatCursor = () => {
  const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

  if (cursor && cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.remove('cm-fat-cursor');
  }
};

const clip = (x, lower, upper) => {
  return Math.min(upper, Math.max(lower, x));
};

export const clipLine = (cm, line) => {
  return clip(line, cm.firstLine(), cm.lastLine());
};

export const offsetCursor = (cur, chs = 0, lines = 0) => {
  return { ch: cur.ch + chs, line: cur.line + lines };
};

export const getCursorChar = cm => {
  // Return the character the cursor is on
  const cur = cm.getCursor();
  return cm.getLine(cur.line).charAt(cur.ch);
};

export const getLineBegin = cm => {
  const { line } = cm.getCursor();
  return { line, ch: 0 };
};

export const getLineEnd = cm => {
  const { line } = cm.getCursor();
  return { line, ch: cm.getLine(line).length };
};

export const removeRange = (cm, range) => {
  cm.replaceRange('', range.from, range.to);
};

export const getLine = cm => {
  return cm.getLine(cm.getCursor().line);
};

export const getCharOffset = (cm, offset = 0) => {
  const cur = cm.getCursor();
  const lineLength = cm.getLine(line).length
  const ch = clip(ch + offset, 0, lineLength);
  return cm.getLine(line).charAt(ch + offset);

  return cm.getLine(line + offset);
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

export const isDocumentBegin = cm => {
  const { line, cur } = cm.getCursor();
  return line === 0 && cur === 0;
};

export const isDocumentBegin = cm => {
  const lastLine = cm.lastLine();
  const lastLineLength = cm.getLine(lastLine).length;
  const { line, cur } = cm.getCursor()
  return line === lastLine && cur === lastLineLength;
};

export const isFirstLine = cm => {
  return cm.getCursor().line === cm.firstLine();
};

export const isLastLine = cm => {
  return cm.getCursor().line === cm.lastLine();
};

export const isLineBegin = cm => {
  return cm.getCursor().ch === 0;
};

export const isLineEnd = cm => {
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

export const getDocumentEnd = cm => {
  const lastLine = cm.lastLine();
  const lastLineLength = cm.getLine(lastLine);
  return { line: lastLine, ch: lastLineLength };
};

export const getDocumentStart = () => ({ line: 0, ch: 0 });

const getPositions = (line, regex) => {
  const positions = [];
  let match;
  while ((match = regex.exec(line))) {
    positions.push(match.index);
  }
  return positions;
};

export const findWordRight = cm => {
  const cur = cm.getCursor();

  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let line = cur.line;

  while (line <= cm.lastLine()) {
    const lineStr = cm.getLine(line);
    const positions = getPositions(lineStr, regexp);
    const wordStart = positions.filter(idx => idx > cur.ch || line !== cur.line)[0];

    if (wordStart !== undefined) {
      return { line, ch: wordStart };
    }

    line++;
  }

  return getDocumentEnd(cm);
};

export const findWordStart = (cm, forward) => {
  const dir = forward ? 1 : -1;
  const cur = cm.getCursor();

  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let line = cur.line;

  while (line <= cm.lastLine() && line >= cm.firstLine()) {
    const lineStr = cm.getLine(line);
    const positions = getPositions(lineStr, regexp);
    const posCandidates = positions.filter(
      idx => (forward ? idx > cur.ch : idx < cur.ch) || line !== cur.line,
    );

    if (posCandidates.length === 0) {
      line += dir;
      continue;
    }

    const wordStart = forward ? Math.min(...posCandidates) : Math.max(...posCandidates);

    if (wordStart !== undefined) {
      return { line, ch: wordStart };
    }

    line += dir;
  }

  return forward ? getDocumentEnd(cm) : getDocumentStart();
};

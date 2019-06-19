const clip = function(x, lower, upper) {
  return Math.min(upper, Math.max(lower, x));
};

const clipLine = function(line) {
  return clip(line, this.firstLine(), this.lastLine());
};

const offsetCursor = function(cur, chs = 0, lines = 0) {
  return { ch: cur.ch + chs, line: cur.line + lines };
};

const getCursorChar = function() {
  // Return the character the cursor is on
  const cur = this.getCursor();
  return this.getLineAt(cur.line).charAt(cur.ch);
};

const getCh = function() {
  return this.getCursor().ch;
};

const _getLine = function() {
  const { line } = this.getCursor();
  return line;
};

const getLineAt = function(line) {
  return this.getLine(line);
};

const getLineLength = function() {
  return this.getLineAt(this._getLine()).length;
};

const getLineLengthAt = function(line) {
  return this.getLineAt(line).length;
};

const getCharOffset = function(offset = 0) {
  const { ch, line } = this.getCursor();
  return this.getLineAt(line).charAt(ch + offset);
};

const getLineOffset = function(offset = 0) {
  const { line } = this.getCursor();
  return this.getLineAt(line + offset);
};

const getRight = function() {
  const { line, ch } = this.getCursor();

  if (this.isLineEnd()) {
    if (this.isLastLine()) {
      return this.getDocumentEnd();
    } else {
      return { line: line + 1, ch: 0 };
    }
  }

  return { line, ch: ch + 1 };
};

const getLeft = function() {
  const { line, ch } = this.getCursor();

  if (this.isLineBegin()) {
    if (this.isFirstLine()) {
      return this.getDocumentBegin();
    } else {
      const lineLength = this.getLineLengthAt(line - 1);
      return { line: line - 1, ch: Math.max(0, lineLength - 1) };
    }
  }

  return { line, ch: ch - 1 };
};

const getLineBelow = function() {
  const { line, ch } = this.getCursor();
  const lastLine = this.lastLine();
  const newLine = line + 1;
  const newCh =
    newLine > lastLine
      ? this.getLineLengthAt(lastLine)
      : Math.min(ch, this.getLineLengthAt(newLine));
  return { line: Math.min(lastLine, newLine), ch: newCh };
};

const getLineAbove = function() {
  const { line, ch } = this.getCursor();
  const firstLine = this.firstLine();
  const newLine = line - 1;
  const newCh = newLine < firstLine ? 0 : Math.min(ch, this.getLineLengthAt(newLine));
  return { line: Math.max(0, newLine), ch: newCh };
};

const getLineBegin = function() {
  return { line: this._getLine(), ch: 0 };
};

const getLineEnd = function() {
  const line = this._getLine();
  return { line, ch: this.getLineAt(line).length - 1 };
};

const getDocumentEnd = function() {
  const lastLine = this.lastLine();
  const lastLineLength = this.getLineLengthAt(lastLine);
  return { line: lastLine, ch: Math.max(lastLineLength - 1) };
};

const getDocumentBegin = function() {
  return { line: 0, ch: 0 };
};

const getIndentAt = function(line) {
  return this.getLineAt(line).match(/^\s*/)[0];
};

const getIndent = function() {
  return this.getLineAt(this._getLine()).match(/^\s*/)[0];
};

const getIndentLength = function() {
  return this.getIndent().match(/^\s*/)[0].length;
};

const getIndentLengthAt = function(line) {
  return this.getIndentAt(line).match(/^\s*/)[0].length;
};

const expandToLine = function() {
  const line = this._getLine();
  const head = { line, ch: 0 };
  const anchor = { line: line + 1, ch: 0 };
  return { head, anchor };
};

const isFirstLine = function() {
  return this.getCursor().line === this.firstLine();
};

const isLastLine = function() {
  return this._getLine() === this.lastLine();
};

const isLineBegin = function() {
  return this.getCh() === 0;
};

const isLineEnd = function() {
  return this.getLineLength() === this.getCh();
};

const isDocumentBegin = function() {
  return this.isFirstLine() && this.isLineBegin();
};

const isDocumentEnd = function() {
  return this.isLastLine() && this.isLineEnd();
};

const isEmptyLine = function(line) {
  return !/\S/.test(this.getLineAt(line));
};

const findFirstNonBlankAt = function(line) {
  const match = /\S/.exec(this.getLineAt(line));
  return { line, ch: match ? match.index : 0 };
};

const findFirstNonBlank = function() {
  return this.findFirstNonBlankAt(this._getLine());
};

const findParagraphBelow = function() {
  const line = this._getLine();
  let l = line;
  while (this.isEmptyLine(l) && l <= this.lastLine()) {
    l++;
  }

  while (!this.isEmptyLine(l) && l <= this.lastLine()) {
    l++;
  }

  return { line: l, ch: 0 };
};

const findParagraphAbove = function() {
  const line = this._getLine();
  let l = line;
  while (this.isEmptyLine(l) && l >= this.firstLine()) {
    l--;
  }

  while (!this.isEmptyLine(l) && l >= this.firstLine()) {
    l--;
  }

  return { line: l, ch: 0 };
};

const getBeginPositions = function(line, regex) {
  const positions = [];
  let match;
  while ((match = regex.exec(line))) {
    positions.push(match.index);
  }
  return positions;
};

const getEndPositions = function(line, regex) {
  const positions = [];
  let match;
  while ((match = regex.exec(line))) {
    positions.push(match.index + match[0].length - 1);
  }
  return positions;
};

const findWordBeginRight = function() {
  const { line, ch } = this.getCursor();

  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let l = line;

  while (l <= this.lastLine()) {
    const lineStr = this.getLineAt(l);
    const positions = getBeginPositions(lineStr, regexp);
    const wordBegin = positions.filter(idx => idx > ch || l !== line)[0];

    if (wordBegin !== undefined) {
      return { line: l, ch: wordBegin };
    }

    l++;
  }

  return this.getDocumentEnd();
};

const findWordBeginLeft = function() {
  const { line, ch } = this.getCursor();

  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let l = line;

  while (l >= this.firstLine()) {
    const lineStr = this.getLineAt(l);
    const positions = getBeginPositions(lineStr, regexp);
    const wordBegin = positions.filter(idx => idx < ch || l !== line).reverse()[0];

    if (wordBegin !== undefined) {
      return { line: l, ch: wordBegin };
    }

    l--;
  }

  return this.getDocumentBegin();
};

const findWordEndRight = function() {
  const { line, ch } = this.getCursor();
  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let l = line;

  while (l <= this.lastLine()) {
    const lineStr = this.getLineAt(l);
    const positions = getEndPositions(lineStr, regexp);
    const wordEnd = positions.filter(idx => idx > ch || l !== line)[0];

    if (wordEnd !== undefined) {
      return { line: l, ch: wordEnd };
    }

    l++;
  }

  return this.getDocumentEnd();
};

const findWordEndLeft = function() {
  const { line, ch } = this.getCursor();
  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let l = line;

  while (l >= this.firstLine()) {
    const lineStr = this.getLineAt(l);
    const positions = getEndPositions(lineStr, regexp);
    const wordEnd = positions.filter(idx => idx < ch || l !== line).reverse()[0];

    if (wordEnd !== undefined) {
      return { line: l, ch: wordEnd };
    }

    l--;
  }

  return this.getDocumentBegin();
};

const findWordStart = function(forward) {
  const dir = forward ? 1 : -1;
  const cur = this.getCursor();

  const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
  const nonWhiteSpaceRegex = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

  let line = cur.line;

  while (line <= this.lastLine() && line >= this.firstLine()) {
    const lineStr = this.getLineAt(line);
    const positions = getBeginPositions(lineStr, nonWhiteSpaceRegex);
    const posCandidates = positions.filter(
      idx => (forward ? idx > cur.ch : idx < cur.ch) || line !== cur.line,
    );

    if (posCandidates.length === 0) {
      line += dir;
      continue;
    }

    const wordBegin = forward ? Math.min(...posCandidates) : Math.max(...posCandidates);

    if (wordBegin !== undefined) {
      return { line, ch: wordBegin };
    }

    line += dir;
  }

  return forward ? this.getDocumentEnd() : this.getDocumentBegin();
};

const funcs = {
  offsetCursor,
  getCh,
  _getLine,
  getLineAt,
  getRight,
  getLeft,
  getLineLength,
  getLineLengthAt,
  getLineBegin,
  getLineEnd,
  getLineAbove,
  getLineBelow,
  expandToLine,
  getDocumentBegin,
  getDocumentEnd,
  getIndent,
  getIndentAt,
  getIndentLength,
  getIndentLengthAt,
  isLineBegin,
  isLineEnd,
  isFirstLine,
  isLastLine,
  isEmptyLine,
  isDocumentBegin,
  isDocumentEnd,
  findFirstNonBlank,
  findFirstNonBlankAt,
  findWordStart,
  findWordBeginRight,
  findWordEndRight,
  findWordBeginLeft,
  findWordEndLeft,
  findParagraphBelow,
  findParagraphAbove,
};

export default cm => {
  Object.entries(funcs).forEach(([k, v]) => {
    if (cm[k]) {
      alert(`${k} is already defined!`);
    } else {
      cm[k] = v;
    }
  });
};

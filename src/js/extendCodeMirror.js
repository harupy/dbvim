const clip = function(x, lower, upper) {
  return Math.min(upper, Math.max(lower, x));
};

const clipLine = function(line) {
  return clip(line, this.firstLine(), this.lastLine());
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

const funcs = {
  offsetCursor: function(cur, chs = 0, lines = 0) {
    return { ch: cur.ch + chs, line: cur.line + lines };
  },

  getCursorChar: function() {
    // Return the character the cursor is on
    const cur = this.getCursor();
    return this.getLineAt(cur.line).charAt(cur.ch);
  },

  getCh: function() {
    return this.getCursor().ch;
  },

  _getLine: function() {
    const { line } = this.getCursor();
    return line;
  },

  getLineAt: function(line) {
    return this.getLine(line);
  },

  getLineLength: function() {
    return this.getLineAt(this._getLine()).length;
  },

  getLineLengthAt: function(line) {
    return this.getLineAt(line).length;
  },

  getLastCh: function() {
    return this.getLineLength() - 1;
  },

  getLastChAt: function(line) {
    return this.getLineLengthAt(line) - 1;
  },

  getCharOffset: function(offset = 0) {
    const { ch, line } = this.getCursor();
    return this.getLineAt(line).charAt(ch + offset);
  },

  getLineOffset: function(offset = 0) {
    const { line } = this.getCursor();
    return this.getLineAt(line + offset);
  },

  getRight: function(beyondLineEnd = false) {
    const { line, ch } = this.getCursor();
    if (this.isEmpty()) {
      return { line, ch };
    }

    if (this.isLineEnd()) {
      const lastCh = this.getLastCh();
      if (this.isLastLine()) {
        return beyondLineEnd ? { line, ch: lastCh + 1 } : { line, ch: lastCh };
      } else {
        return beyondLineEnd ? { line, ch: lastCh + 1 } : { line: line + 1, ch: 0 };
      }
    }
    return { line, ch: ch + 1 };
  },

  getLeft: function() {
    const { line, ch } = this.getCursor();

    if (this.isLineBegin()) {
      if (this.isFirstLine()) {
        return this.getDocumentBegin();
      } else {
        const lastChAbove = this.getLastChAt(line - 1);
        return { line: line - 1, ch: lastChAbove };
      }
    }

    return { line, ch: ch - 1 };
  },

  getLineBelow: function() {
    const { line, ch } = this.getCursor();
    const lastLine = this.lastLine();
    const newLine = line + 1;
    const newCh =
      newLine > lastLine
        ? this.getLineLengthAt(lastLine) - 1
        : Math.min(ch, this.getLineLengthAt(newLine) - 1);
    return { line: Math.min(lastLine, newLine), ch: newCh };
  },

  getLineAbove: function() {
    const { line, ch } = this.getCursor();
    const firstLine = this.firstLine();
    const newLine = line - 1;
    const newCh = newLine < firstLine ? 0 : Math.min(ch, this.getLineLengthAt(newLine) - 1);
    return { line: Math.max(0, newLine), ch: newCh };
  },

  getLineBegin: function() {
    return { line: this._getLine(), ch: 0 };
  },

  getLineEnd: function() {
    const line = this._getLine();
    return { line, ch: this.getLastChAt(line) };
  },

  getDocumentEnd: function() {
    const lastLine = this.lastLine();
    const lastLineCh = this.getLastChAt(lastLine);
    return { line: lastLine, ch: lastLineCh };
  },

  getDocumentBegin: function() {
    return { line: 0, ch: 0 };
  },

  getIndentAt: function(line) {
    return this.getLineAt(line).match(/^\s*/)[0];
  },

  getIndent: function() {
    return this.getLineAt(this._getLine()).match(/^\s*/)[0];
  },

  getIndentLength: function() {
    return this.getIndent().match(/^\s*/)[0].length;
  },

  getIndentLengthAt: function(line) {
    return this.getIndentAt(line).match(/^\s*/)[0].length;
  },

  expandToLine: function() {
    const line = this._getLine();
    const lineLength = this.getLineLength();

    if (this.isSingleLine()) {
      const head = { line: 0, ch: 0 };
      const anchor = { line, ch: this.getLineLength() };
      return { head, anchor };
    }

    if (this.isLastLine()) {
      const lineLengthAbove = this.getLineLengthAt(line - 1);
      const head = { line: line - 1, ch: lineLengthAbove };
      const anchor = { line, ch: lineLength };
      return { head, anchor };
    }
    const head = { line, ch: 0 };
    const anchor = { line: line + 1, ch: 0 };
    return { head, anchor };
  },

  isFirstLine: function() {
    return this.getCursor().line === this.firstLine();
  },

  isLastLine: function() {
    return this._getLine() === this.lastLine();
  },

  isLineBegin: function() {
    return this.getCh() === 0;
  },

  isLineEnd: function() {
    return this.getLastCh() === this.getCh();
  },

  isDocumentBegin: function() {
    return this.isFirstLine() && this.isLineBegin();
  },

  isDocumentEnd: function() {
    return this.isLastLine() && this.isLineEnd();
  },

  isEmpty: function() {
    return this.getLineLength() === 0;
  },

  isEmptyLine: function(line) {
    return !/\S/.test(this.getLineAt(line));
  },

  isSingleLine: function() {
    return this.lastLine() === 0;
  },

  findFirstNonBlankAt: function(line) {
    const match = /\S/.exec(this.getLineAt(line));
    return { line, ch: match ? match.index : 0 };
  },

  findFirstNonBlank: function() {
    return this.findFirstNonBlankAt(this._getLine());
  },

  findParagraphBelow: function() {
    const line = this._getLine();
    let l = line;
    while (this.isEmptyLine(l) && l <= this.lastLine()) {
      l++;
    }

    while (!this.isEmptyLine(l) && l <= this.lastLine()) {
      l++;
    }

    if (l > this.lastLine()) {
      return this.getDocumentEnd();
    }
    return { line: l, ch: 0 };
  },

  findParagraphAbove: function() {
    const line = this._getLine();
    let l = line;
    while (this.isEmptyLine(l) && l > this.firstLine()) {
      l--;
    }

    while (!this.isEmptyLine(l) && l > this.firstLine()) {
      l--;
    }

    return { line: l, ch: 0 };
  },

  findWordBeginRight: function() {
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
  },

  findWordBeginLeft: function() {
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
  },

  findWordEndRight: function() {
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
  },

  findWordEndLeft: function() {
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
  },

  findWordStart: function(forward) {
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
  },
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

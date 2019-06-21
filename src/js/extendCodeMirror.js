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

  getCursorOffset: function(chs = 0, lines = 0) {
    return this.offsetCursor(this.getCursor(), chs, lines);
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
    return { line, ch: this.getLineAt(line).length - 1 };
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

  findWordBeginRight: function(inclusive = false) {
    const { line, ch } = this.getCursor();

    const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
    const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

    let l = line;

    while (l <= this.lastLine()) {
      const lineStr = this.getLineAt(l);
      const positions = getBeginPositions(lineStr, regexp);
      const wordBegin = positions.filter(
        idx => (inclusive ? idx >= ch : idx > ch) || l !== line,
      )[0];

      if (wordBegin !== undefined) {
        return { line: l, ch: wordBegin };
      }

      l++;
    }

    return this.getDocumentEnd();
  },

  findWordBeginLeft: function(inclusive = false, throughLines = true) {
    const { line, ch } = this.getCursor();

    const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
    const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

    let l = line;

    while (l >= this.firstLine()) {
      const lineStr = this.getLineAt(l);
      const positions = getBeginPositions(lineStr, regexp);
      const wordBegin = positions
        .filter(idx => (inclusive ? idx <= ch : idx < ch) || l !== line)
        .reverse()[0];

      if (wordBegin !== undefined) {
        return { line: l, ch: wordBegin };
      }

      if (!throughLines) {
        return { line: l, ch: 0 };
      }

      l--;
    }

    return this.getDocumentBegin();
  },

  findWordEndRight: function(inclusive = false, throughLines = true) {
    const { line, ch } = this.getCursor();
    const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
    const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

    let l = line;

    while (l <= this.lastLine()) {
      const lineStr = this.getLineAt(l);
      const positions = getEndPositions(lineStr, regexp);
      const wordEnd = positions.filter(idx => (inclusive ? idx >= ch : idx > ch) || l !== line)[0];

      if (wordEnd !== undefined) {
        return { line: l, ch: wordEnd };
      }

      if (!throughLines) {
        return { line: l, ch: lineStr.length };
      }

      l++;
    }

    return this.getDocumentEnd();
  },

  findWordEndLeft: function(inclusive = false) {
    const { line, ch } = this.getCursor();
    const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
    const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

    let l = line;

    while (l >= this.firstLine()) {
      const lineStr = this.getLineAt(l);
      const positions = getEndPositions(lineStr, regexp);
      const wordEnd = positions
        .filter(idx => (inclusive ? idx <= ch : idx < ch) || l !== line)
        .reverse()[0];

      if (wordEnd !== undefined) {
        return { line: l, ch: wordEnd };
      }

      l--;
    }

    return this.getDocumentBegin();
  },

  findInnerWord: function(inclusive = true) {
    const wordStart = this.findWordBeginLeft(inclusive, false);
    const wordEnd = this.findWordEndRight(inclusive, false);

    return { head: wordStart, anchor: this.offsetCursor(wordEnd, 1) };
  },

  findMatchingPair: function(motionArgs) {
    const mirroredPairs = {
      '(': ')',
      ')': '(',
      '{': '}',
      '}': '{',
      '[': ']',
      ']': '[',
      '<': '>',
      '>': '<',
    };
    const selfPaired = { "'": true, '"': true, '`': true };

    let character = motionArgs.selectedCharacter;
    if (character == 'b') {
      character = '(';
    } else if (character == 'B') {
      character = '{';
    }

    const inclusive = !motionArgs.textObjectInner;

    if (mirroredPairs[character]) {
      return this.selectCompanionObject(character, inclusive);
    } else if (selfPaired[character]) {
      return this.findBeginningAndEnd(character, inclusive);
    } else if (character === 'w') {
      return this.findInnerWord(inclusive);
    }
  },

  selectCompanionObject: function(symb, inclusive) {
    const cur = this.getCursor();
    let start, end;

    const bracketRegexp = {
      '(': /[()]/,
      ')': /[()]/,
      '[': /[[\]]/,
      ']': /[[\]]/,
      '{': /[{}]/,
      '}': /[{}]/,
      '<': /[<>]/,
      '>': /[<>]/,
    }[symb];
    const openSym = {
      '(': '(',
      ')': '(',
      '[': '[',
      ']': '[',
      '{': '{',
      '}': '{',
      '<': '<',
      '>': '<',
    }[symb];
    const curChar = this.getLine(cur.line).charAt(cur.ch);
    const offset = curChar === openSym ? 1 : 0;

    start = this.scanForBracket({ line: cur.line, ch: cur.ch + offset }, -1, undefined, {
      bracketRegex: bracketRegexp,
    });
    end = this.scanForBracket({ line: cur.line, ch: cur.ch + offset }, 1, undefined, {
      bracketRegex: bracketRegexp,
    });

    if (!start || !end) {
      return { head: cur, anchor: cur };
    }

    start = start.pos;
    end = end.pos;

    if ((start.line == end.line && start.ch > end.ch) || start.line > end.line) {
      let tmp = start;
      start = end;
      end = tmp;
    }

    if (inclusive) {
      end.ch++;
    } else {
      start.ch++;
    }

    return { head: start, anchor: end };
  },

  findBeginningAndEnd: function(symb, inclusive) {
    let cur = this.getCursor();
    let line = this.getLine(cur.line);
    const chars = line.split('');
    const firstIndex = chars.indexOf(symb);

    let start, end, i, len;

    if (cur.ch < firstIndex) {
      cur.ch = firstIndex;
    }
    // otherwise if the cursor is currently on the closing symbol
    else if (firstIndex < cur.ch && chars[cur.ch] == symb) {
      end = cur.ch; // assign end to the current cursor
      --cur.ch; // make sure to look backwards
    }

    // if we're currently on the symbol, we've got a start
    if (chars[cur.ch] == symb && !end) {
      start = cur.ch + 1; // assign start to ahead of the cursor
    } else {
      // go backwards to find the start
      for (i = cur.ch; i > -1 && !start; i--) {
        if (chars[i] == symb) {
          start = i + 1;
        }
      }
    }

    // look forwards for the end symbol
    if (start && !end) {
      for (i = start, len = chars.length; i < len && !end; i++) {
        if (chars[i] == symb) {
          end = i;
        }
      }
    }

    // nothing found
    if (!start || !end) {
      return { head: cur, anchor: cur };
    }

    // include the symbols
    if (inclusive) {
      --start;
      ++end;
    }

    return {
      head: { line: cur.line, ch: start },
      anchor: { line: cur.line, ch: end },
    };
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

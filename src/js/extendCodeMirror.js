import * as cu from './cursorUtils';

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

const escapeRegExp = string => {
  const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  const reHasRegExpChar = RegExp(reRegExpChar.source);
  return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, '\\$&') : string;
};

const funcs = {
  getCursorOffset: function(chs = 0, lines = 0) {
    return cu.offsetCursor(this.getCursor(), chs, lines);
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

  getLastChar: function() {
    return this.getLineAt(this._getLine()).slice(-1)[0];
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

  getRight: function(beyond = false) {
    const { line, ch } = this.getCursor();
    if (this.isEmpty()) {
      return { line, ch };
    }

    if (this.isLineEnd(beyond)) {
      const lastCh = this.getLastCh();
      if (this.isLastLine()) {
        return beyond ? { line, ch: lastCh + 1 } : { line, ch: lastCh };
      } else {
        return { line: line + 1, ch: 0 };
      }
    }
    return { line, ch: ch + 1 };
  },

  getLeft: function(throughLines = true) {
    const { line, ch } = this.getCursor();

    if (this.isLineBegin()) {
      if (!throughLines) {
        return { line, ch };
      }

      if (this.isFirstLine()) {
        return this.getDocumentBegin();
      } else {
        const lastChAbove = this.getLastChAt(line - 1);
        return { line: line - 1, ch: lastChAbove };
      }
    }

    return { line, ch: ch - 1 };
  },

  getLineBelow: function(beyond) {
    const { line, ch } = this.getCursor();
    const lastLine = this.lastLine();
    const newLine = line + 1;
    const newCh =
      newLine > lastLine
        ? this.getLineLengthAt(lastLine) + (beyond ? 0 : -1)
        : Math.min(ch, this.getLineLengthAt(newLine) + (beyond ? 0 : -1));
    return { line: Math.min(lastLine, newLine), ch: newCh };
  },

  getLineAbove: function(beyond) {
    const { line, ch } = this.getCursor();
    const firstLine = this.firstLine();
    const newLine = line - 1;
    const newCh =
      newLine < firstLine ? 0 : Math.min(ch, this.getLineLengthAt(newLine) + (beyond ? 0 : -1));
    return { line: Math.max(0, newLine), ch: newCh };
  },

  getLineBegin: function() {
    return { line: this._getLine(), ch: 0 };
  },

  getLineEnd: function(beyond = false) {
    const line = this._getLine();
    return { line, ch: this.getLineLengthAt(line) + (beyond ? 0 : -1) };
  },

  getDocumentEnd: function(beyond = false) {
    const lastLine = this.lastLine();
    const lastLineCh = this.getLastChAt(lastLine);
    return { line: lastLine, ch: lastLineCh + (beyond ? 1 : 0) };
  },

  getDocumentBegin: function() {
    return { line: 0, ch: 0 };
  },

  getSelectionVisual: function() {
    const { anchor, head } = this.listSelections()[0];
    const headChOffset = cu.isBefore(head, anchor) ? 0 : 1;
    return { anchor, head: cu.offsetCursor(head, headChOffset) };
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
      const anchor = { line: 0, ch: 0 };
      const head = { line, ch: this.getLineLength() };
      return { anchor, head };
    }

    if (this.isLastLine()) {
      const lineLengthAbove = this.getLineLengthAt(line - 1);
      const anchor = { line: line - 1, ch: lineLengthAbove };
      const head = { line, ch: lineLength };
      return { anchor, head };
    }
    const anchor = { line, ch: 0 };
    const head = { line: line + 1, ch: 0 };
    return { anchor, head };
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

  isLineEnd: function(beyond = false) {
    return beyond ? this.getCh() === this.getLineLength() : this.getCh() === this.getLastCh();
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

  findParagraphBelow: function(beyond) {
    const line = this._getLine();
    let l = line;
    while (this.isEmptyLine(l) && l <= this.lastLine()) {
      l++;
    }

    while (!this.isEmptyLine(l) && l <= this.lastLine()) {
      l++;
    }

    if (l > this.lastLine()) {
      return this.getDocumentEnd(beyond);
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

  findCharacter: function(motionArgs) {
    const { line, ch } = this.getCursor();
    const { forward, charToMatch } = motionArgs;
    const regexp = RegExp(escapeRegExp(charToMatch), 'ug');
    const positions = getBeginPositions(this.getLineAt(line), regexp);
    const newCh = positions.filter(p => (forward ? ch < p : ch > p)).slice(forward ? 0 : -1)[0];
    return newCh ? { line, ch: newCh } : null;
  },

  findWord: function(inner = true) {
    let start, end;
    if (inner) {
      start = this.findWordBeginLeft(inner);
      end = this.findWordEndRight(inner);
      return { anchor: start, head: cu.offsetCursor(end, 1) };
    } else {
      const cur = this.getCursor();
      end = this.findWordBeginRight();
      const containsSpace = this.getRange(cur, end).indexOf(' ') > -1;

      start = containsSpace ? this.findWordBeginLeft(inner) : this.findWordEndLeft();
      const offset = containsSpace ? 0 : 1;
      return { anchor: cu.offsetCursor(start, offset), head: end };
    }
  },

  findSurrounding: function(motionArgs) {
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
    let char = motionArgs.charToMatch;
    if (char == 'b') {
      char = '(';
    } else if (char == 'B') {
      char = '{';
    }

    const { inner } = motionArgs;

    if (mirroredPairs[char]) {
      return this.findCompanionObject(char, inner);
    } else if (selfPaired[char]) {
      return this.findQuoteOrBacktick(char, inner);
    } else if (char === 'w') {
      return this.findWord(inner);
    }
  },

  findCompanionObject: function(symb, inner) {
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
      return { anchor: cur, head: cur };
    }

    start = start.pos;
    end = end.pos;

    if ((start.line == end.line && start.ch > end.ch) || start.line > end.line) {
      let tmp = start;
      start = end;
      end = tmp;
    }

    if (!inner) {
      end.ch++;
    } else {
      start.ch++;
    }

    return { anchor: start, head: end };
  },

  findQuoteOrBacktick: function(symb, inner) {
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
      return { anchor: cur, head: cur };
    }

    // include the symbols
    if (!inner) {
      --start;
      ++end;
    }

    return {
      anchor: { line: cur.line, ch: start },
      head: { line: cur.line, ch: end },
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

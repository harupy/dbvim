import * as cu from './utils/cursor';

const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
const wordRegexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

const clip = function(x, lower, upper) {
  return Math.min(upper, Math.max(lower, x));
};

const clipLine = function(line) {
  return clip(line, this.firstLine(), this.lastLine());
};

const getBeginPositions = function(line, regexp) {
  const positions = [];
  let match;
  while ((match = regexp.exec(line))) {
    positions.push(match.index);
  }
  return positions;
};

const getEndPositions = function(line, regexp) {
  const positions = [];
  let match;
  while ((match = regexp.exec(line))) {
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
  isDocumentEmpty: function() {
    const lastLine = this.lastLine();
    const lastLineLength = this.getLine(lastLine);
    return lastLine === 0 && lastLineLength === 0;
  },

  isEmptyLine: function(line) {
    return !/\S/.test(this.getLine(line));
  },

  isSingleLine: function() {
    return this.lastLine() === 0;
  },

  isFirstLine: function(line) {
    return this.firstLine() === line;
  },

  isLastLine: function(line) {
    return this.lastLine() === line;
  },

  getLineBegin: function(line) {
    return { line, ch: 0 };
  },

  getLineEnd: function(line, beyond = false) {
    const offset = beyond ? 0 : -1;
    const lineLength = this.getLineLength(line);
    return lineLength === 0 ? { line, ch: 0 } : { line, ch: lineLength + offset };
  },

  findFirstNonBlank: function(line) {
    const match = /\S/.exec(this.getLine(line));
    return { line, ch: match ? match.index : 0 };
  },

  isLineBegin: function(ch) {
    return ch === 0;
  },

  isLineEnd: function(cur, beyond = false) {
    const { line, ch } = cur;
    const offset = beyond ? 0 : -1;
    const lineLength = this.getLineLength(line);
    return ch === lineLength + offset || lineLength === 0;
  },

  getDocumentBegin: function() {
    return { line: 0, ch: 0 };
  },

  getDocumentEnd: function(beyond = false) {
    const offset = beyond ? 0 : -1;
    const lastLine = this.lastLine();
    const lastLineLength = this.getLineLength(lastLine);
    const ch = lastLineLength ? lastLineLength + offset : 0;
    return { line: lastLine, ch };
  },

  isDocumentBegin: function(cur) {
    return cur.ch === 0 && cur.line === 0;
  },

  isDocumentEnd: function(cur, beyond = false) {
    const { line, ch } = this.getDocumentEnd(beyond);
    return cur.line === line && cur.ch === ch;
  },

  getLastCh: function(line) {
    const lineLength = this.getLineLength(line);
    return lineLength ? lineLength - 1 : 0;
  },

  getLineLength: function(line) {
    return this.getLine(line).length;
  },

  getIndent: function(line) {
    return this.getLine(line).match(/^\s*/)[0];
  },

  getIndentLength: function(line) {
    return this.getIndent(line).length;
  },

  getLineAbove: function(cur, beyond = false) {
    const { line, ch } = cur;

    if (this.isFirstLine(line)) {
      return { line, ch: 0 };
    }

    const lineAbove = line - 1;
    const lineLengthAbove = this.getLineLength(lineAbove);
    const offset = lineLengthAbove === 0 ? 0 : beyond ? 0 : -1;
    const newCh = Math.min(ch, lineLengthAbove + offset);
    return { line: lineAbove, ch: newCh };
  },

  getLineBelow: function(cur, beyond = false) {
    const { line, ch } = cur;

    if (this.isLastLine(line)) {
      const lastLineLength = this.getLineLength(line);
      const offset = lastLineLength === 0 ? 0 : beyond ? 0 : -1;
      return { line, ch: lastLineLength + offset };
    }

    const lineBelow = line + 1;
    const lineLengthBelow = this.getLineLength(lineBelow);
    const offset = lineLengthBelow === 0 ? 0 : beyond ? 0 : -1;
    const newCh = Math.min(ch, lineLengthBelow + offset);
    return { line: lineBelow, ch: newCh };
  },

  getRight: function(cur, beyond = false, throughLines = true) {
    const { line, ch } = cur;
    const offset = beyond ? 1 : 0;
    if (this.isDocumentEmpty()) {
      return { line, ch };
    }

    if (this.isLineEnd(cur, beyond)) {
      if (!throughLines) {
        return this.getLineEnd(line, true);
      }

      if (this.isLastLine(line)) {
        return { line, ch: ch + offset };
      } else {
        return { line: line + 1, ch: 0 };
      }
    }

    return { line, ch: ch + 1 };
  },

  getLeft: function(cur, throughLines = true) {
    const { line, ch } = cur;

    if (this.isLineBegin(ch)) {
      if (!throughLines) {
        return { line, ch };
      }

      if (this.isFirstLine(line)) {
        return this.getDocumentBegin();
      } else {
        const lastChAbove = this.getLastCh(line - 1);
        return { line: line - 1, ch: lastChAbove };
      }
    }

    return { line, ch: ch - 1 };
  },

  findParagraphBelow: function(cur, beyond = false) {
    const { line } = cur;
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

  findParagraphAbove: function(cur) {
    const { line } = cur;
    let l = line;
    while (this.isEmptyLine(l) && l > this.firstLine()) {
      l--;
    }

    while (!this.isEmptyLine(l) && l > this.firstLine()) {
      l--;
    }

    return { line: l, ch: 0 };
  },

  findWordBeginRight: function(cur, inclusive = false, throughLines = true) {
    const { line, ch } = cur;
    let l = line;

    while (l <= this.lastLine()) {
      const lineStr = this.getLine(l);
      const positions = getBeginPositions(lineStr, wordRegexp);
      const wordBegin = positions.filter(
        idx => (inclusive ? idx >= ch : idx > ch) || l !== line,
      )[0];

      if (wordBegin !== undefined) {
        return { line: l, ch: wordBegin };
      }

      if (!throughLines) {
        return { line: l, ch: lineStr.length };
      }

      l++;
    }

    return this.getDocumentEnd();
  },

  findWordBeginLeft: function(cur, inclusive = false, throughLines = true) {
    const { line, ch } = cur;

    let l = line;

    while (l >= this.firstLine()) {
      const lineStr = this.getLine(l);
      const positions = getBeginPositions(lineStr, wordRegexp);
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

  findWordEndRight: function(cur, inclusive = false, throughLines = true) {
    const { line, ch } = cur;

    let l = line;

    while (l <= this.lastLine()) {
      const lineStr = this.getLine(l);
      const positions = getEndPositions(lineStr, wordRegexp);
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

  findWordEndLeft: function(cur, inclusive = false, throughLines = true) {
    const { line, ch } = cur;
    let l = line;

    while (l >= this.firstLine()) {
      const lineStr = this.getLine(l);
      const positions = getEndPositions(lineStr, wordRegexp);
      const wordEnd = positions
        .filter(idx => (inclusive ? idx <= ch : idx < ch) || l !== line)
        .reverse()[0];

      if (wordEnd !== undefined) {
        return { line: l, ch: wordEnd };
      }

      if (!throughLines) {
        const indentLength = this.getIndentLength(line);
        return { line: l, ch: indentLength };
      }

      l--;
    }

    return this.getDocumentBegin();
  },

  findCharacter: function(cur, forward, charToMatch) {
    const { line, ch } = cur;
    const regexp = RegExp(escapeRegExp(charToMatch), 'ug');
    const positions = getBeginPositions(this.getLine(line), regexp);
    const newCh = positions.filter(p => (forward ? ch < p : ch > p)).slice(forward ? 0 : -1)[0];
    return newCh ? { line, ch: newCh } : null;
  },

  findCompanionObject: function(cur, symb, inner) {
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

  findQuoteOrBacktick: function(cur, symb, inner) {
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

  findWord: function(cur, inner = true) {
    let start, end;
    const cursorChar = this.getRange(cur, cu.offsetCursor(cur, 1));

    if (cursorChar === ' ') {
      start = this.findWordEndLeft(cur, true);
      end = this.findWordBeginRight(cur, true);
      return { anchor: cu.offsetCursor(start, 1), head: end };
    }

    if (inner) {
      start = this.findWordBeginLeft(cur, true);
      end = this.findWordEndRight(cur, true);
      return { anchor: start, head: cu.offsetCursor(end, 1) };
    } else {
      end = this.findWordBeginRight(cur, false, false);
      const containsSpace = this.getRange(cur, end).indexOf(' ') > -1;

      start = containsSpace
        ? this.findWordBeginLeft(cur, true)
        : this.findWordEndLeft(cur, false, false);
      const indentLength = this.getIndentLength(cur.line);
      const offset = containsSpace ? 0 : start.ch === indentLength ? 0 : 1;
      return { anchor: cu.offsetCursor(start, offset), head: end };
    }
  },

  findSurrounding: function(cur, inner, charToMatch) {
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
    let char = charToMatch;
    if (char == 'b') {
      char = '(';
    } else if (char == 'B') {
      char = '{';
    }

    if (mirroredPairs[char]) {
      return this.findCompanionObject(cur, char, inner);
    } else if (selfPaired[char]) {
      return this.findQuoteOrBacktick(cur, char, inner);
    } else if (char === 'w') {
      return this.findWord(cur, inner);
    }
  },

  expandToLine: function(cur, repeat) {
    const { line } = cur;
    const lineLength = this.getLineLength(line);

    if (this.isSingleLine()) {
      const anchor = { line: 0, ch: 0 };
      const head = { line, ch: lineLength };
      return { anchor, head };
    }

    const isFirstLine = this.isFirstLine(line);
    const lastLine = this.lastLine();
    const lineTo = Math.min(lastLine, line + repeat - 1);
    const containsLastLine = lineTo >= lastLine;

    if (isFirstLine) {
      const head = containsLastLine ? this.getDocumentEnd(true) : { line: lineTo + 1, ch: 0 };
      return { anchor: this.getDocumentBegin(), head: head };
    }

    const anchor = { line: line - 1, ch: this.getLineLength(line - 1) };
    const head = containsLastLine
      ? this.getDocumentEnd(true)
      : { line: lineTo, ch: this.getLineLength(lineTo) };

    return { anchor, head };
  },

  getSelectionVisual: function(sel) {
    const { anchor, head } = sel;
    const headChOffset = cu.isBefore(head, anchor) ? 0 : 1;
    return { anchor, head: cu.offsetCursor(head, headChOffset) };
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

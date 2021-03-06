import InputState from './InputState';
import Register from './Register';
import * as cu from './utils/cursor';
import * as ku from './utils/key';
import commandSearch from './commandSearch';

export default class VimKeyMap {
  constructor() {
    this.name = 'vim';
    this.inputState = new InputState();
    this.register = new Register();
    this.insertMode = false;
    this.normalMode = true;
    this.visualMode = false;
    this.usedJK = false;
  }

  getMode = () => {
    const { insertMode, normalMode } = this;
    return insertMode ? 'insert' : normalMode ? 'normal' : 'visual';
  };

  // called every time you type something
  call = (key, cm) => {
    // prevent fat-cursor from getting disabled by click
    if (this.normalMode) {
      cu.enableFatCursor();
    }

    if (key === 'Esc' && this.insertMode) {
      this.enterNormalMode(cm);
      return () => {};
    }
    // for a single character, another key event is dispatched with "'<char>'"
    // this line is for ignoring the first event.
    if (key.charAt(0) !== "'") {
      return key;
    }

    const vimKey = ku.toVimKey(key);
    const { inputState } = this;

    if (!cm) {
      return undefined;
    }

    if (this.insertMode) {
      // special case for 'jk' to leave the insert mode
      if (inputState.lastKey === 'j' && vimKey === 'k') {
        this.processJK(cm);
        this.usedJK = true;
        this.enterNormalMode(cm);
        return () => {};
      }
      inputState.setLastKey(vimKey);
      return vimKey;
    } else {
      /* the cursor class needs to be updated every time
       * because the cell state is refreshed and fat-cursor class is erased
       * when you mutate the cell state
       */
      if (vimKey !== 'Shift' && vimKey !== 'Ctrl') {
        inputState.appendKeyBuffer(vimKey);
        inputState.appendKeySeq(vimKey);
      }

      const keys = inputState.joinKeyBuffer();

      console.log('Key buffer: ', this.inputState.keyBuffer);
      console.log('Key sequence: ', this.inputState.keySeq);
      console.log('Last edit key sequence', this.inputState.lastEditKeySeq);
      cu.enableFatCursor();
      return this.processKeyNonInsert(cm, keys, this.getMode());
    }
  };

  enterInsertMode = cm => {
    this.insertMode = true;
    this.normalMode = false;
    this.visualMode = false;
    this.inputState.initAll();
    cm.setOption('disableInput', false);
    cm.setOption('showCursorWhenSelecting', true);
    cu.disableFatCursor();
  };

  enterNormalMode = cm => {
    this.insertMode = false;
    this.normalMode = true;
    this.visualMode = false;
    this.inputState.initAll();
    cm.setCursor(cm.getLeft(cm.getCursor(), false));
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    cu.enableFatCursor();
  };

  toggleVisualMode = cm => {
    this.insertmode = false;
    if (this.visualMode) {
      cm.setCursor(cm.getCursor('head'));
      this.visualMode = false;
      this.normalMode = true;
    } else {
      // select the the current character
      this.visualMode = true;
      this.normalMode = false;
    }
    cm.setOption('showCursorWhenSelecting', true);
    this.inputState.initAll();
  };

  processJK = cm => {
    // note that Vim mode is switched to the normal mode before 'k' is typed.
    const selections = cm.listSelections();
    const rangesToReplace = selections.map(({ anchor, head }) => {
      return { anchor: cu.offsetCursor(anchor, -1), head };
    });
    cm.setSelections(rangesToReplace);
    cm.replaceSelections(Array(selections.length).fill(''));
    cm.setCursor(rangesToReplace[0].anchor);
    this.usedJK = true;
  };

  processOperator = (_cm, cmd) => {
    const operators = {
      delete: (cm, range) => {
        cm.replaceRange('', range.anchor, range.head);
        cm.setCursor(range.anchor);
      },

      change: (cm, range) => {
        cm.replaceRange('', range.anchor, range.head);
        cm.setCursor(range.anchor);
        this.enterInsertMode(cm);
      },

      yank: (cm, range) => {
        return;
      },
    };

    const oldHead = _cm.getCursor('head');
    const oldAnchor = _cm.getCursor('anchor');

    const { inputState, register } = this;
    const operator = operators[cmd.operator];

    if (!operator) {
      inputState.initAll();
      return;
    }

    if (this.visualMode) {
      // in visual mode, include the character the cursor is on in the selected range
      const sel = _cm.listSelections()[0];
      const range = _cm.getSelectionVisual(sel);
      const [from, to] = cu.sortCursors(range.anchor, range.head);
      register.setText(_cm.getRange(from, to)); // 'from' must be before 'to'
      register.setLinewise(false);
      operator(_cm, range);
      _cm.setCursor(from);
      this.toggleVisualMode(_cm);
      return;
    }

    // when called from 'processMotion'
    if (inputState.motion) {
      const { range } = cmd.operatorArgs;
      register.setText(_cm.getRange(range.anchor, range.head));
      register.setLinewise(false);
      operator(_cm, range);
      inputState.updateLastEditKeySeq();
      inputState.initAll();
      return;
    }

    // handle repeated keys such as 'dd'
    if (inputState.operator) {
      const isFirstLine = _cm.getCursor().line === 0;
      const range = _cm.expandToLine(oldHead, inputState.repeat);
      const textRaw = _cm.getRange(range.anchor, range.head);
      const text = '\n' + textRaw.replace(/(^\n|\n$)/, '');
      register.setText(text);
      register.setLinewise(true);
      operator(_cm, range);

      const line = isFirstLine ? 0 : Math.min(_cm.lastLine(), range.anchor.line + 1);
      const ch = _cm.findFirstNonBlank(line).ch;
      _cm.setCursor({ line, ch });
      inputState.updateLastEditKeySeq();
      inputState.initAll();
      return;
    }

    inputState.setOperator(cmd.operator);
    inputState.setOperatorArgs(cmd.operatorArgs);
    inputState.initKeyBuffer();
  };

  processMotion = (_cm, cmd) => {
    const motions = {
      moveByCharacters: (cm, cur, motionArgs) => {
        return motionArgs.forward ? cm.getRight(cur) : cm.getLeft(cur);
      },

      moveByLines: (cm, cur, motionArgs) => {
        return motionArgs.forward ? cm.getLineBelow(cur) : cm.getLineAbove(cur);
      },

      moveByWords: (cm, cur, motionArgs) => {
        const { forward, wordEnd } = motionArgs;
        return forward
          ? wordEnd
            ? cm.findWordEndRight(cur)
            : cm.findWordBeginRight(cur)
          : wordEnd
          ? cm.findWordEndLeft(cur)
          : cm.findWordBeginLeft(cur);
      },

      moveToCharacter: (cm, cur, motionArgs) => {
        const { forward, charToMatch } = motionArgs;
        return cm.findCharacter(cur, forward, charToMatch);
      },

      moveToLineBegin: (cm, cur) => {
        return cm.getLineBegin(cur.line);
      },

      moveToLineEnd: (cm, cur) => {
        return cm.getLineEnd(cur.line);
      },

      moveToFirstNonBlank: (cm, cur) => {
        return cm.findFirstNonBlank(cur.line);
      },

      moveByParagraphs: (cm, cur, motionArgs) => {
        return motionArgs.forward ? cm.findParagraphBelow(cur) : cm.findParagraphAbove(cur);
      },

      moveByObjects: (cm, cur, motionArgs) => {
        const { inner, charToMatch } = motionArgs;
        return cm.findSurrounding(cur, inner, charToMatch);
      },
    };

    const { inputState } = this;
    const motion = motions[cmd.motion];

    if (!motion) {
      inputState.initAll();
      return;
    }

    const oldHead = _cm.getCursor('head');
    const oldAnchor = _cm.getCursor('anchor');

    inputState.setMotion(cmd.motion);
    inputState.setMotionArgs(cmd.motionArgs);

    // const funcs = [...Array(inputState.repeat).fill(motion)];
    const motionResults = [];
    let cur = oldHead;

    [...Array(inputState.repeat)].forEach(() => {
      const next = motion(_cm, cur, cmd.motionArgs);
      if (!next) return;

      motionResults.push(next);
      cur = next.head ? next.head : next; // check if next is a range or a cursor
    });

    if (motionResults.length === 0) {
      inputState.initAll();
      return;
    }

    const motionResult = motionResults[0].head
      ? { anchor: motionResults[0].anchor, head: motionResults.slice(-1)[0].head }
      : motionResults.slice(-1)[0];

    if (!motionResult) {
      inputState.initAll();
      return;
    }

    if (this.visualMode) {
      if (motionResult.head) {
        _cm.setSelection(motionResult.anchor, cu.offsetCursor(motionResult.head, -1));
      } else {
        const { anchor, head } = cu.expandSelection(oldAnchor, oldHead, motionResult);
        _cm.setSelection(anchor, head);
      }

      inputState.initAll();
      return;
    }

    // when called after an operator
    if (inputState.operator) {
      const operatorArgs = {
        range: motionResult.head ? motionResult : { anchor: oldAnchor, head: motionResult },
      };
      this.processOperator(_cm, {
        operator: inputState.operator,
        operatorArgs,
      });
      return;
    }

    _cm.setCursor(motionResult);
    inputState.initAll();
  };

  processAction = (_cm, cmd) => {
    if (this.inputState.operator) {
      return;
    }
    const actions = {
      newLineAndEnterInsertMode: (cm, actionArgs) => {
        const { line } = cm.getCursor();
        if (cm.isFirstLine(line) && !actionArgs.after) {
          cm.replaceRange('\n', { line: cm.firstLine(), ch: 0 });
          cm.setCursor(cm.firstLine(), 0);
        } else {
          const indent = cm.getIndent(line);
          const lastCh = cm.getLastCh(line);
          const codeBockIndent = cm.getLine(line).charAt(lastCh) === ':' ? '  ' : '';
          const newLine = actionArgs.after ? line : line - 1;
          const newCur = {
            line: newLine,
            ch: cm.getLineLength(newLine),
          };
          cm.setCursor(newCur);
          cm.replaceSelection('\n' + indent + codeBockIndent);
        }
        this.enterInsertMode(cm);
      },
      enterInsertMode: (cm, actionArgs) => {
        if (actionArgs) {
          const cur = cm.getCursor();

          switch (actionArgs.insertAt) {
            case 'charAfter':
              cm.setCursor(cm.getRight(cur, true, false));
              break;
            case 'lineEnd':
              cm.setCursor(cm.getLineEnd(cur.line, true));
              break;
            case 'firstNonBlank':
              cm.setCursor(cm.findFirstNonBlank(cur.line));
              break;
            default:
              break;
          }
        }
        this.enterInsertMode(cm);
      },

      toggleVisualMode: cm => {
        this.toggleVisualMode(cm);
      },

      paste: cm => {
        const { line } = cm.getCursor();
        if (this.register.linewise) {
          const lineEnd = cm.getLineEnd(line, true);
          cm.setCursor(lineEnd);
          cm.replaceSelection(this.register.text);
          cm.setCursor(cm.findFirstNonBlank(cm.getCursor().line));
        } else {
          if (this.visualMode) {
            // in visual mode, include the character the cursor is on in the selected range
            const sel = cm.listSelections()[0];
            const range = cm.getSelectionVisual(sel);
            cm.setSelection(range.anchor, range.head);
          } else {
            cm.setCursor(cu.offsetCursor(cm.getCursor(), 1));
          }
          cm.replaceSelection(this.register.text);
        }
        this.inputState.updateLastEditKeySeq();

        if (this.visualMode) {
          this.toggleVisualMode(cm);
        }
      },

      undo: cm => {
        if (this.usedJK) {
          cm.execCommand('undo');
          cm.execCommand('undo');
          this.usedJK = false;
        }
        cm.execCommand('undo');
        cm.setCursor(cm.getCursor('anchor'));
      },

      repeatLastEdit: cm => {
        this.inputState.initAll();
        this.inputState.lastEditKeySeq.forEach(key => {
          this.inputState.appendKeyBuffer(key);
          this.inputState.appendKeySeq(key);
          const keys = this.inputState.joinKeyBuffer();
          this.processKeyNonInsert(cm, keys, 'normal');
        });
      },
    };

    const { inputState } = this;
    const action = actions[cmd.action];

    if (!action) {
      inputState.initAll();
      return;
    }

    if (this.visualMode) {
      action(_cm, cmd.actionArgs);
      return;
    }

    action(_cm, cmd.actionArgs);
    if (!this.visualMode) {
      inputState.initAll();
    }
  };

  processKeyNonInsert = (cm, key, context) => {
    if (ku.isNumeric(key)) {
      this.inputState.setRepeat(parseInt(key));
      this.inputState.popKeyBuffer();
      return () => {};
    }

    const match = commandSearch(key, context, this.inputState);
    console.log(match.type);
    switch (match.type) {
      case 'none':
        this.inputState.initAll();
        return;
      case 'partial':
        return;
      case 'full':
        break;
      default:
        return () => {};
    }

    if (!match.command) {
      this.inputState.initAll();
      return () => {};
    }

    const commands = [];
    if (match.command.toKeys) {
      const { toKeys } = match.command;
      ku.splitKeys(toKeys).forEach(k => {
        const m = commandSearch(k, context, this.inputState);
        if (m && m.command) {
          commands.push(m.command);
        }
      });
    } else {
      commands.push(match.command);
    }

    commands.forEach(command => {
      console.log(command);
      switch (command.type) {
        case 'motion':
          this.processMotion(cm, command);
          break;
        case 'action': {
          this.processAction(cm, command);
          break;
        }
        case 'operator': {
          this.processOperator(cm, command);
          break;
        }
        case 'operatorMotion': {
          if (this.visualMode) {
            this.processOperator(cm, command);
          } else {
            this.processOperator(cm, command);
            this.processMotion(cm, command);
          }
          break;
        }
        default:
          break;
      }
    });
    return () => {};
  };
}

import InputState from './InputState';
import Register from './Register';
import keyMap from './defaultKeyMap';
import * as cu from './cursorUtils';
import commandSearch from './commandSearch';

const toVimKey = key => {
  if (key.charAt(0) === "'") {
    return key.slice(1, -1);
  }

  const isChar = key => {
    return key.length === 1;
  };

  const isAlphabet = key => {
    return /[a-zA-Z]/.test(key);
  };

  if (isChar(key)) {
    if (isAlphabet) {
      return key.toLowerCase();
    } else {
      return key;
    }
  }

  // process a key combination (e.g. shift-m, ctrl-e)
  const pieces = key.split('-');

  if (pieces.length == 2) {
    const [modKey, normKey] = pieces;

    if (modKey === normKey) {
      return modKey;
    }

    // process shift - <alphabet> combination
    if (modKey.toLowerCase() === 'shift') {
      if (isChar(normKey) && isAlphabet(normKey)) {
        return normKey.toUpperCase();
      }
    }
  }
};

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
    // for a single character, another key event is dispatched with "'<char>'"
    // this line is for ignoring the first event.
    if (key.charAt(0) !== "'") {
      return key;
    }

    const vimKey = toVimKey(key);
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
        return;
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
    cm.setCursor(cm.getLeft(false));
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

    const { inputState, register } = this;
    const operator = operators[cmd.operator];

    if (!operator) {
      inputState.initAll();
      return;
    }

    if (this.visualMode) {
      // in visual mode, include the character the cursor is on in the selected range
      const range = _cm.getSelectionVisual();
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

    // when repeated keys such as 'dd' are typed
    if (inputState.operator) {
      const range = _cm.expandToLine();
      const text = _cm.getRange(range.anchor, range.head);
      register.setText('\n' + text.replace(/^\n+|\n+$/g, ''));
      register.setLinewise(true);
      operator(_cm, range);
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
      moveByCharacters: (cm, motionArgs) => {
        return motionArgs.forward ? cm.getRight() : cm.getLeft();
      },

      moveByLines: (cm, motionArgs) => {
        return motionArgs.forward ? cm.getLineBelow() : cm.getLineAbove();
      },

      moveByWords: (cm, motionArgs) => {
        const { forward, wordEnd } = motionArgs;
        return forward
          ? wordEnd
            ? cm.findWordEndRight()
            : cm.findWordBeginRight()
          : wordEnd
          ? cm.findWordEndLeft()
          : cm.findWordBeginLeft();
      },

      moveToLineBegin: cm => {
        return cm.getLineBegin();
      },

      moveToLineEnd: cm => {
        return cm.getLineEnd();
      },

      moveToFirstNonBlank: cm => {
        return cm.findFirstNonBlank();
      },

      moveByParagraphs: (cm, motionArgs) => {
        return motionArgs.forward ? cm.findParagraphBelow() : cm.findParagraphAbove();
      },

      moveByObjects: (cm, motionArgs) => {
        return cm.findSurrounding(motionArgs);
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

    const motionResult = motion(_cm, cmd.motionArgs);

    if (!motionResult) {
      inputState.initAll();
      return;
    }

    if (this.visualMode) {
      if (motionResult.head) {
        _cm.setSelection(motionResult.anchor, cu.offsetCursor(motionResult.head, -1));
      } else {
        const { anchor, head } = cu.adjustSelection(oldAnchor, oldHead, motionResult);
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
        const cur = cm.getCursor();
        if (cm.isFirstLine() && !actionArgs.after) {
          cm.replaceRange('\n', { line: cm.firstLine(), ch: 0 });
          cm.setCursor(cm.firstLine(), 0);
        } else {
          const indent = cm.getIndent();
          const codeBockIndent = cm.getLastChar() === ':' ? '  ' : '';
          const newLine = actionArgs.after ? cur.line : cur.line - 1;
          const newCur = {
            line: newLine,
            ch: cm.getLineLengthAt(newLine),
          };
          cm.setCursor(newCur);
          cm.replaceSelection('\n' + indent + codeBockIndent);
        }
        this.enterInsertMode(cm);
      },
      enterInsertMode: (cm, actionArgs) => {
        if (actionArgs) {
          switch (actionArgs.insertAt) {
            case 'charAfter':
              cm.setCursor(cm.isLineEnd(true) ? cm.getCursor() : cm.getRight(true));
              break;
            case 'lineEnd':
              cm.setCursor(cm.getLineEnd(true));
              break;
            case 'firstNonBlank':
              cm.setCursor(cm.findFirstNonBlank());
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
        if (this.register.linewise) {
          const lineEnd = cm.getLineEnd(true);
          cm.setCursor(lineEnd);
          cm.replaceSelection(this.register.text);
          cm.setCursor(cm.findFirstNonBlank());
        } else {
          if (this.visualMode) {
            // in visual mode, include the character the cursor is on in the selected range
            const range = cm.getSelectionVisual();
            cm.setSelection(range.anchor, range.head);
          } else {
            cm.setCursor(cm.getCursorOffset(1));
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
    const match = commandSearch(key, keyMap, context, this.inputState);
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
        return;
    }

    if (!match.command) {
      this.inputState.initAll();
      return;
    }

    const commands = [];
    if (match.command.toKeys) {
      const { toKeys } = match.command;
      const isMultiple = !toKeys.startsWith('<') && toKeys.length > 1;
      (isMultiple ? toKeys.split('') : [toKeys]).forEach(k => {
        const m = commandSearch(k, keyMap, context, this.inputState);
        if (m && m.command) {
          commands.push(m.command);
        }
      });
    } else {
      commands.push(match.command);
    }

    commands.forEach(command => {
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

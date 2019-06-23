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
      return this.processKeyNormal(cm, keys, this.getMode());
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
    this.insertMode = false;
    if (this.visualMode) {
      // const head = cm.getCursor('head');
      // const anchor = cm.getCursor('anchor');
      // cm.setCursor(anchor.ch < head.ch ? anchor : head);
      this.visualMode = false;
      this.normalMode = true;
    } else {
      // cm.setSelection(cm.getRight(true), cm.getCursor());
      this.visualMode = true;
      this.normalMode = false;
    }
    this.inputState.initAll();
  };

  processJK = cm => {
    // note that Vim mode is switched to the normal mode before 'k' is typed.
    const to = cm.getCursor();
    const from = cm.offsetCursor(to, -1);
    cm.replaceRange('', from, to);
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

    const operator = operators[cmd.operator];

    if (!operator) {
      return;
    }

    const { inputState, register } = this;

    if (this.visualMode) {
      const range = _cm.listSelections()[0];
      operator(_cm, range);
      this.toggleVisualMode(_cm);
      return;
    }

    // when called from 'processMotion'
    if (inputState.motion) {
      const { range } = cmd.operatorArgs;
      const text = _cm.getRange(range.anchor, range.head);
      register.setText(text);
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
        return motionArgs.forward ? cm.getRight(this.visualMode) : cm.getLeft();
      },

      moveByLines: (cm, motionArgs) => {
        return motionArgs.forward
          ? cm.getLineBelow(this.visualMode)
          : cm.getLineAbove(this.visualMode);
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
        return cm.getLineEnd(this.visualMode);
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

    if (!motions[cmd.motion]) {
      return;
    }

    const { inputState } = this;
    const head = _cm.getCursor('head');
    const anchor = _cm.getCursor('anchor');

    inputState.setMotion(cmd.motion);
    inputState.setMotionArgs(cmd.motionArgs);

    const motionResult = motions[cmd.motion](_cm, cmd.motionArgs);

    if (this.visualMode) {
      if (motionResult.head) {
        _cm.setSelection(motionResult.anchor, motionResult.head);
      } else {
        _cm.setSelection(anchor, motionResult);
      }

      inputState.initAll();
      return;
    }

    // when called after an operator
    if (inputState.operator) {
      const operatorArgs = {
        range: motionResult.head ? motionResult : { anchor, head: motionResult },
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
          const newLine = actionArgs.after ? cur.line : cur.line - 1;
          const newCur = {
            line: newLine,
            ch: cm.getLineLengthAt(newLine),
          };
          cm.setCursor(newCur);
          cm.replaceSelection('\n' + indent);
        }
        this.enterInsertMode(cm);
      },
      enterInsertMode: (cm, actionArgs) => {
        if (actionArgs) {
          switch (actionArgs.insertAt) {
            case 'charAfter':
              cm.setCursor(cm.getRight(true));
              break;
            case 'endOfLine':
              cm.setCursor(cm.offsetCursor(cm.getLineEnd(), 1));
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
          if (!cm.somethingSelected()) {
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
      },

      repeatLastEdit: cm => {
        this.inputState.initAll();
        this.inputState.lastEditKeySeq.forEach(key => {
          this.inputState.appendKeyBuffer(key);
          this.inputState.appendKeySeq(key);
          const keys = this.inputState.joinKeyBuffer();
          this.processKeyNormal(cm, keys, 'normal');
        });
      },
    };

    if (!actions[cmd.action]) {
      return;
    }

    const { inputState } = this;

    if (this.visualMode) {
      actions[cmd.action](_cm, cmd.actionArgs);
      return;
    }

    actions[cmd.action](_cm, cmd.actionArgs);
    if (!this.visualMode) {
      inputState.initAll();
    }
  };

  processKeyNormal = (cm, key, context) => {
    const match = commandSearch(key, keyMap, context, this.inputState);

    switch (match.type) {
      case 'none':
        this.inputState.initAll();
        return;
      case 'partial':
        return;
      case 'full':
        break;
      default:
        break;
    }

    if (match.command) {
      console.log(match.command);
      switch (match.command.type) {
        case 'motion':
          this.processMotion(cm, match.command);
          break;
        case 'action': {
          this.processAction(cm, match.command);
          break;
        }
        case 'operator': {
          this.processOperator(cm, match.command);
          break;
        }
        case 'operatorMotion': {
          if (this.visualMode) {
            this.processOperator(cm, match.command);
          } else {
            this.processOperator(cm, match.command);
            this.processMotion(cm, match.command);
          }
          break;
        }
        default:
          break;
      }
      return () => {};
    } else {
      this.inputState.initAll();
    }
  };
}

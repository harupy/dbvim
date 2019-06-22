import { enableFatCursor, disableFatCursor } from './CodeMirrorUtils';
import InputState from './InputState';
import Register from './Register';
import keyMap from './defaultKeyMap';
import commandSearch from './commandSearch';

const toVimKey = key => {
  if (key.charAt(0) === "'") {
    return key.slice(1, -1);
  }

  const isSingleChar = key => {
    return key.length === 1;
  };

  const isAlphabet = key => {
    return /[a-zA-Z]/.test(key);
  };

  if (isSingleChar(key)) {
    if (isAlphabet) {
      return key.toLowerCase();
    } else {
      return key;
    }
  }

  // Process a key combination (e.g. Shift-M, Ctrl-E)
  const pieces = key.split('-');

  if (pieces.length == 2) {
    const [modKey, normKey] = pieces;

    // In CodeMirror, when you press the only "Shift" key, it is expressed as "Shift-Shift"
    if (modKey === normKey) {
      return modKey;
    }

    // Process Shift - <alphabet> combination
    if (modKey.toLowerCase() === 'shift') {
      if (isSingleChar(normKey) && isAlphabet(normKey)) {
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
    this.usedJK = false;
    // this.fallthrough = ['default'];
  }

  // This function is called every time you type something
  call = (key, cm) => {
    // For a single character, another key event is dispatched with "'<char>'"
    // This line is for ignoring the first event.
    if (key.charAt(0) !== "'") {
      return key;
    }

    const vimKey = toVimKey(key);
    const { inputState } = this;

    if (vimKey !== 'Shift' && vimKey !== 'Ctrl') {
      inputState.keyBuffer.push(vimKey);
    }
    const keys = inputState.keyBuffer.join('');
    console.log('Key Buffer: ', keys);
    if (!cm) {
      return undefined;
    }

    if (this.insertMode) {
      // Special case for JK to leave the insert mode
      if (inputState.keyBefore === 'j' && vimKey === 'k') {
        this.processJK(cm);
        this.usedJK = true;
        this.leaveInsertMode(cm);
        return;
      }
      inputState.setKeyBefore(vimKey);
      inputState.initialize();
      return vimKey;
    } else {
      /* The cursor class needs to be updated every time
       * because the cell state is refreshed and fat-cursor class is erased
       * when you mutate the cell state
       */
      window.setTimeout(enableFatCursor, 0);
      return this.processKeyNormal(cm, keys, 'normal');
    }
  };

  enterInsertMode = cm => {
    this.insertMode = true;
    this.inputState.initialize();
    cm.setOption('disableInput', false);
    cm.setOption('showCursorWhenSelecting', true);
    window.setTimeout(disableFatCursor, 0);
  };

  leaveInsertMode = cm => {
    this.insertMode = false;
    this.inputState.initialize();
    const { ch, line } = cm.getCursor();
    cm.setCursor({ ch: ch - 1, line });
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    window.setTimeout(enableFatCursor, 0);
  };

  processJK = cm => {
    // Note that Vim mode is switched to the normal mode before 'k' is typed.
    const to = cm.getCursor();
    const from = cm.offsetCursor(to, -1);
    cm.replaceRange('', from, to);
    this.usedJK = true;
  };

  evalInput = cm => {
    const { inputState } = this;
    let newHead, newAnchor;

    if (inputState.motion) {
      if (inputState.motionArgs.linewise) {
        const range = cm.expandToLine();
        newHead = range.head;
        newAnchor = range.anchor;
      }
    }

    cm.replaceRange('', newHead, newAnchor);
  };

  processOperator = (_cm, cmd) => {
    const operators = {
      delete: (cm, range) => {
        cm.replaceRange('', range.head, range.anchor);
      },
      change: (cm, range) => {
        const cur = cm.getCursor();
        cm.replaceRange('', range.head, range.anchor);

        if (range.head.ch - cur.ch === 1) {
          cm.setCursor(cm.getCursorOffset(1));
        }
        this.enterInsertMode(cm);
      },
      yank: (cm, range) => {
        return;
      },
    };

    if (!operators[cmd.operator]) {
      return;
    }
    const { inputState, register } = this;

    // When called from 'processMotion'
    if (inputState.motion) {
      const { range } = cmd;
      const text = _cm.getRange(range.head, range.anchor);
      register.setText(text);
      register.setLinewise(false);
      operators[inputState.operator](_cm, range);
      inputState.initialize();
      return;
    }

    // When a repeated keys like 'dd' is typed
    if (inputState.operator) {
      const range = _cm.expandToLine();
      const text = _cm.getRange(range.head, range.anchor);
      register.setText('\n' + text.replace(/^\n+|\n+$/g, ''));
      register.setLinewise(true);
      operators[inputState.operator](_cm, range);
      inputState.initialize();
      return;
    }

    inputState.setOperator(cmd.operator);
    inputState.setOperatorArgs(cmd.operatorArgs);
    inputState.clearKeyBuffer();
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

    const cur = _cm.getCursor();
    const { inputState } = this;

    inputState.setMotion(cmd.motion);
    inputState.setMotionArgs(cmd.motionArgs);
    if (!motions[cmd.motion]) {
      return;
    }
    const motionResult = motions[cmd.motion](_cm, cmd.motionArgs);
    if (inputState.operator) {
      this.processOperator(_cm, {
        operator: inputState.operator,
        range: motionResult.head ? motionResult : { head: cur, anchor: motionResult },
      });
      return;
    }

    _cm.setCursor(motionResult);
    inputState.initialize();
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

      paste: cm => {
        if (this.register.linewise) {
          const cur = cm.offsetCursor(cm.getLineEnd(), 1);
          cm.setCursor(cur);
          cm.replaceSelection(this.register.text);
          cm.setCursor(cm.findFirstNonBlank());
        } else {
          cm.setCursor(cm.getCursorOffset(1));
          cm.replaceSelection(this.register.text);
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
    };

    const { inputState } = this;

    if (inputState.operator) {
      return;
    }

    if (!actions[cmd.action]) {
      return;
    }
    actions[cmd.action](_cm, cmd.actionArgs);
    inputState.initialize();
  };

  processKeyNormal = (cm, key, context) => {
    const cmd = commandSearch(key, keyMap, context);
    console.log(cmd);
    if (cmd) {
      switch (cmd.type) {
        case 'motion':
          this.processMotion(cm, cmd);
          return () => {};
        case 'action': {
          this.processAction(cm, cmd);
          return () => {};
        }
        case 'operator': {
          this.processOperator(cm, cmd);
          return () => {};
        }
        case 'operatorMotion': {
          this.processOperator(cm, cmd);
          this.processMotion(cm, cmd);
          break;
        }
        default:
          return;
      }
    } else {
      this.inputState.initialize();
    }
  };
}

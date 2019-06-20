import { enableFatCursor, disableFatCursor } from './CodeMirrorUtils';
import InputState from './InputState';
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
    this.insertMode = false;
    // this.fallthrough = ['default'];
  }

  // This function is called every time you type something
  call = (key, cm) => {
    // For a single character, another key event is dispatched with "'<char>'"
    // This line is for ignoring the fisrt event.
    if (key.length === 1) {
      return key;
    }

    const vimKey = toVimKey(key);
    console.log(vimKey);

    this.inputState.keyBuffer.push(vimKey);
    if (!cm) {
      return undefined;
    }

    if (this.insertMode) {
      // Sepcail case for JK to leave the insert mode
      if (this.inputState.keyBuffer.join('').endsWith('jk')) {
        this.processJK(cm);
        this.leaveInsertMode(cm);
        this.inputState.initialize();
      }
      return vimKey;
    } else {
      /* The cursor class needs to be updated every time
       * because the cell state is refreshed and fat-cursor class is erased
       * when you mutate the cell state
       */
      window.setTimeout(enableFatCursor, 0);
      return this.processKeyNormal(cm, vimKey, 'normal');
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

  processOperator = (cm, cmd) => {
    const { inputState } = this;
    if (inputState.operator) {
      inputState.setMotion('expandToLine');
      inputState.setMotionArgs({ linewise: true });
      this.evalInput(cm);
      inputState.initialize();
      // window.setTimeout(enableFatCursor, 0);
      return;
    }
    inputState.setOperator(cmd.operator);
    inputState.setOperatorArgs(cmd.operatorArgs);
    // window.setTimeout(enableFatCursor, 0);
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

      moveToStartOfLine: cm => {
        return cm.getLineBegin();
      },

      moveToEndOfLine: cm => {
        return cm.getLineEnd();
      },

      moveToFirstNonBlank: cm => {
        return cm.findFirstNonBlank();
      },

      moveByParagraph: (cm, motionArgs) => {
        return motionArgs.forward ? cm.findParagraphBelow() : cm.findParagraphAbove();
      },
    };

    const cur = motions[cmd.motion](_cm, cmd.motionArgs);
    _cm.setCursor(cur);
    // window.setTimeout(enableFatCursor, 0);
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
          const indent = cm.getIndent(cm);
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
    };

    actions[cmd.action](_cm, cmd.actionArgs);
  };

  processKeyNormal = (cm, key, context) => {
    const cmd = commandSearch(key, keyMap, context);
    /*
     * cmd.type select innerWord
     *
     */
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
        default:
          return;
      }
    }
  };
}

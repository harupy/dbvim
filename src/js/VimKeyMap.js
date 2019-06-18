import defaultKeyMap from './defaultKeyMap';
import * as cmu from './CodeMirrorUtils';
import { enableFatCursor, disableFatCursor } from './CodeMirrorUtils';
import InputState from './InputState';
import keyMap from './defaultKeyMap';
import commandSearch from './commandSearch';

/* Code to restore console.log
```
(function(){
  var f = document.body.appendChild(document.createElement('iframe'));
  f.style.display = 'none';
  window.console = f.contentWindow.console;
})();
```
*/

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
    this.fallthrough = ['default'];
  }

  call = (key, cm) => {
    // For Windows, changing the default keymap disables Ctrl-C
    // For Mac, Cmd-C works as usual
    // Linux, I haven't checked yet
    if (key === 'Ctrl-C') {
      document.execCommand('copy');
    }
    // For a single alphabet (e.g. A, B, C), another key event is dispatched with "'<char>'"
    // This line is for ignoring the event.
    if (key.length === 1) {
      return key;
    }
    console.log(key);

    const vimKey = toVimKey(key);
    console.log(vimKey);

    this.inputState.keyBuffer.push(vimKey);
    if (!cm) {
      return undefined;
    }

    if (this.insertMode) {
      if (this.inputState.keyBuffer.join('').endsWith('jk')) {
        this.processJK(cm);
        this.leaveInsertMode(cm);
      }
      return vimKey;
    } else {
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
    // Vim mode is switched to the normal mode before 'k' is typed.
    // All you need to remove is 'J' and the cursor character offset is set to -1.
    const to = cm.getCursor();
    const from = cmu.offsetCursor(to, -1);
    cmu.removeRange(cm, { from, to });
  };

  processMotion = (_cm, cmd) => {
    const motions = {
      moveByCharacters: (cm, motionArgs) => {
        const cur = _cm.getCursor();
        const { forward } = motionArgs;
        if (!forward && cmu.isStartOfLine(cm) && !cmu.isFirstLine(cm)) {
          const ch = cmu.getLineOffset(cm, -1).length;
          return { line: cur.line - 1, ch };
        } else if (forward && !cmu.isLastLine(cm) && cmu.isEndOfLine(cm)) {
          return { line: cur.line + 1, ch: 0 };
        } else {
          const ch = motionArgs.forward ? cur.ch + 1 : cur.ch - 1;
          return { line: cur.line, ch };
        }
      },

      moveByLines: (cm, motionArgs) => {
        const { line, ch } = cm.getCursor();
        const newLine = motionArgs.forward ? line + 1 : line - 1;
        return { line: cmu.clipLine(cm, newLine), ch };
      },

      moveByWords: (cm, motionArgs) => {
        const { line, from, to } = cmu.findWord(cm, motionArgs.forward);
        console.log(line, from, to);
        if (motionArgs.wordEnd) {
          return { line, ch: to - 1 };
        } else {
          return { line, ch: from };
        }
      },

      moveToStartOfLine: cm => {
        const { line } = cm.getCursor();
        return { line, ch: 0 };
      },

      moveToEndOfLine: cm => {
        const { line } = cm.getCursor();
        const ch = cmu.getLineLength(cm, line);
        return { line, ch: ch > 0 ? ch - 1 : 0 };
      },

      moveToFirstNonBlank: cm => {
        const { line } = cm.getCursor();
        const ch = cmu.findFirstNonBlank(cm, line);
        return { line, ch };
      },

      moveByParagraph: (cm, motionArgs) => {
        const line = cmu.findParagraph(cm, motionArgs.forward);
        return { line, ch: 0 };
      },
    };
    const cur = motions[cmd.motion](_cm, cmd.motionArgs);
    _cm.setCursor(cur);
    window.setTimeout(enableFatCursor, 0);
  };

  processAction = (_cm, cmd) => {
    const actions = {
      newLineAndEnterInsertMode: (cm, actionArgs) => {
        const cur = cm.getCursor();
        if (cur.line === cm.firstLine() && !actionArgs.after) {
          // Special case for inserting newline before start of document.
          cm.replaceRange('\n', { line: cm.firstLine(), ch: 0 });
          cm.setCursor(cm.firstLine(), 0);
        } else {
          const indent = cmu.getIndent(cm);
          const newCur = {
            line: actionArgs.after ? cur.line : cur.line - 1,
            ch: cm.getLine(cur.line).length,
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
              cmu.moveCursor(cm, 1);
              break;
            case 'endOfLine':
              cmu.moveToEndOfLine(cm);
              break;
            case 'firstNonBlank':
              cmu.moveToFirstNonBlank(cm);
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
    console.log(key);
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
        default:
          return;
      }
    }
  };
}

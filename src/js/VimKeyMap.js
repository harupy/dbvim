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
  const isSingleChar = key => {
    return key.length === 1;
  };

  const isSingleAlphabet = key => {
    return isSingleChar(key) && /[a-zA-Z]/.test(key);
  };

  if (isSingleAlphabet(key)) {
    return key.toLowerCase();
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
      if (isSingleAlphabet(pieces[1])) {
        return pieces[1].toUpperCase();
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

  call = (key, cm) => {
    console.log(key);

    // For a single alphabet (e.g. A, B, C), another key event is dispatched with "'<char>'"
    // This line is for ignoring the event.
    if (key.charAt(0) === "'") {
      return false;
    }

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

  processMotion = (cm, cmd) => {
    const motions = {
      moveByCharacters: (_cm, motionArgs) => {
        const { line, ch } = _cm.getCursor();
        const newCh = motionArgs.forward ? ch + 1 : ch - 1;
        cm.setCursor({ line, ch: newCh });
      },

      moveByLines: (_cm, motionArgs) => {
        const { line, ch } = _cm.getCursor();
        const newLine = motionArgs.forward ? line + 1 : line - 1;
        cm.setCursor({ line: newLine, ch });
      },
    };
    motions[cmd.motion](cm, cmd.motionArgs);
    window.setTimeout(enableFatCursor, 0);
  };

  processAction = (cm, cmd) => {
    const actions = {
      newLineAndEnterInsertMode: (_cm, actionArgs) => {
        const cur = cm.getCursor();
        if (cur.line === cm.firstLine() && !actionArgs.after) {
          // Special case for inserting newline before start of document.
          cm.replaceRange('\n', { line: cm.firstLine(), ch: 0 });
          cm.setCursor(cm.firstLine(), 0);
        } else {
          const indent = cmu.getIndent(_cm);
          const newCur = {
            line: actionArgs.after ? cur.line : cur.line - 1,
            ch: cm.getLine(cur.line).length,
          };
          cm.setCursor(newCur);
          cm.replaceSelection('\n' + indent);
        }
        this.enterInsertMode(_cm);
      },
      enterInsertMode: (_cm, actionArgs) => {
        if (actionArgs) {
          if (actionArgs.insertAt === 'charAfter') {
            console.log('actionArgs');

            cmu.moveCursor(_cm, 1);
          }
        }
        this.enterInsertMode(_cm);
      },
    };

    actions[cmd.action](cm, cmd.actionArgs);
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
        default:
          return;
      }
    }

    // Normal Mode
    // if (key === 'h') {
    //   window.setTimeout(enableFatCursor, 0);
    //   return 'goCharLeft';
    // } else if (key === 'l') {
    //   window.setTimeout(enableFatCursor, 0);
    //   return 'goCharRight';
    // } else if (key === 'j') {
    //   window.setTimeout(enableFatCursor, 0);
    //   return 'goLineDown';
    // } else if (key === 'k') {
    //   window.setTimeout(enableFatCursor, 0);
    //   return 'goLineUp';
    // } else if (key === 'a') {
    //   this.enterInsertMode(cm);
    //   return 'goCharRight';
    // } else if (key === 'o') {
    //   this.newLineAndEnterInsertMode(cm, { after: true });
    //   return () => {};
    // } else if (key === 'O') {
    //   this.newLineAndEnterInsertMode(cm, { after: false });
    //   return () => {};
    // } else {
    //   return () => {};
    // }
  };
}

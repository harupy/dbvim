import defaultKeyMap from './defaultKeyMap';
import { enableFatCursor, disableFatCursor } from './cursorUtils';
import InputState from './InputState';

const cmKeyToVimKey = {};

export default class VimKeyMap {
  constructor() {
    this.name = 'vim';
    this.inputState = new InputState();
    this.insertMode = false;
    // this.fallthrough = ['default'];
  }

  call = (key, cm) => {
    console.log(key);
    if (key.charAt(0) === "'") {
      return false;
    }
    // this.inputState.keyBuffer.push(key);
    this.inputState.keyBuffer.push(key);
    if (!cm) {
      return undefined;
    }

    if (this.insertMode) {
      if (this.inputState.keyBuffer.join('').endsWith('JK')) {
        this.leaveInsertMode(cm);
        return () => {};
      }
      return key;
    } else {
      // Normal Mode
      if (key === 'H') {
        window.setTimeout(enableFatCursor, 0);
        return 'goCharLeft';
      } else if (key === 'L') {
        window.setTimeout(enableFatCursor, 0);
        return 'goCharRight';
      } else if (key === 'A') {
        this.enterInsertMode(cm);
        return 'goCharRight';
      } else if (key === 'O') {
        this.newLineAndEnterInsertMode(cm, { after: true });
        return () => {};
      } else {
        return () => {};
      }
    }
  };

  enterInsertMode = cm => {
    console.log('Enter insert mode');
    this.insertMode = true;
    this.inputState.initialize();
    cm.setOption('disableInput', false);
    cm.setOption('showCursorWhenSelecting', true);
    window.setTimeout(disableFatCursor, 0);
  };

  leaveInsertMode = cm => {
    console.log('Left insert mode');
    this.insertMode = false;
    this.inputState.initialize();
    const { ch, line } = cm.getCursor();
    cm.setCursor({ ch: ch - 1, line });
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    window.setTimeout(enableFatCursor, 0);
  };

  newLineAndEnterInsertMode = (cm, actionArgs) => {
    const cur = cm.getCursor();
    if (cur.line === cm.firstLine() && !actionArgs.after) {
      // Special case for inserting newline before start of document.
      cm.replaceRange('\n', { line: cm.firstLine(), ch: 0 });
      cm.setCursor(cm.firstLine(), 0);
    } else {
      const newCur = {
        line: actionArgs.after ? cur.line : cur.line - 1,
        ch: cm.getLine(cur.line).length,
      };
      cm.setCursor(newCur);
      cm.replaceSelection('\n');
    }
    this.enterInsertMode(cm);
  };

  processKey(key, cm) {}
}

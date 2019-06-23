import VimKeyMap from './VimKeyMap';
import * as cu from './cursorUtils';
import extendCodeMirror from './extendCodeMirror';

(() => {
  const enterVimMode = cm => {
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    cu.enableFatCursor();
  };

  const onKeyUp = () => {
    // find the cell being edited
    const cellEditing = document.querySelector('div.is-editing div.CodeMirror');

    if (cellEditing && !cellEditing.CodeMirror.state.vimized) {
      const cm = cellEditing.CodeMirror;
      cm.state.vimized = true;
      const vimKeyMap = new VimKeyMap();

      // add new methods to CodeMirror
      extendCodeMirror(cm);

      // adjust the cursor position
      const { line, ch } = cm.getCursor();
      if (ch == cm.getLineLength()) {
        cm.setCursor({ line: line, length, ch: cm.getLastChAt(line) });
      }

      // add the vim keymap
      cm.addKeyMap(vimKeyMap);
      enterVimMode(cm);
    }
  };

  const onMouseUp = onKeyUp;

  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('keyup', onKeyUp, false);
})();

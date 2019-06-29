import VimKeyMap from './VimKeyMap';
import * as cu from './utils/cursor';
import extendCodeMirror from './extendCodeMirror';

export default () => {
  const enterVimMode = cm => {
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    cu.enableFatCursor();
  };

  const onKeyUp = () => {
    // find the cell being edited
    const cellEditing = document.querySelector('div.is-editing div.CodeMirror');

    if (!cellEditing || !cellEditing.CodeMirror) return;

    const cm = cellEditing.CodeMirror;

    if (!cm.state.vimized) {
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
    } else if (!cm.state.keyMaps[0].insertMode) {
      if (cm.isLineEnd(true)) {
        cm.setCursor(cm.getLineEnd());
        cu.enableFatCursor();
      }
    }
  };

  const onMouseUp = onKeyUp;

  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('keyup', onKeyUp, false);
};

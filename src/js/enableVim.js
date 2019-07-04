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
      if (ch == cm.getLineLength(line)) {
        cm.setCursor({ line, ch: ch - 1 });
      }

      // add the vim keymap
      cm.addKeyMap(vimKeyMap);
      enterVimMode(cm);
    } else if (cm.state.keyMaps[0].normalMode) {
      const cur = cm.getCursor();
      if (cm.isLineEnd(cur, true)) {
        cm.setCursor(cm.getLineEnd(cur.line));
        cu.enableFatCursor();
      }
    }
  };

  const onMouseUp = onKeyUp;

  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('keyup', onKeyUp, false);
};

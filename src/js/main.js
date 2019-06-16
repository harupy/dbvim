import Vim from './Vim';
import VimKeyMap from './VimKeyMap';
import { enableFatCursor, disableFatCursor } from './cursorUtils';

(() => {
  const enterVimMode = cm => {
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', false);
    enableFatCursor();
    // cm.state.vim = Vim();
  };

  const leaveVimMode = cm => {
    cm.setOption('disableInput', false);
    cm.state.vim = null;
  };

  const initVimState = cm => {
    if (!cm.state.vim) {
      cm.state.vim = new Vim();
    }
  };

  const goCharLeft = cm => {
    cm.execCommand('goCharLeft');
    window.setTimeout(enableFatCursor, 100);
  };

  const goCharRight = cm => {
    cm.execCommand('goCharRight');
    window.setTimeout(enableFatCursor, 100);
  };

  const exitInsertMode = cm => {
    const { vim } = cm.state;
    vim.insertMode = false;

    // cm.setCursor(cm.getCursor().line, cm.getCursor().ch - 1);
    cm.execCommand('goCharLeft');
    cm.setOption('disableInput', true);
    window.setTimeout(enableFatCursor, 0);

    // override key mapping
    cm.options.extraKeys['H'] = goCharLeft;
    cm.options.extraKeys['L'] = goCharRight;
  };

  const enterInsertMode = cm => {
    const { vim } = cm.state;
    vim.insertMode = true;
    // cm.setCursor(cm.getCursor().line, cm.getCursor().ch - 1);
    cm.setOption('disableInput', false);
    // cm.toggleOverwrite(false); // exit replace mode if we were in it.
    // update the ". register before exiting insert mode
    // insertModeChangeRegister.setText(lastChange.changes.join(''));
    // CodeMirror.signal(cm, 'vim-mode-change', { mode: 'normal' });
    // if (macroModeState.isRecording) {
    //   logInsertModeChange(macroModeState);
    // }
    window.setTimeout(enableFatCursor, 0);
  };

  const keyBuffer = [];

  const onKeyUp = () => {
    // Find the cell being edited and update its CodeMirror Object
    const cellEditing = document.querySelector('div.is-editing div.CodeMirror');

    if (cellEditing && !cellEditing.CodeMirror.state.vimized) {
      const cm = cellEditing.CodeMirror;
      cm.state.vimized = true;
      const vimKeyMap = new VimKeyMap();
      cm.options.extraKeys['Ctrl-C'] = cm => {};

      cm.addKeyMap(vimKeyMap);
      enterVimMode(cm);
    }
  };

  const onMouseUp = onKeyUp;

  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('keyup', onKeyUp, false);
})();

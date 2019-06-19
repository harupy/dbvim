import Vim from './Vim';
import VimKeyMap from './VimKeyMap';
import { enableFatCursor, disableFatCursor } from './CodeMirrorUtils';

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

  const onKeyUp = () => {
    // Find the cell being edited and update its CodeMirror Object
    const cellEditing = document.querySelector('div.is-editing div.CodeMirror');

    if (cellEditing && !cellEditing.CodeMirror.state.vimized) {
      const cm = cellEditing.CodeMirror;
      cm.state.vimized = true;
      const vimKeyMap = new VimKeyMap();

      cm.getBeginPositions = function(line, regex) {
        const positions = [];
        let match;
        while ((match = regex.exec(line))) {
          positions.push(match.index);
        }
        return positions;
      };

      cm.findWordBegin = function() {
        const cur = this.getCursor();

        const wordSeparator = '\\\\()"\':,.;<>~!@#$%^&*|+=[\\]{}`?-';
        const regexp = new RegExp(`([^\\s${wordSeparator}]+|[${wordSeparator}]+)`, 'ug');

        let line = cur.line;

        while (line <= this.lastLine()) {
          const lineStr = this.getLine(line);
          const positions = this.getBeginPositions(lineStr, regexp);
          const wordStart = positions.filter(idx => idx > cur.ch || line !== cur.line)[0];

          if (wordStart !== undefined) {
            return { line, ch: wordStart };
          }

          line++;
        }
      };

      cm.addKeyMap(vimKeyMap);
      enterVimMode(cm);
    }
  };

  const onMouseUp = onKeyUp;

  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('keyup', onKeyUp, false);
})();

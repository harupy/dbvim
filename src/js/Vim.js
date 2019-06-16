import InputState from './InputState';

export default class Vim {
  constructor() {
    this.inputState = new InputState();
    // Vim's input state that triggered the last edit, used to repeat
    // motions and operators with '.'.
    this.lastEditInputState = undefined;
    // Vim's action command before the last edit, used to repeat actions
    // with '.' and insert mode repeat.
    this.lastEditActionCommand = undefined;
    // When using jk for navigation, if you move from a longer line to a
    // shorter line, the cursor may clip to the end of the shorter line.
    // If j is pressed again and cursor goes to the next line, the
    // cursor should go back to its horizontal position on the longer
    // line if it can. This is to keep track of the horizontal position.
    this.lastHPos = -1;
    // Doing the same with screen-position for gj/gk
    this.lastHPos = -1;
    // The last motion command run. Cleared if a non-motion command gets
    // executed in between.
    this.lastMotion = null;
    this.marks = {};
    // Mark for rendering fake cursor for visual mode.
    this.fakeCursor = null;
    this.insertMode = false;
    // Repeat count for changes made in insert mode, triggered by key
    // sequences like 3,i. Only exists when insertMode is true.
    (this.insertModeRepeat = undefined), (this.visualMode = false);
    // If we are in visual line mode. No effect if visualMode is false.
    this.visualLine = false;
    this.visualBlock = false;
    this.lastSelection = null;
    this.lastPastedText = null;
    this.sel = {};
    // Buffer-local/window-local values of vim options.
    this.options = {};
  }
}

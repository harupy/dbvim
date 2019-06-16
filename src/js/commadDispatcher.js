
function commandMatch(pressed, mapped) {
  if (mapped.slice(-11) == '<character>') {
    // Last character matches anything.
    const prefixLen = mapped.length - 11;
    const pressedPrefix = pressed.slice(0, prefixLen);
    const mappedPrefix = mapped.slice(0, prefixLen);
    return pressedPrefix == mappedPrefix && pressed.length > prefixLen ? 'full' :
           mappedPrefix.indexOf(pressedPrefix) == 0 ? 'partial' : false;
  } else {
    return pressed == mapped ? 'full' :
           mapped.indexOf(pressed) == 0 ? 'partial' : false;
  }
}

const commandMatches = (keys, keyMap, context, inputState) => {
  // Partial matches are not applied. They inform the key handler
  // that the current key sequence is a subsequence of a valid key
  // sequence, so that the key buffer is not cleared.
  var match, partial = [], full = [];
  keyMap.forEach(command => {
    if (context == 'insert' && command.context != 'insert' ||
        command.context && command.context != context ||
        inputState.operator && command.type == 'action' ||
        !(match = commandMatch(keys, command.keys))) { continue; }
    if (match == 'partial') { partial.push(command); }
    if (match == 'full') { full.push(command); }
  })
}

class commandDispatcher {
  matchCommand = (keys, keyMap, inputState, context) => {
    var matches = commandMatches(keys, keyMap, context, inputState);
    if (!matches.full && !matches.partial) {
      return { type: 'none' };
    } else if (!matches.full && matches.partial) {
      return { type: 'partial' };
    }

    var bestMatch;
    for (var i = 0; i < matches.full.length; i++) {
      var match = matches.full[i];
      if (!bestMatch) {
        bestMatch = match;
      }
    }
    if (bestMatch.keys.slice(-11) == '<character>') {
      var character = lastChar(keys);
      if (!character) return { type: 'none' };
      inputState.selectedCharacter = character;
    }
    return { type: 'full', command: bestMatch };
  };

  processCommand = (cm, vim, command) => {
    vim.inputState.repeatOverride = command.repeatOverride;
    switch (command.type) {
      case 'motion':
        this.processMotion(cm, vim, command);
        break;
      case 'operator':
        this.processOperator(cm, vim, command);
        break;
      case 'operatorMotion':
        this.processOperatorMotion(cm, vim, command);
        break;
      case 'action':
        this.processAction(cm, vim, command);
        break;
      case 'search':
        this.processSearch(cm, vim, command);
        break;
      case 'ex':
      case 'keyToEx':
        this.processEx(cm, vim, command);
        break;
      default:
        break;
    }
  };

  processMotion = (cm, vim, command) => {
    vim.inputState.motion = command.motion;
    vim.inputState.motionArgs = copyArgs(command.motionArgs);
    this.evalInput(cm, vim);
  };

  processOperator = (cm, vim, command) => {
    var inputState = vim.inputState;
    if (inputState.operator) {
      if (inputState.operator == command.operator) {
        // Typing an operator twice like 'dd' makes the operator operate
        // linewise
        inputState.motion = 'expandToLine';
        inputState.motionArgs = { linewise: true };
        this.evalInput(cm, vim);
        return;
      } else {
        // 2 different operators in a row doesn't make sense.
        clearInputState(cm);
      }
    }
    inputState.operator = command.operator;
    inputState.operatorArgs = copyArgs(command.operatorArgs);
    if (vim.visualMode) {
      // Operating on a selection in visual mode. We don't need a motion.
      this.evalInput(cm, vim);
    }
  };

  processOperatorMotion = (cm, vim, command) => {
    var visualMode = vim.visualMode;
    var operatorMotionArgs = copyArgs(command.operatorMotionArgs);
    if (operatorMotionArgs) {
      // Operator motions may have special behavior in visual mode.
      if (visualMode && operatorMotionArgs.visualLine) {
        vim.visualLine = true;
      }
    }
    this.processOperator(cm, vim, command);
    if (!visualMode) {
      this.processMotion(cm, vim, command);
    }
  };

  processAction = (cm, vim, command) => {
    var inputState = vim.inputState;
    var repeat = inputState.getRepeat();
    var repeatIsExplicit = !!repeat;
    var actionArgs = copyArgs(command.actionArgs) || {};
    if (inputState.selectedCharacter) {
      actionArgs.selectedCharacter = inputState.selectedCharacter;
    }
    // Actions may or may not have motions and operators. Do these first.
    if (command.operator) {
      this.processOperator(cm, vim, command);
    }
    if (command.motion) {
      this.processMotion(cm, vim, command);
    }
    if (command.motion || command.operator) {
      this.evalInput(cm, vim);
    }
    actionArgs.repeat = repeat || 1;
    actionArgs.repeatIsExplicit = repeatIsExplicit;
    actionArgs.registerName = inputState.registerName;
    clearInputState(cm);
    vim.lastMotion = null;
    if (command.isEdit) {
      this.recordLastEdit(vim, inputState, command);
    }
    actions[command.action](cm, actionArgs, vim);
  };
  processSearch = (cm, vim, command) => {
    if (!cm.getSearchCursor) {
      // Search depends on SearchCursor.
      return;
    }
    var forward = command.searchArgs.forward;
    var wholeWordOnly = command.searchArgs.wholeWordOnly;
    getSearchState(cm).setReversed(!forward);
    var promptPrefix = forward ? '/' : '?';
    var originalQuery = getSearchState(cm).getQuery();
    var originalScrollPos = cm.getScrollInfo();
    function handleQuery(query, ignoreCase, smartCase) {
      vimGlobalState.searchHistoryController.pushInput(query);
      vimGlobalState.searchHistoryController.reset();
      try {
        updateSearchQuery(cm, query, ignoreCase, smartCase);
      } catch (e) {
        showConfirm(cm, 'Invalid regex: ' + query);
        clearInputState(cm);
        return;
      }
      commandDispatcher.processMotion(cm, vim, {
        type: 'motion',
        motion: 'findNext',
        motionArgs: { forward: true, toJumplist: command.searchArgs.toJumplist },
      });
    }
    function onPromptClose(query) {
      cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
      handleQuery(query, true /** ignoreCase */, true /** smartCase */);
      var macroModeState = vimGlobalState.macroModeState;
      if (macroModeState.isRecording) {
        logSearchQuery(macroModeState, query);
      }
    }
    function onPromptKeyUp(e, query, close) {
      var keyName = CodeMirror.keyName(e),
        up,
        offset;
      if (keyName == 'Up' || keyName == 'Down') {
        up = keyName == 'Up' ? true : false;
        offset = e.target ? e.target.selectionEnd : 0;
        query = vimGlobalState.searchHistoryController.nextMatch(query, up) || '';
        close(query);
        if (offset && e.target)
          e.target.selectionEnd = e.target.selectionStart = Math.min(offset, e.target.value.length);
      } else {
        if (
          keyName != 'Left' &&
          keyName != 'Right' &&
          keyName != 'Ctrl' &&
          keyName != 'Alt' &&
          keyName != 'Shift'
        )
          vimGlobalState.searchHistoryController.reset();
      }
      var parsedQuery;
      try {
        parsedQuery = updateSearchQuery(cm, query, true /** ignoreCase */, true /** smartCase */);
      } catch (e) {
        // Swallow bad regexes for incremental search.
      }
      if (parsedQuery) {
        cm.scrollIntoView(findNext(cm, !forward, parsedQuery), 30);
      } else {
        clearSearchHighlight(cm);
        cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
      }
    }
    function onPromptKeyDown(e, query, close) {
      var keyName = CodeMirror.keyName(e);
      if (
        keyName == 'Esc' ||
        keyName == 'Ctrl-C' ||
        keyName == 'Ctrl-[' ||
        (keyName == 'Backspace' && query == '')
      ) {
        vimGlobalState.searchHistoryController.pushInput(query);
        vimGlobalState.searchHistoryController.reset();
        updateSearchQuery(cm, originalQuery);
        clearSearchHighlight(cm);
        cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
        CodeMirror.e_stop(e);
        clearInputState(cm);
        close();
        cm.focus();
      } else if (keyName == 'Up' || keyName == 'Down') {
        CodeMirror.e_stop(e);
      } else if (keyName == 'Ctrl-U') {
        // Ctrl-U clears input.
        CodeMirror.e_stop(e);
        close('');
      }
    }
    switch (command.searchArgs.querySrc) {
      case 'prompt':
        var macroModeState = vimGlobalState.macroModeState;
        if (macroModeState.isPlaying) {
          var query = macroModeState.replaySearchQueries.shift();
          handleQuery(query, true /** ignoreCase */, false /** smartCase */);
        } else {
          showPrompt(cm, {
            onClose: onPromptClose,
            prefix: promptPrefix,
            desc: searchPromptDesc,
            aeyUp: onPromptKeyUp,
            onKeyDown: onPromptKeyDown,
          });
        }
        break;
      case 'wordUnderCursor':
        var word = expandWordUnderCursor(
          cm,
          false /** inclusive */,
          true /** forward */,
          false /** bigWord */,
          true /** noSymbol */,
        );
        var isKeyword = true;
        if (!word) {
          word = expandWordUnderCursor(
            cm,
            false /** inclusive */,
            true /** forward */,
            false /** bigWord */,
            false /** noSymbol */,
          );
          isKeyword = false;
        }
        if (!word) {
          return;
        }
        var query = cm.getLine(word.start.line).substring(word.start.ch, word.end.ch);
        if (isKeyword && wholeWordOnly) {
          query = '\\b' + query + '\\b';
        } else {
          query = escapeRegex(query);
        }

        // cachedCursor is used to save the old position of the cursor
        // when * or # causes vim to seek for the nearest word and shift
        // the cursor before entering the motion.
        vimGlobalState.jumpList.cachedCursor = cm.getCursor();
        cm.setCursor(word.start);

        handleQuery(query, true /** ignoreCase */, false /** smartCase */);
        break;
    }
  };

  processEx = (cm, vim, command) => {
    const onPromptClose = input => {
      // Give the prompt some time to close so that if processCommand shows
      // an error, the elements don't overlap.
      vimGlobalState.exCommandHistoryController.pushInput(input);
      vimGlobalState.exCommandHistoryController.reset();
      exCommandDispatcher.processCommand(cm, input);
    };
    const onPromptKeyDown = (e, input, close) => {
      var keyName = CodeMirror.keyName(e),
        up,
        offset;
      if (
        keyName == 'Esc' ||
        keyName == 'Ctrl-C' ||
        keyName == 'Ctrl-[' ||
        (keyName == 'Backspace' && input == '')
      ) {
        vimGlobalState.exCommandHistoryController.pushInput(input);
        vimGlobalState.exCommandHistoryController.reset();
        CodeMirror.e_stop(e);
        clearInputState(cm);
        close();
        cm.focus();
      }
      if (keyName == 'Up' || keyName == 'Down') {
        CodeMirror.e_stop(e);
        up = keyName == 'Up' ? true : false;
        offset = e.target ? e.target.selectionEnd : 0;
        input = vimGlobalState.exCommandHistoryController.nextMatch(input, up) || '';
        close(input);
        if (offset && e.target)
          e.target.selectionEnd = e.target.selectionStart = Math.min(offset, e.target.value.length);
      } else if (keyName == 'Ctrl-U') {
        // Ctrl-U clears input.
        CodeMirror.e_stop(e);
        close('');
      } else {
        if (
          keyName != 'Left' &&
          keyName != 'Right' &&
          keyName != 'Ctrl' &&
          keyName != 'Alt' &&
          keyName != 'Shift'
        )
          vimGlobalState.exCommandHistoryController.reset();
      }
    };
    if (command.type == 'keyToEx') {
      // Handle user defined Ex to Ex mappings
      exCommandDispatcher.processCommand(cm, command.exArgs.input);
    } else {
      if (vim.visualMode) {
        showPrompt(cm, {
          onClose: onPromptClose,
          prefix: ':',
          value: "'<,'>",
          onKeyDown: onPromptKeyDown,
          selectValueOnOpen: false,
        });
      } else {
        showPrompt(cm, { onClose: onPromptClose, prefix: ':', onKeyDown: onPromptKeyDown });
      }
    }
  };

  evalInput = (cm, vim) => {
    // If the motion command is set, execute both the operator and motion.
    // Otherwise return.
    var inputState = vim.inputState;
    var motion = inputState.motion;
    var motionArgs = inputState.motionArgs || {};
    var operator = inputState.operator;
    var operatorArgs = inputState.operatorArgs || {};
    var registerName = inputState.registerName;
    var sel = vim.sel;
    // TODO: Make sure cm and vim selections are identical outside visual mode.
    var origHead = copyCursor(
      vim.visualMode ? clipCursorToContent(cm, sel.head) : cm.getCursor('head'),
    );
    var origAnchor = copyCursor(
      vim.visualMode ? clipCursorToContent(cm, sel.anchor) : cm.getCursor('anchor'),
    );
    var oldHead = copyCursor(origHead);
    var oldAnchor = copyCursor(origAnchor);
    var newHead, newAnchor;
    var repeat;
    if (operator) {
      this.recordLastEdit(vim, inputState);
    }
    if (inputState.repeatOverride !== undefined) {
      // If repeatOverride is specified, that takes precedence over the
      // input state's repeat. Used by Ex mode and can be user defined.
      repeat = inputState.repeatOverride;
    } else {
      repeat = inputState.getRepeat();
    }
    if (repeat > 0 && motionArgs.explicitRepeat) {
      motionArgs.repeatIsExplicit = true;
    } else if (motionArgs.noRepeat || (!motionArgs.explicitRepeat && repeat === 0)) {
      repeat = 1;
      motionArgs.repeatIsExplicit = false;
    }
    if (inputState.selectedCharacter) {
      // If there is a character input, stick it in all of the arg arrays.
      motionArgs.selectedCharacter = operatorArgs.selectedCharacter = inputState.selectedCharacter;
    }
    motionArgs.repeat = repeat;
    clearInputState(cm);
    if (motion) {
      var motionResult = motions[motion](cm, origHead, motionArgs, vim);
      vim.lastMotion = motions[motion];
      if (!motionResult) {
        return;
      }
      if (motionArgs.toJumplist) {
        var jumpList = vimGlobalState.jumpList;
        // if the current motion is # or *, use cachedCursor
        var cachedCursor = jumpList.cachedCursor;
        if (cachedCursor) {
          recordJumpPosition(cm, cachedCursor, motionResult);
          delete jumpList.cachedCursor;
        } else {
          recordJumpPosition(cm, origHead, motionResult);
        }
      }
      if (motionResult instanceof Array) {
        newAnchor = motionResult[0];
        newHead = motionResult[1];
      } else {
        newHead = motionResult;
      }
      // TODO: Handle null returns from motion commands better.
      if (!newHead) {
        newHead = copyCursor(origHead);
      }
      if (vim.visualMode) {
        if (!(vim.visualBlock && newHead.ch === Infinity)) {
          newHead = clipCursorToContent(cm, newHead, vim.visualBlock);
        }
        if (newAnchor) {
          newAnchor = clipCursorToContent(cm, newAnchor, true);
        }
        newAnchor = newAnchor || oldAnchor;
        sel.anchor = newAnchor;
        sel.head = newHead;
        updateCmSelection(cm);
        updateMark(cm, vim, '<', cursorIsBefore(newAnchor, newHead) ? newAnchor : newHead);
        updateMark(cm, vim, '>', cursorIsBefore(newAnchor, newHead) ? newHead : newAnchor);
      } else if (!operator) {
        newHead = clipCursorToContent(cm, newHead);
        cm.setCursor(newHead.line, newHead.ch);
      }
    }
    if (operator) {
      if (operatorArgs.lastSel) {
        // Replaying a visual mode operation
        newAnchor = oldAnchor;
        var lastSel = operatorArgs.lastSel;
        var lineOffset = Math.abs(lastSel.head.line - lastSel.anchor.line);
        var chOffset = Math.abs(lastSel.head.ch - lastSel.anchor.ch);
        if (lastSel.visualLine) {
          // Linewise Visual mode: The same number of lines.
          newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch);
        } else if (lastSel.visualBlock) {
          // Blockwise Visual mode: The same number of lines and columns.
          newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch + chOffset);
        } else if (lastSel.head.line == lastSel.anchor.line) {
          // Normal Visual mode within one line: The same number of characters.
          newHead = Pos(oldAnchor.line, oldAnchor.ch + chOffset);
        } else {
          // Normal Visual mode with several lines: The same number of lines, in the
          // last line the same number of characters as in the last line the last time.
          newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch);
        }
        vim.visualMode = true;
        vim.visualLine = lastSel.visualLine;
        vim.visualBlock = lastSel.visualBlock;
        sel = vim.sel = {
          anchor: newAnchor,
          head: newHead,
        };
        updateCmSelection(cm);
      } else if (vim.visualMode) {
        operatorArgs.lastSel = {
          anchor: copyCursor(sel.anchor),
          head: copyCursor(sel.head),
          visualBlock: vim.visualBlock,
          visualLine: vim.visualLine,
        };
      }
      var curStart, curEnd, linewise, mode;
      var cmSel;
      if (vim.visualMode) {
        // Init visual op
        curStart = cursorMin(sel.head, sel.anchor);
        curEnd = cursorMax(sel.head, sel.anchor);
        linewise = vim.visualLine || operatorArgs.linewise;
        mode = vim.visualBlock ? 'block' : linewise ? 'line' : 'char';
        cmSel = makeCmSelection(
          cm,
          {
            anchor: curStart,
            head: curEnd,
          },
          mode,
        );
        if (linewise) {
          var ranges = cmSel.ranges;
          if (mode == 'block') {
            // Linewise operators in visual block mode extend to end of line
            for (var i = 0; i < ranges.length; i++) {
              ranges[i].head.ch = lineLength(cm, ranges[i].head.line);
            }
          } else if (mode == 'line') {
            ranges[0].head = Pos(ranges[0].head.line + 1, 0);
          }
        }
      } else {
        // Init motion op
        curStart = copyCursor(newAnchor || oldAnchor);
        curEnd = copyCursor(newHead || oldHead);
        if (cursorIsBefore(curEnd, curStart)) {
          var tmp = curStart;
          curStart = curEnd;
          curEnd = tmp;
        }
        linewise = motionArgs.linewise || operatorArgs.linewise;
        if (linewise) {
          // Expand selection to entire line.
          expandSelectionToLine(cm, curStart, curEnd);
        } else if (motionArgs.forward) {
          // Clip to trailing newlines only if the motion goes forward.
          clipToLine(cm, curStart, curEnd);
        }
        mode = 'char';
        var exclusive = !motionArgs.inclusive || linewise;
        cmSel = makeCmSelection(
          cm,
          {
            anchor: curStart,
            head: curEnd,
          },
          mode,
          exclusive,
        );
      }
      cm.setSelections(cmSel.ranges, cmSel.primary);
      vim.lastMotion = null;
      operatorArgs.repeat = repeat; // For indent in visual mode.
      operatorArgs.registerName = registerName;
      // Keep track of linewise as it affects how paste and change behave.
      operatorArgs.linewise = linewise;
      var operatorMoveTo = operators[operator](cm, operatorArgs, cmSel.ranges, oldAnchor, newHead);
      if (vim.visualMode) {
        exitVisualMode(cm, operatorMoveTo != null);
      }
      if (operatorMoveTo) {
        cm.setCursor(operatorMoveTo);
      }
    }
  };

  recordLastEdit = (vim, inputState, actionCommand) => {
    var macroModeState = vimGlobalState.macroModeState;
    if (macroModeState.isPlaying) {
      return;
    }
    vim.lastEditInputState = inputState;
    vim.lastEditActionCommand = actionCommand;
    macroModeState.lastInsertModeChanges.changes = [];
    macroModeState.lastInsertModeChanges.expectCursorActivityForChange = false;
    macroModeState.lastInsertModeChanges.visualBlock = vim.visualBlock
      ? vim.sel.head.line - vim.sel.anchor.line
      : 0;
  };
}

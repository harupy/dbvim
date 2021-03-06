import keyMap from './keymap/defaultKeyMap';
import customKeyMap from './keymap/customKeyMap';

const findMatchType = (keys, cmdKeys) => {
  if (cmdKeys.slice(-11) === '<character>') {
    // Last character matches anything.
    const prefixLen = cmdKeys.length - 11;
    const pressedPrefix = keys.slice(0, prefixLen);
    const mappedPrefix = cmdKeys.slice(0, prefixLen);

    /*
     * Examples:
     * - keys: 'iw', cmdKeys: 'i<character>' => 'full'
     * - keys: 'i', cmdKeys: 'i<character>' => 'partial'
     * - keys: 'd', cmdKeys: 'i<character>' => false
     */
    return pressedPrefix === mappedPrefix && keys.length > prefixLen
      ? 'full'
      : mappedPrefix.indexOf(pressedPrefix) == 0
      ? 'partial'
      : false;
  } else {
    /*
     * Examples:
     * - keys: 'gj', cmdKeys: 'gj' => 'full'
     * - keys: 'g', cmdKeys: 'gj' => 'partial'
     * - keys: 'k', cmdKeys: 'gj' => false
     */
    return keys === cmdKeys ? 'full' : cmdKeys.indexOf(keys) === 0 ? 'partial' : false;
  }
};

const findCommandMatches = (keys, context, inputState) => {
  const keysMapped = keys in customKeyMap ? customKeyMap[keys] : keys;

  // Some key have multiple command types
  const partial = [];
  const full = [];
  keyMap.forEach(cmd => {
    const matchType = findMatchType(keysMapped, cmd.keys);
    if (
      (context == 'insert' && cmd.context != 'insert') ||
      (cmd.context && cmd.context != context) ||
      (inputState.operator && cmd.type == 'action') ||
      !matchType
    ) {
      return;
    }
    if (matchType === 'partial') {
      partial.push(cmd);
    }
    if (matchType === 'full') {
      full.push(cmd);
    }
  });

  return {
    partial: partial.length && partial,
    full: full.length && full,
  };
};

export default (keys, context, inputState) => {
  const matches = findCommandMatches(keys, context, inputState);
  if (!matches.full && !matches.partial) {
    return { type: 'none' };
  } else if (!matches.full && matches.partial) {
    return { type: 'partial' };
  }

  const match = matches.full[0];

  if (match.keys.slice(-11) == '<character>') {
    const character = keys.slice(-1)[0];
    if (!character) return { type: 'none' };
    if (match.motionArgs) {
      match.motionArgs.charToMatch = character;
    }
  }
  return { type: 'full', command: match };
};

import customKeyMap from './customKeyMap';

export default (keys, keyMap, context) => {
  const keys_ = keys in customKeyMap ? customKeyMap[keys] : keys;

  if (/^i(.)$/.test(keys_)) {
    const match = /^i(.)/.exec(keys_);

    return {
      keys_,
      type: 'motion',
      motion: 'textObjectManipulation',
      motionArgs: { textObjectInner: true, selectedCharacter: match[1] },
    };
  } else if (/^a(.)$/.test(keys_)) {
    const match = /^a(.)/.exec(keys_);
    return {
      keys_,
      type: 'motion',
      motion: 'textObjectManipulation',
      motionArgs: { textObjectInner: false, selectedCharacter: match[1] },
    };
  }
  // Some key have multiple command types
  const cmds = keyMap.filter(cmd => cmd.keys === keys_);

  if (cmds.length === 0) return undefined;

  return cmds.length === 1 ? cmds[0] : cmds.filter(cmd => cmd.context === context)[0];
};

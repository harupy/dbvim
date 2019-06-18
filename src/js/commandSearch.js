import customKeyMap from './customKeyMap';

export default (keys, keyMap, context) => {
  const keys_ = keys in customKeyMap ? customKeyMap[keys] : keys;
  // Some key have multiple command types
  const cmds = keyMap.filter(cmd => cmd.keys === keys_);

  if (cmds.length === 0) return undefined;

  return cmds.length === 1 ? cmds[0] : cmds.filter(cmd => cmd.context === context)[0];
};

export default (keys, keyMap, context) => {
  // Some key have mutiple command types
  const cmds = keyMap.filter(cmd => cmd.keys === keys);
  return cmds.length > 1 ? cmds.filter(cmd => cmd.context === context)[0] : cmds[0];
};

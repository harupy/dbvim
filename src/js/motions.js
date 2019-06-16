export default {
  moveByCharacters: function(_cm, head, motionArgs) {
    const cur = head;
    const repeat = motionArgs.repeat;
    const ch = motionArgs.forward ? cur.ch + repeat : cur.ch - repeat;
    return _cm.setCursor({ ch, line: cur.line });
  },
};

export default class InputState {
  constructor() {
    this.lastEditKeySeq = [];
    this.initAll();
  }

  initAll = () => {
    this.initLastKey();
    this.initMotion();
    this.initOperator();
    this.initKeyBuffer();
    this.initKeySeq();
    this.initRepeat();
  };

  initMotion = () => {
    this.motion = null;
    this.motionArgs = null;
  };

  initLastKey = () => {
    this.lastKey = '';
  };

  initOperator = () => {
    this.operator = null;
    this.operatorArgs = null;
  };

  initKeyBuffer = () => {
    this.keyBuffer = [];
  };

  initKeySeq = () => {
    this.keySeq = [];
  };

  initRepeat = () => {
    this.repeat = 1;
  };

  appendKeyBuffer = key => {
    this.keyBuffer.push(key);
  };

  popKeyBuffer = () => {
    this.keyBuffer.pop();
  };

  appendKeySeq = key => {
    this.keySeq.push(key);
  };

  updateLastEditKeySeq = () => {
    this.lastEditKeySeq = [...this.keySeq];
  };

  joinKeyBuffer = () => {
    return this.keyBuffer.join('');
  };

  setOperator = operator => {
    this.operator = operator;
  };

  setOperatorArgs = operatorArgs => {
    this.operatorArgs = operatorArgs;
  };

  setMotion = motion => {
    this.motion = motion;
  };

  setMotionArgs = motionArgs => {
    this.motionArgs = motionArgs;
  };

  setRegisterName = registerName => {
    this.registerName = registerName;
  };

  setLastKey = key => {
    this.lastKey = key;
  };

  setRepeat = repeat => {
    this.repeat = repeat;
  };
}

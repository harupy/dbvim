export default class InputState {
  constructor() {
    this.initialize();
  }

  initialize = () => {
    this.prefixRepeat = [];
    this.motionRepeat = [];

    this.operator = null;
    this.operatorArgs = null;
    this.motion = null;
    this.motionArgs = null;
    this.keyBuffer = []; // For matching multi-key commands.
    this.registerName = null; // Defaults to the unnamed register.
  };

  appendKeyBuffer = key => {
    this.keyBuffer.append(key);
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
}

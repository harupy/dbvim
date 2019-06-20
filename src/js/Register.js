export default class Register {
  constructor() {
    this.text = '';
    this.linewise = false;
  }
  setText = text => {
    this.text = text;
  };
  setLinewise = linewise => {
    this.linewise = linewise;
  };
}

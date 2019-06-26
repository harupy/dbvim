export const isChar = key => {
  return key.length === 1;
};

export const isAlphabet = key => {
  return /[a-zA-Z]/.test(key);
};

export const toVimKey = key => {
  if (key.charAt(0) === "'") {
    return key.slice(1, -1);
  }

  if (isChar(key)) {
    if (isAlphabet) {
      return key.toLowerCase();
    } else {
      return key;
    }
  }

  // process a key combination (e.g. shift-m, ctrl-e)
  const pieces = key.split('-');

  if (pieces.length == 2) {
    const [modKey, normKey] = pieces;

    if (modKey === normKey) {
      return modKey;
    }

    // process shift - <alphabet> combination
    if (modKey.toLowerCase() === 'shift') {
      if (isChar(normKey) && isAlphabet(normKey)) {
        return normKey.toUpperCase();
      }
    }
  }
};

export const splitKeys = keys => {
  const isMultiple = !keys.startsWith('<') && keys.length > 1;
  return isMultiple ? keys.split('') : [keys];
};

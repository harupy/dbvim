export const enableFatCursor = () => {
  const callback = () => {
    const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

    if (cursor && !cursor.classList.contains('cm-fat-cursor')) {
      cursor.classList.add('cm-fat-cursor');
    }
  };

  window.setTimeout(callback, 0);
};

export const disableFatCursor = () => {
  const callback = () => {
    const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

    if (cursor && cursor.classList.contains('cm-fat-cursor')) {
      cursor.classList.remove('cm-fat-cursor');
    }
  };
  window.setTimeout(callback, 0);
};

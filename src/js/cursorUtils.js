export const enableFatCursor = () => {
  const cursor = document.querySelector('div.is-editing div.CodeMirror-cursor');

  if (!cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.add('cm-fat-cursor');
  }
};

export const disableFatCursor = () => {
  const cursor = document.querySelector('div.CodeMirror-cursor');

  if (cursor.classList.contains('cm-fat-cursor')) {
    cursor.classList.remove('cm-fat-cursor');
  }
};

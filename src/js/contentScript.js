(() => {
  const s = document.createElement('script');
  s.src = chrome.extension.getURL('./dist/main.js');
  (document.head || document.documentElement).appendChild(s);
})();

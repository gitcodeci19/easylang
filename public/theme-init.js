/* Synchronously disable the light-theme stylesheet before first paint when Night Mode is active. */
(function () {
  try {
    var saved = window.localStorage.getItem('lingoex_theme');
    var mode = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = mode;
    var lightLink = document.getElementById('theme-light-css');
    if (lightLink) {
      lightLink.disabled = mode === 'dark';
    }
  } catch (_err) {
    // Ignore storage restriction errors
  }
})();

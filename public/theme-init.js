// Runs before the first paint (loaded as a blocking script in <head>) so the saved
// theme is applied with no flash. Mirrors src/lib/theme.ts; key: ev-cost:theme.
;(function () {
  var pref = 'system'
  try {
    var saved = window.localStorage.getItem('ev-cost:theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved
  } catch {
    // storage blocked: follow the system
  }
  var dark =
    pref === 'dark' ||
    (pref === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  var theme = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0c0c0d' : '#f6f6f5')
})()

const { remote } = require('electron');

const resumeButton = document.getElementById('resume');

resumeButton.addEventListener('click', () => {
  const win = remote.getCurrentWindow();
  // Lose focus before closing setup modal to prevent screen flash
  win.blur();
  // Destroy it directly since this is a non-closeable window
  win.destroy();
});

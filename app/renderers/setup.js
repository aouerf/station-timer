const {ipcRenderer, remote} = require('electron');

const setupForm = document.forms.namedItem('setup');
const exitButton = document.getElementById('exit');

Array.from(document.querySelectorAll('input[type="number"]')).forEach(input => {
  input.addEventListener('input', () => {
    // The handling of empty inputs is done in CSS. If the input is not
    // empty and the value is an empty string, that means the input is
    // invalid.
    let valid = input.value !== '' &&
      (Number.isInteger(Number(input.value))
        && (input.min === '' ||
            parseInt(input.value, 10) >= parseInt(input.min, 10))
        && (input.max === '' ||
            parseInt(input.value, 10) <= parseInt(input.max, 10)));

    input.classList.toggle('error', !valid);
  });
});

setupForm.addEventListener('submit', evt => {
  evt.preventDefault();

  ipcRenderer.send(
    'setup-timer',
    Object.assign(...Array.from(new FormData(setupForm))
      .map(([k, v]) => ({ [k]: v })))
  );

  let win = remote.getCurrentWindow();
  // Lose focus before closing setup modal to prevent screen flash
  win.blur();
  // Destroy it directly to bypass close event if not closed
  win.destroy();
});

exitButton.addEventListener('click', () => ipcRenderer.send('exit'));
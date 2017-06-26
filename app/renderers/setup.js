const { ipcRenderer, remote } = require('electron');

const setupForm = document.forms.namedItem('setup');
const setupFormInputs = Array.from(setupForm.querySelectorAll('input[type="number"]'));

const checkValidInput = (value, min, max) =>
  // The handling of empty inputs is done in CSS. If the input is not empty and
  // the value is an empty string, that means the input is invalid.
  value !== '' &&
    (Number.isSafeInteger(Number(value))
      && (min === '' ||
          parseInt(value, 10) >= parseInt(min, 10))
      && (max === '' ||
          parseInt(value, 10) <= parseInt(max, 10)));

setupFormInputs.forEach((input) => {
  input.addEventListener('input', () => {
    const valid = checkValidInput(input.value, input.min, input.max);
    input.classList.toggle('error', !valid);
  });
});

setupForm.addEventListener('submit', (evt) => {
  evt.preventDefault();

  // Return early (don't finish submitting the form) if not all inputs are valid
  if (setupFormInputs.every((input) => {
    const invalid = input.classList.contains('error');
    // If any of the form inputs contain errors, focus on it
    if (invalid) input.focus();
    return invalid;
  })) {
    return;
  }

  ipcRenderer.send('setup-timer',
    Object.assign(...Array.from(new FormData(setupForm))
      .map(([k, v]) => ({ [k]: v }))));

  const win = remote.getCurrentWindow();
  // Lose focus before closing setup modal to prevent screen flash
  win.blur();
  // Destroy it directly to bypass close event if not closed
  win.destroy();
});

document.querySelector('#exit').setAction(() => ipcRenderer.send('exit'));

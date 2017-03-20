const { ipcRenderer, remote } = require('electron');

const webContents = remote.getCurrentWebContents();

const domElements = {
  counterTextView: document.getElementById('counter'),
  secondProgressBar: document.getElementById('progress'),
  infoTextView: document.getElementById('info'),
  pauseButton: document.getElementById('pause'),
  restartButton: document.getElementById('restart'),
  muteOnButton: document.getElementById('mute-on'),
  muteOffButton: document.getElementById('mute-off'),
  exitButton: document.getElementById('exit'),
};

const beepAudio = new Audio('../assets/audio/beep.wav');

// Object containing strings used in the counter
const text = {
  counterText: {
    end: '0',
  },
  infoText: {
    active: 'Complete your activity',
    coolDown: 'Go to your next station',
    complete: 'Return to your original station',
  },
};

// Object containing values for duration, break duration and number of repeats
let settings;

// Flag indicating whether or not the program is currently in a paused state
let paused = false;

domElements.pauseButton.addEventListener('click', () => {
  paused = true;
  ipcRenderer.send('pause');
});

domElements.restartButton.addEventListener('click', () => webContents.send('start-timer', settings));

domElements.muteOnButton.addEventListener('click', () => {
  webContents.setAudioMuted(true);
  domElements.muteOnButton.parentElement.style.display = 'none';
  domElements.muteOffButton.parentElement.style.display = '';
});

domElements.muteOffButton.addEventListener('click', () => {
  webContents.setAudioMuted(false);
  domElements.muteOffButton.parentElement.style.display = 'none';
  domElements.muteOnButton.parentElement.style.display = '';
});

domElements.exitButton.addEventListener('click', () => ipcRenderer.send('exit'));

// Since the counter has no pointer events when counting, this will only
// trigger at the end when the end class is added to the counter, which
// enables pointer events.
domElements.counterTextView.addEventListener('click', () => ipcRenderer.send('exit'));

/**
 * This function allows us to use Promises with generator functions, much like
 * the async/await feature in ES7 (not supported in Electron v1.4.13). This
 * allows us to write asyncronous code that looks similar to syncronous code.
 * The basis for this function was derived from Jake Archibald's
 * [JavaScript Promises: an Introduction]{@link https://developers.google.com/web/fundamentals/getting-started/primers/promises#bonus_round_promises_and_generators}.
 *
 * @param  generatorFn the generator function that will yield Promises.
 */
const async = (generatorFn) => {
  const continuer = (verb, arg) => {
    let result;
    try {
      result = generator[verb](arg);
    } catch (err) {
      return Promise.reject(err);
    }
    return result.done ?
           result.value :
           Promise.resolve(result.value).then(onResolved, onRejected);
  };

  let generator = generatorFn();
  let onResolved = continuer.bind(continuer, 'next');
  let onRejected = continuer.bind(continuer, 'throw');
  return onResolved();
};

const skipTransition = (elements, action) => {
  // If a single element is given, place it in an array
  if (elements.constructor !== Array) {
    elements = [elements];
  }
  // Run the action function if it is given
  if (typeof action === 'function') {
    action();
  }
  elements.forEach(element => {
    element.classList.add('skip-transition');
    element.offsetHeight; // Trigger CSS reflow to flush changes
    element.classList.remove('skip-transition');
  });
};

const setProgressBar = () => {
  skipTransition(domElements.secondProgressBar, () =>
    domElements.secondProgressBar.classList.remove('expand'));
  domElements.secondProgressBar.classList.add('expand');
};

const getFormattedTime = (seconds) => {
  // Get units of time (from seconds up to hours)
  let hh = parseInt(seconds / 3600, 10);
  let mm = parseInt((seconds % 3600) / 60, 10);
  let ss = parseInt(seconds % 60, 10);

  // Displaying or hiding units based on length of time (up to hours)
  hh = hh > 0 ? hh + ':' : '';
  mm = hh === '' && mm <= 0 ? '' :
       hh !== '' && mm < 10 ? '0' + mm + ':' : mm + ':';
  ss = mm === '' ? ss :
       ss < 10 ? '0' + ss : ss;

  return hh + mm + ss;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The pause-wait channel will return a value of false when the pause modal is
// closed, which we can set to the paused flag. When the flag is set, the
// Promise will be resolved.
const pauseWait = () => Promise.resolve(paused = ipcRenderer.sendSync('pause-wait'));

const countdown = (duration, view, onEachSecond) => {
  const action = () => {
    // Run the onEachSecond function if it is given
    if (typeof onEachSecond === 'function') {
      onEachSecond();
    }
    view.textContent = getFormattedTime(duration--);
  };

  return Promise.resolve(async(function* () {
    // We'll be decrementing duration each second in action()
    while (duration > 0) {
      if (paused) {
        yield pauseWait();
      } else {
        action();
        yield sleep(1000);
      }
    }
    // Check for pause before ending countdown
    if (paused) {
      yield pauseWait();
    }
  }));
};

ipcRenderer.on('start-timer', (evt, userSettings) => {
  const { duration, breakDuration, numRepeats } = userSettings;
  settings = userSettings;

  const resetTimer = () => {
    // Reset elements to their intended initial visibility
    domElements.restartButton.parentElement.style.display = 'none';
    domElements.pauseButton.parentElement.style.display = '';
    // Remove all classes from the views
    document.body.classList = '';
    domElements.counterTextView.classList = '';
    domElements.secondProgressBar.classList = '';
    domElements.infoTextView.classList = '';
  };

  const durationCountdown = () => {
    domElements.counterTextView.classList.remove('red');
    domElements.counterTextView.classList.add('primary');
    domElements.secondProgressBar.classList.remove('red');
    domElements.infoTextView.textContent = text.infoText.active;
    return countdown(duration, domElements.counterTextView, setProgressBar);
  };

  const breakDurationCountdown = () => {
    domElements.counterTextView.classList.remove('primary');
    domElements.counterTextView.classList.add('red');
    domElements.secondProgressBar.classList.add('red');
    domElements.infoTextView.textContent = text.infoText.coolDown;
    return countdown(breakDuration, domElements.counterTextView, () => {
      beepAudio.play();
      setProgressBar();
    });
  };

  const endTimer = () => {
    // Setting end classes
    domElements.secondProgressBar.classList.add('remove');
    skipTransition(domElements.counterTextView, () =>
      domElements.counterTextView.classList.remove('red'));
    domElements.counterTextView.classList.add('end');
    // Setting end text to views
    domElements.counterTextView.textContent = text.counterText.end;
    domElements.infoTextView.textContent = text.infoText.complete;
    // Setting end visibility for Action Buttons
    domElements.pauseButton.parentElement.style.display = 'none';
    domElements.restartButton.parentElement.style.display = '';
  };

  async(function* () {
    resetTimer();
    // Start the timer: repeat for however many stations there are
    for (let i = 0; i < numRepeats; i += 1) {
      yield durationCountdown();
      yield breakDurationCountdown();
    }
    endTimer();
  });
});

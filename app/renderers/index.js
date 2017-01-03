const {ipcRenderer, remote} = require('electron');
const webContents = remote.getCurrentWebContents();

const counterTextView = document.getElementById('counter');
const secondProgressBar = document.getElementById('progress');
const infoTextView = document.getElementById('info');
const pauseButton = document.getElementById('pause');
const restartButton = document.getElementById('restart');
const muteOnButton = document.getElementById('mute-on');
const muteOffButton = document.getElementById('mute-off');
const exitButton = document.getElementById('exit');

const beepAudio = new Audio('../assets/audio/beep.wav');

// Object containing strings used in the counter
const text = {
  counterText: {
    end: '0'
  },
  infoText: {
    active: 'Complete your activity',
    coolDown: 'Go to your next station',
    complete: 'Return to your original station'
  }
};

// Object containing values for duration, break duration and number of repeats
let settings;

// Flag indicating whether or not the program is currently in a paused state
let paused = false;

pauseButton.addEventListener('click', () => {
  paused = true;
  ipcRenderer.send('pause');
});

restartButton.addEventListener('click', () =>
  webContents.send('start-timer', settings)
);

muteOnButton.addEventListener('click', () => {
  webContents.setAudioMuted(true);
  muteOnButton.parentElement.style.display = 'none';
  muteOffButton.parentElement.style.display = '';
});

muteOffButton.addEventListener('click', () => {
  webContents.setAudioMuted(false);
  muteOffButton.parentElement.style.display = 'none';
  muteOnButton.parentElement.style.display = '';
});

exitButton.addEventListener('click', () =>
  ipcRenderer.send('exit')
);

counterTextView.addEventListener('click', () => {
  // Since the counter has no pointer events when counting, this will only
  // trigger at the end when the end class is added to the counter, which
  // enables pointer events.
  ipcRenderer.send('exit');
});

/**
 * This function allows us to use Promises with generator functions, much like
 * the async/await feature in ES7 (not supported in Electron v1.4.13). This
 * allows us to write asyncronous code that looks similar to syncronous code.
 * The basis for this function was derived from Jake Archibald's
 * [JavaScript Promises: an Introduction]{@link https://developers.google.com/web/fundamentals/getting-started/primers/promises#bonus_round_promises_and_generators}.
 *
 * @param  generatorFn the generator function that will yield Promises.
 */
function async (generatorFn) {
  function continuer(verb, arg) {
    let result;
    try {
      result = generator[verb](arg);
    } catch (err) {
      return Promise.reject(err);
    }
    return result.done ?
           result.value :
           Promise.resolve(result.value).then(onResolved, onRejected);
  }

  let generator = generatorFn();
  let onResolved = continuer.bind(continuer, 'next');
  let onRejected = continuer.bind(continuer, 'throw');
  return onResolved();
}

function skipTransition (elements, action) {
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
}

function setProgressBar () {
  skipTransition(secondProgressBar, () =>
    secondProgressBar.classList.remove('expand'));
  secondProgressBar.classList.add('expand');
}

function getFormattedTime (seconds) {
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
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pauseWait () {
  // The pause-wait channel will return a value of false when the pause modal is
  // closed, which we can set to the paused flag. When the flag is set, the
  // Promise will be resolved.
  return Promise.resolve(paused = ipcRenderer.sendSync('pause-wait'));
}

function countdown (duration, view, onEachSecond) {
  function action () {
    // Run the onEachSecond function if it is given
    if (typeof onEachSecond === 'function') {
      onEachSecond();
    }
    view.textContent = getFormattedTime(duration--);
  }

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
}

ipcRenderer.on('start-timer', (evt, userSettings) => {
  let {duration, breakDuration, numRepeats} = settings = userSettings;

  function resetTimer () {
    // Reset elements to their intended initial visibility
    restartButton.parentElement.style.display = 'none';
    pauseButton.parentElement.style.display = '';
    // Remove all classes from the views
    document.body.classList = '';
    counterTextView.classList = '';
    secondProgressBar.classList = '';
    infoTextView.classList = '';
  }

  function durationCountdown () {
    counterTextView.classList.remove('red');
    counterTextView.classList.add('primary');
    secondProgressBar.classList.remove('red');
    infoTextView.textContent = text.infoText.active;
    return countdown(duration, counterTextView, setProgressBar);
  }

  function breakDurationCountdown () {
    counterTextView.classList.remove('primary');
    counterTextView.classList.add('red');
    secondProgressBar.classList.add('red');
    infoTextView.textContent = text.infoText.coolDown;
    return countdown(breakDuration, counterTextView, () => {
      beepAudio.play();
      setProgressBar();
    });
  }

  function endTimer () {
    // Setting end classes
    secondProgressBar.classList.add('remove');
    skipTransition(counterTextView, () =>
      counterTextView.classList.remove('red'));
    counterTextView.classList.add('end');
    // Setting end text to views
    counterTextView.textContent = text.counterText.end;
    infoTextView.textContent = text.infoText.complete;
    // Setting end visibility for Action Buttons
    pauseButton.parentElement.style.display = 'none';
    restartButton.parentElement.style.display = '';
  }

  async(function* () {
    resetTimer();
    // Start the timer: repeat for however many stations there are
    for (let i = 0; i < numRepeats; i++) {
      yield durationCountdown();
      yield breakDurationCountdown();
    }
    endTimer();
  });
});

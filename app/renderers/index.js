const { ipcRenderer, remote } = require('electron');
const numberToWords = require('number-to-words');

const domElements = {
  remaining: document.getElementById('remaining'),
  counter: document.getElementById('counter'),
  progress: document.getElementById('progress'),
  info: document.getElementById('info'),
  buttons: {
    pause: document.getElementById('pause'),
    restart: document.getElementById('restart'),
    muteOn: document.getElementById('mute-on'),
    muteOff: document.getElementById('mute-off'),
    exit: document.getElementById('exit'),
  },
  audio: {
    beep: document.getElementById('beep'),
  },
};

// Object containing strings used in the counter
const text = {
  remaining: {
    multiple: ' stations remaining',
    single: 'Last station',
    none: 'No more stations',
  },
  counter: {
    end: '0',
  },
  info: {
    active: 'Complete your activity',
    coolDown: 'Go to your next station',
    complete: 'Return to your original station',
  },
};

// Object containing values for duration, break duration and number of repeats
let settings = null;

// Flag indicating whether or not the program is currently in a paused state
let paused = false;

// If a string is given and it is not empty, convert it to a "Sentence case" string
const toSentenceCase = str =>
  ((typeof str === 'string' && str.length > 0) ?
    str.charAt(0).toUpperCase() + str.substring(1).toLowerCase() :
    '');

// If a single element is given, place it in an array
const ensureArray = arr =>
  (Array.isArray(arr) ? arr : [arr]);

// Executes a function if it is given and if not then a noop function is executed
const optionalCallback = func =>
  (typeof func === 'function' ? func : () => {})();

const skipTransition = (elements, action) => {
  optionalCallback(action);
  ensureArray(elements).forEach((el) => {
    el.classList.add('skip-transition');
    (() => el.offsetHeight)(); // Trigger CSS reflow to flush changes
    el.classList.remove('skip-transition');
  });
};

const setProgressBar = () => {
  skipTransition(domElements.progress, () =>
    domElements.progress.classList.remove('expand'));
  domElements.progress.classList.add('expand');
};

const getFormattedTime = (seconds) => {
  // --- Get units of time (from seconds up to hours) ---
  let hh = parseInt(seconds / 3600, 10);
  let mm = parseInt((seconds % 3600) / 60, 10);
  let ss = parseInt(seconds % 60, 10);

  // --- Displaying or hiding units based on length of time (up to hours) ---
  // Hours
  if (hh > 0) {
    hh = `${hh}:`;
  } else {
    hh = '';
  }
  // Minutes
  if (hh === '' && mm <= 0) {
    mm = '';
  } else if (hh !== '' && mm < 10) {
    mm = `0${mm}:`;
  } else {
    mm = `${mm}:`;
  }
  // Seconds
  if (mm !== '' && ss < 10) {
    ss = `0${ss}`;
  }

  return `${hh}${mm}${ss}`;
};

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// The pause-wait channel will return a value of false when the pause modal is
// closed, which we can set to the paused flag. When the flag is set, the
// Promise will be resolved.
const pauseWait = () =>
  Promise.resolve(paused = ipcRenderer.sendSync('pause-wait'));

const countdown = (duration, counterView, onEachSecond) => {
  let currentSecond = duration;

  const action = () => {
    optionalCallback(onEachSecond);
    counterView.textContent = getFormattedTime(currentSecond);
    currentSecond -= 1;
  };


  return Promise.resolve((async () => {
    // The current second will be decremented each second in the action function
    while (currentSecond > 0) {
      if (paused) {
        await pauseWait();
      } else {
        action();
        await sleep(1000);
      }
    }

    // Check for pause before ending the countdown
    if (paused) {
      await pauseWait();
    }
  })());
};

domElements.buttons.pause.addEventListener('click', () => {
  paused = true;
  ipcRenderer.send('pause');
});

domElements.buttons.restart.addEventListener('click', () => remote.getCurrentWebContents().send('start-timer', settings));

domElements.buttons.muteOn.addEventListener('click', () => {
  remote.getCurrentWebContents().setAudioMuted(true);
  domElements.buttons.muteOn.parentElement.style.display = 'none';
  domElements.buttons.muteOff.parentElement.style.display = '';
});

domElements.buttons.muteOff.addEventListener('click', () => {
  remote.getCurrentWebContents().setAudioMuted(false);
  domElements.buttons.muteOff.parentElement.style.display = 'none';
  domElements.buttons.muteOn.parentElement.style.display = '';
});

domElements.buttons.exit.addEventListener('click', () => ipcRenderer.send('exit'));

// Since the counter has no pointer events when counting, this will only
// trigger at the end when the end class is added to the counter, which
// enables pointer events.
domElements.counter.addEventListener('click', () => ipcRenderer.send('exit'));

ipcRenderer.on('start-timer', (evt, userSettings) => {
  const { duration, breakDuration, numRepeats } = userSettings;
  settings = userSettings;

  const resetTimer = () => {
    // Reset elements to their intended initial visibility
    domElements.buttons.restart.parentElement.style.display = 'none';
    domElements.buttons.pause.parentElement.style.display = '';
    // Remove all classes from the views
    document.body.classList = '';
    domElements.counter.classList = '';
    domElements.progress.classList = '';
    domElements.info.classList = '';
  };

  const durationCountdown = () => {
    domElements.counter.classList.remove('red');
    domElements.counter.classList.add('primary');
    domElements.progress.classList.remove('red');
    domElements.info.textContent = text.info.active;
    return countdown(duration, domElements.counter, setProgressBar);
  };

  const breakDurationCountdown = () => {
    domElements.counter.classList.remove('primary');
    domElements.counter.classList.add('red');
    domElements.progress.classList.add('red');
    domElements.info.textContent = text.info.coolDown;
    return countdown(breakDuration, domElements.counter, () => {
      domElements.audio.beep.play();
      setProgressBar();
    });
  };

  const endTimer = () => {
    // Setting end classes
    domElements.progress.classList.add('remove');
    skipTransition(domElements.counter, () =>
      domElements.counter.classList.remove('red'));
    domElements.counter.classList.add('end');
    // Setting end text to views
    domElements.counter.textContent = text.counter.end;
    domElements.info.textContent = text.info.complete;
    // Setting end visibility for Action Buttons
    domElements.buttons.pause.parentElement.style.display = 'none';
    domElements.buttons.restart.parentElement.style.display = '';
  };

  const setRemainingText = (stationsLeft) => {
    let stationsLeftText = '';
    // Determine text to be displayed on the stations remaining counter
    // The text is based on the number of stations left
    if (stationsLeft === 0) {
      stationsLeftText = text.remaining.none;
    } else if (stationsLeft === 1) {
      stationsLeftText = text.remaining.single;
    } else {
      // Concatenate the word form of the number of stations left with the text
      stationsLeftText = toSentenceCase(numberToWords.toWords(stationsLeft));
      stationsLeftText += text.remaining.multiple;
    }
    // Set the calculated text to the stations remaining counter view
    domElements.remaining.textContent = stationsLeftText;
  };

  const countdownAction = async () => {
    await durationCountdown();
    await breakDurationCountdown();
  };

  (async () => {
    resetTimer();
    for (let stationsLeft = numRepeats; stationsLeft > 0; stationsLeft -= 1) {
      setRemainingText(stationsLeft);
      await countdownAction();
      // This is called here to update the counter text before the loop is broken
      setRemainingText(stationsLeft - 1);
    }
    endTimer();
  })();
});

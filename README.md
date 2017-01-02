# Station Timer

A minimal timer application built with [Electron](http://electron.atom.io) that
counts down and loops for a given number of stations. This was originally
created for a classroom environment, where the instructor would have a number of
stations set up and would allocate a certain amount of time to stay at each
station, and would then give some additional time to clean up and go to the next
station.

## Releases (NOT AVAILABE YET)
There are builds available for Windows and macOS, since those are the only
platforms I am able to use and test on at the moment. If you would like to
build for your own platform, you can follow the steps [below](#Build).

## Build
To build for your specific platform:
```sh
git clone https://github.com/aouerfelli/station-timer.git
cd station-timer
npm install && npm run dist
```
Your build should be located in the `dist` directory if the build was
successful.

To customize the build, see the different options available in
[electron-builder](https://github.com/electron-userland/electron-builder/wiki/Options).

## Run
If you would like to run the code directly instead of building it:
```sh
git clone https://github.com/aouerfelli/station-timer.git
cd station-timer
npm install && npm start
```

## License
[MIT](LICENSE)

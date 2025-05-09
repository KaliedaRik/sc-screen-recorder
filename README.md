# Scrawl-canvas screen recorder
Record your local screen using your browser.

This is a proof-of-concept project. Feel free to fork-and-amend to suit your own requirements!

## Development (aka: running the page locally)
1. Fork or clone this repo
2. Navigate to the downloaded folder
3. Don't bother installing anything - there's no build chain because: it's just a web page
4. Start a local server to serve the page locally - for example, [live-server](https://github.com/tapio/live-server) seems to do a decent job.
5. Hack away!

### Key files
The page's HTML code can be found in the  in the `index.html` file, while the CSS code lurks in the `index.css` file.

The page functionality lives in the `index.js` file. There's no tool chain or build steps associated with this repo - the file "is what it is", nothing more.

The code relies on the [Scrawl-canvas](https://github.com/KaliedaRik/Scrawl-canvas) library, the minified version of which can be found in the `js/scrawl-canvas.js` file. Because there's no tool chain, updating SC means grabbing the latest minified version of the file and slapping it into the `js/` folder.

### Known issues
+ The proof-of-concept makes use of the [Media Capture and Streams](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API) API's [getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) function, which is not widely supported. It should work on latest desktop Chrome/Edge/Firefox/Safari, but will currently fail on Android Chrome, iOS Safari, etc. See the [Can I Use website](https://caniuse.com/?search=getDisplayMedia) for latest details.

+ The proof-of-concept makes use of Google's selfie-segmentation [MediaPipe solution](https://ai.google.dev/edge/mediapipe/solutions/guide). The code is not very efficient at the moment ... but needs must.


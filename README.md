# Scrawl-canvas screen recorder
Record your local screen using your browser.

### Use case(s)
The main use case for this product is for **bug reporting**. When a user encounters an issue with a website (or other product) they can navigate to this web page and screen capture the issue:
+ Add multiple "targets" (screen captures of various parts of their display) and rearrange them on the canvas to best demonstrate the issue they are facing.
+ Change the canvas background color, or use an image to act as the background (in case they don't want people to see their real screen background).
+ Include a "talking head" of themselves describing the problem.
+ Record their report in their preferred dimensions and resolutions: landscape (16:9); square (1:1); portrait (9:16).
+ Once the recording is done, the video downloads to the user's local device for further processing (if required) and sharing.

This code is supplied as a Minimum Viable Product. It has not been built for the generation of professional-grade video assets. You have been warned!

## Instructions
TODO: write up a simple guide

## Development (aka: running the page locally)
1. Fork or clone this repo
2. Navigate to the downloaded folder
3. Don't bother installing anything - there's no build chain because: it's just a web page
4. Start a local server to serve the page locally - for example, [live-server](https://github.com/tapio/live-server) seems to do a decent job.
5. Hack away!

### Self hosting the web page
The web page is hosted on GitHub - [kaliedarik.github.io/sc-screen-recorder](https://kaliedarik.github.io/sc-screen-recorder/):
+ Designed for use on the desktop; use on mobile devices is not in-scope for this MVP.
+ Keyboard accessibility is definitely in-scope!
+ Built in vanilla HTML, CSS and Javascript. No frameworks. No toolchains.
+ No sign-in or registration required. Also: no tracking!
+ The web page can be self hosted by forking this repo and deploying to the user's own servers or, alternatively, run locally on the user's device. The code is offered free under the MIT licence.
+ Users are free to develop and improve the code in any way they see fit. If anyone wants to build a better product from this code (and monetise it) ... go for it!

### Key files
The page's HTML code can be found in the  in the `index.html` file, while the CSS code lurks in the `index.css` file.

The page functionality lives in the `index.js` file. There's no tool chain or build steps associated with this repo - the file "is what it is", nothing more.

The code relies on the [Scrawl-canvas](https://github.com/KaliedaRik/Scrawl-canvas) library, the minified version of which can be found in the `js/scrawl-canvas.js` file. Because there's no tool chain, updating SC means grabbing the latest minified version of the file and slapping it into the `js/` folder.

### Known issues
+ The proof-of-concept makes use of the [Media Capture and Streams](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API) API's [getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) function, which is not widely supported. It should work on latest desktop Chrome/Edge/Firefox/Safari, but will currently fail on Android Chrome, iOS Safari, etc. See the [Can I Use website](https://caniuse.com/?search=getDisplayMedia) for latest details.

+ The proof-of-concept makes use of Google's selfie-segmentation [MediaPipe solution](https://ai.google.dev/edge/mediapipe/solutions/guide). The code is not very efficient at the moment ... but needs must.


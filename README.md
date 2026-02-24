# Scrawl-canvas screen recorder
Record your screen directly in the browser. No installs. No sign-ins. No tracking.

This lightweight tool was built to make screen recording effortless and private — ideal for situations where installing software isn’t practical or desirable.

### Key Features
**Multi-Target Recording:** Users can capture multiple areas of their screen simultaneously and arrange them on a canvas to highlight specific issues.

**Customizable Backgrounds:** The canvas background can be changed to a solid color or an image, allowing users to obscure sensitive information or personalize their recordings.

**Picture-in-Picture Support:** Users can include a "talking head" video overlay, enabling them to narrate and explain the issue as it occurs.

**Flexible Output Formats:** Recordings can be made in various aspect ratios, including landscape (16:9), square (1:1), and portrait (9:16), catering to different presentation needs.

**Local Download:** Upon completion, the recorded video is downloaded directly to the user's device for easy sharing or further editing.

**Try it now: [kaliedarik.github.io/sc-screen-recorder](https://kaliedarik.github.io/sc-screen-recorder/).**

### Core Use Case: Bug Reporting
When something breaks, you can capture exactly what happened — your screen, tabs, and even a webcam overlay — and share the video with your team. It's faster and clearer than writing long explanations.

### Other Possible Use Cases
+ User testing: Record UX sessions with screen + narration
+ Micro-tutorials: Explain UI workflows or features
+ Support: Show what went wrong instead of just describing it
+ Code review walkthroughs: Walk through changes visually
+ Student demos: Record projects or presentations
+ Async collaboration: Share quick visual updates without meetings

### Privacy by Design
+ Everything runs in your browser
+ No data is uploaded — videos are saved locally
+ No accounts, cookies, or analytics

### Under the Hood
+ Built with vanilla JavaScript, HTML, and CSS
+ Entirely client-side
+ Open-source and self-hostable

## Self hosting the web page
+ Built in vanilla HTML, CSS and Javascript. No frameworks. No toolchains.
+ The web page can be self hosted by forking this repo and deploying to the user's own servers or, alternatively, run locally on the user's device. 
+ The code is offered free under the MIT licence. Users are free to develop, improve and even monetize the code in any way they see fit.

### Running the web page locally
1. Fork or clone this repo.
2. Navigate to the downloaded folder.
3. Don't bother installing anything - there's no build chain because: it's just a web page.
4. Start a local server to serve the page locally - for example, [live-server](https://github.com/tapio/live-server) seems to do a decent job.
5. Hack away!

### Key files
The page's HTML code can be found in the  in the `index.html` file, while the CSS code lurks in the `index.css` file.

The page functionality lives in the `index.js` file. There's no tool chain or build steps associated with this repo - the file "is what it is", nothing more.

The code relies on the [Scrawl-canvas](https://github.com/KaliedaRik/Scrawl-canvas) library, the minified version of which can be found in the `js/scrawl-canvas.js` file. Because there's no tool chain, updating SC means grabbing the latest minified version of the file and slapping it into the `js/` folder.

The code also includes Google's selfie-segmentation [MediaPipe solution](https://ai.google.dev/edge/mediapipe/solutions/guide), for removing the background behind the talking head.

### Known issues
+ The MVP makes use of the [Media Capture and Streams](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API) API's [getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) function, which is not widely supported. It should work on latest desktop Chrome/Edge/Firefox/Safari, but will currently fail on Android Chrome, iOS Safari, etc. See the [Can I Use website](https://caniuse.com/?search=getDisplayMedia) for latest details.

+ The MVP video recording functionality is primitive - the video output is restricted to `video/webm` and `video/mp4`. Adding codec metadata to the mix is manual (and risky!)

+ Clicking outside a modal to close it is an experimental technology, currently not supported by Firefox or Safari - see [Caniuse Dialog closedby](https://caniuse.com/?search=dialog%20closedby) for latest support details.

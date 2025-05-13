# Scrawl-canvas screen recorder
Record your screen directly in the browser. No installs. No sign-ins. No tracking.

This lightweight tool was built to make screen recording effortless and private — ideal for situations where installing software isn’t practical or desirable.

### 📌 Key Features
**Multi-Target Recording:** Users can capture multiple areas of their screen simultaneously and arrange them on a canvas to highlight specific issues.

**Customizable Backgrounds:** The canvas background can be changed to a solid color or an image, allowing users to obscure sensitive information or personalize their recordings.

**Picture-in-Picture Support:** Users can include a "talking head" video overlay, enabling them to narrate and explain the issue as it occurs.

**Flexible Output Formats:** Recordings can be made in various aspect ratios, including landscape (16:9), square (1:1), and portrait (9:16), catering to different presentation needs.

**Local Download:** Upon completion, the recorded video is downloaded directly to the user's device for easy sharing or further editing.

**Try it now: [kaliedarik.github.io/sc-screen-recorder](https://kaliedarik.github.io/sc-screen-recorder/).**

### 🎯 Core Use Case: Bug Reporting
When something breaks, you can capture exactly what happened — your screen, tabs, and even a webcam overlay — and share the video with your team. It's faster and clearer than writing long explanations.

### 🔍 Other Use Cases
+ User testing: Record UX sessions with screen + narration
+ Micro-tutorials: Explain UI workflows or features
+ Support: Show what went wrong instead of just describing it
+ Code review walkthroughs: Walk through changes visually
+ Student demos: Record projects or presentations
+ Async collaboration: Share quick visual updates without meetings

### 🔐 Privacy by Design
+ Everything runs in your browser
+ No data is uploaded — videos are saved locally
+ No accounts, cookies, or analytics

### ⚙️ Under the Hood
+ Built with vanilla JavaScript, HTML, and CSS
+ Entirely client-side
+ Open-source and self-hostable

## Instructions
The following instructions assume the user is using a desktop (or laptop) setup.

| Image | Description |
|---|---|
| ![repo-01-onload](https://github.com/user-attachments/assets/f31d8ba4-0bc5-45d6-aca8-1fdecfa27d00) | Initial page load. Control buttons across the top will open dialog modals. The controls across the bottom of the screen are currently disabled. The recording area is in white, fitted into the responsive canvas. |
| ![repo-02-dimensions](https://github.com/user-attachments/assets/9b4a1fe4-c428-421a-9e1a-3b6bc5b5629f) | To set the recording area's dimensions, click on the **Dimensions** button. When changing dimensions, targets and background images will automatically update to accommodate the change (though the talking head, which has fixed dimensions, will not). Landscape, square and portrait dimensions are supported. |
| ![repo-03-target](https://github.com/user-attachments/assets/56c78016-9557-4db9-ac84-2953a81a2f9f) | Targets are areas of the user's display screen(s) to be real-time captured in the recording area. To aquire and manage targets, click on the **Targets** button. |
| ![repo-04-target](https://github.com/user-attachments/assets/ef669453-81a7-4b91-a543-0e9037f58fe0) | Click on the **Request screen capture** button to launch the browser's native screen-capture sharing modal. Select the desired target and press the **Share** (or equivalent) button. |
| ![repo-05-target](https://github.com/user-attachments/assets/8b166c5a-6760-4dc2-8a14-429ffadf8fa1) | Once a target has been selected an entry for it will appear in the Targets modal. Each screen capture can be halted by the user at any time, either by clicking on the target's **Remove** button, or by clicking on any other button the user's browser or operating system may supply. |
| ![repo-06-target](https://github.com/user-attachments/assets/fa6e941b-8d77-4100-8ba3-a335c4e1da57) | The user can drag-and-drop each target into the desired position on the recording area. Clicking on a target will enable the bottom controls for the target. Horizontal and vertical position ranges have been included for accessibility.  |
| ![repo-07-target](https://github.com/user-attachments/assets/f6a62c85-900e-42f8-8413-6e7cd1d9a6c8) | The target display in the recording area can be scaled and rotated as required. The display order of overlapping targets can also be controlled here. |
| ![repo-08-background](https://github.com/user-attachments/assets/98495616-b721-41bd-b275-6392496c0b62) | The recording area's background defaults to white. Click on the **Background** button to open the modal, and then the **Change background color** button to set the background color. |
| ![repo-09-background](https://github.com/user-attachments/assets/3a36d7a2-762a-4bc3-b580-19a9ec7ee260) | The recording area can also display a background image. To add an image, drag it into the web page - for success, make sure no modal is displaying at the time of the drag-drop action! Multiple images can be added using this method. Alternatively, click on the **Browse for image files** button to open a file selection modal. |
| ![repo-10-background](https://github.com/user-attachments/assets/15ae9ff2-d2dd-485c-bd65-dfc55b539c89) | Only one background image can be displayed at any time. To remove the current background image click on the **Hide background image** button. If multiple images have been uploaded, then the background image can be easily updated by clicking on the desired image. |
| ![repo-11-head](https://github.com/user-attachments/assets/96e14504-1e43-4132-944e-2cb4c35a7b0a) | By default the "talking head" functionality is disabled. To add a talking head, click on the **Head** button, select the desired camera in the drop-down selection box, then click on the **Use talking head** checkbox. |
| ![repo-12-head](https://github.com/user-attachments/assets/7a70b6df-d42f-46d1-869f-979f21c57d63) | Once the talking head appears, it can be positioned, scaled and rotated using the controls in the modal (note that it cannot be repositioned using drag-and-drop). The head can be hidden by unchecking the **Show talking head** checkbox. The video stream capturing the talking head can be halted at any time by unchecking the **Use talking head** checkbox, or stopping it using any other facility the user's browser or operating system may supply |
| ![repo-13-record](https://github.com/user-attachments/assets/7ab8bca4-3792-468f-867f-337d348852d5) | To record, click on the **Record** button, then select a microphone to use for audio capture. Note that resulting video's format (currently "webm" or "mp4") needs to be set before recording starts. Then click on the **Start recording** button. |
|  ![repo-14-record](https://github.com/user-attachments/assets/478c1906-ce69-492b-94ee-63c1ebcd6161) | While recording, the **Record** button changes to a red **Stop recording** button. Click it to, well, stop recording. The recorded video will automatically download to the device where the web page is running. |

### Keyboard shortcuts
The web page supports the following (hopefully cross-browser standard) keyboard controls and shortcuts.

#### Keyboard Navigation: 
+ `TAB` to navigate forwards
+ `SHIFT+TAB` to navigate backwards
+ `ENTER` to select
 
#### Additional input controls:
+ For "select" inputs - `UP-ARROW`, `DOWN-ARROW`
+ For "range" inputs -  `RIGHT-ARROW`, `LEFT-ARROW` 
+ For "color" inputs - `UP-ARROW`, `RIGHT-ARROW`, `DOWN-ARROW`, `LEFT-ARROW`
+ For checkboxes - `SPACE`

## Self hosting the web page
+ Built in vanilla HTML, CSS and Javascript. No frameworks. No toolchains.
+ The web page can be self hosted by forking this repo and deploying to the user's own servers or, alternatively, run locally on the user's device. The code is offered free under the MIT licence.
+ Users are free to develop and improve the code in any way they see fit. If anyone wants to build a better product from this code (and monetise it) ... go for it!

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

### Known issues
+ The MVP makes use of the [Media Capture and Streams](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API) API's [getDisplayMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) function, which is not widely supported. It should work on latest desktop Chrome/Edge/Firefox/Safari, but will currently fail on Android Chrome, iOS Safari, etc. See the [Can I Use website](https://caniuse.com/?search=getDisplayMedia) for latest details.

+ The MVP makes use of Google's selfie-segmentation [MediaPipe solution](https://ai.google.dev/edge/mediapipe/solutions/guide). The code is not very efficient at the moment - don't shake your head too vigorously!

+ The MVP video recording functionality is primitive - the video output is restricted to `video/webm` and `video/mp4`. Adding codec metadata to the mix is manual (and risky!)

+ On initial visit to the web page the "Head" modal camera dropdown, and the "Record" modal microphone dropdown appear empty. This is because we don't request access to these things until further action is taken ("use head" and "start recording"). Everything seems to work, but it's not a nice UX.

+ Clicking outside a modal to close it is an experimental technology, currently not supported by Firefox or Safari - see [Caniuse Dialog closedby](https://caniuse.com/?search=dialog%20closedby) for latest support details.

#### Issues specific to Chrome desktop (Macbook Pro)
+ Everything works (except for the above comments) ... but that is expected as the web page was only tested on Chrome during initial development.

#### Issues specific to Safari desktop (Macbook Pro)
+ The MediaPipe Selfie-Segmentation model does not work on Safari desktop browsers - you'll get a talking head, but the background won't be removed.

#### Issues specific to Firefox desktop (Macbook Pro)
+ Drag-and-drop background image upload is buggy - files get loaded into the page, but don't display correctly. Same with file upload. User has to open the Background modal and click on the image to display it.
+ Firefox does not natively support encoding recordings into MP4 - see [issue 1631143 on Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1631143) for details.

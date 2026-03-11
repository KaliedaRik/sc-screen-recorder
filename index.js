// ------------------------------------------------------------------------
// Scrawl-canvas boilerplate
// ------------------------------------------------------------------------
import * as scrawl from './js/scrawl.js';
const name = (n) => `canvas-${n}`;
const canvas = scrawl.findCanvas('my-canvas');


// ------------------------------------------------------------------------
// MediaPipe and client-zip imports
// ------------------------------------------------------------------------
import * as MediaPipe from './js/mediapipe-vision-bundle.js';
import { downloadZip } from './js/client-zip.js';


// ------------------------------------------------------------------------
// Camera and Audio device discovery
// ------------------------------------------------------------------------
const DeviceManager = {

  microphones: [],
  cameras: [],
  permissionGranted: false,
  onChangeCallbacks: [],

  // Subscribe listeners (UI rebuilds, etc.)
  onChange(fn) {

    if (typeof fn === 'function') this.onChangeCallbacks.push(fn);
  },

  // Trigger callbacks
  triggerChange() {

    const payload = {
      microphones: this.microphones,
      cameras: this.cameras,
      permissionGranted: this.permissionGranted,
    };
    this.onChangeCallbacks.forEach(fn => fn(payload));
  },

  // Request permission without async/await
  // (Runs only once, then resolved permanently)
  ensurePermission() {

    const self = this;

    if (self.permissionGranted) {
      return Promise.resolve('permission-already-granted');
    }

    return navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {

        // Stop tracks immediately — we only needed the permission
        stream.getTracks().forEach(t => t.stop());

        self.permissionGranted = true;
        return 'permission-granted';
      })
      .catch(err => {
        return 'permission-denied';
      });
  },

  // Main enumeration function
  refreshDevices() {

    const self = this;

    // Step 1: ensure permission (optional)
    return self.ensurePermission()

      // Step 2: enumerate devices
      .then(() => navigator.mediaDevices.enumerateDevices())

      // Step 3: normalise lists
      .then(devices => {

        self.microphones = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({
            id: d.deviceId,
            label: d.label || 'Microphone',
          }));

        self.cameras = devices
          .filter(d => d.kind === 'videoinput')
          .map(d => ({
            id: d.deviceId,
            label: d.label || 'Camera',
          }));

        self.triggerChange();
        return 'refreshed';
      });
  }
};

// Hot-plug support
navigator.mediaDevices.addEventListener(
  'devicechange',
  () => DeviceManager.refreshDevices()
);

let selectedMicrophone = 'none',
  selectedCamera = 'none';

// Teleprompter state
let teleprompterIsVisible = false;
let teleprompterIsRunning = false;


// ------------------------------------------------------------------------
// Modal management
// ------------------------------------------------------------------------
let currentModal;

const openModal = (modal, fn = null) => {

  if (currentModal) closeModal();

  if (fn) fn();

  // Needs to be in a timeout because the keypress itself will launch a modal close event
  setTimeout(() => {

    if (!currentModal) {

      modal.showModal();
      currentModal = modal;
    }
  }, 100);
};

const closeModal = () => {

  const m = currentModal;
  currentModal = null;

  if (m) m.close();
};


// ------------------------------------------------------------------------
// Dimensions management modal
// - Defines 9 video output options, with the help of some magic numbers
// ------------------------------------------------------------------------
let currentDimension = 'landscape_480';

const initDimensions = () => {

  // Initialize DOM dimensions button and associated modal
  dimensionsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => openModal(dimensionsModal), dimensionsButton);
  scrawl.addNativeListener('click', closeModal, dimensionsCloseButton);
  scrawl.addNativeListener('close', closeModal, dimensionsModal);

  // We display the currently selected dimensions in the bottom right of the page
  currentCanvasDimensions.textContent = '854 by 480px';

  // Define the supported video dimensions
  // - Eack key has an array of three numbers representing [width, height, scaler]
  const magicDimensions = {

    landscape_1080: [1920, 1080, 1080],
    landscape_720: [1280, 720, 720],
    landscape_480: [854, 480, 480],
    square_1080: [1080, 1080, 1080],
    square_720: [720, 720, 720],
    square_480: [480, 480, 480],
    portrait_1080: [1080, 1920, 1080],
    portrait_720: [720, 1280, 720],
    portrait_480: [480, 854, 480],
  };

  // Some helper functions
  const getDimensions = (dim) => {

    const [width, height] = magicDimensions[dim];
    return [width, height];
  };

  const getScaler = (dim) => {

    return magicDimensions[dim][2];
  };

  // The main dimensions update function
  const update = () => {

    const newDimension = dimensionsSelector.value;

    if (newDimension !== currentDimension) {

      canvas.setBase({ dimensions: getDimensions(newDimension) });

      updateTargetScales(getScaler(currentDimension), getScaler(newDimension));

      currentDimension = newDimension;

      updateBackgroundPicture();

      const [w, h] = getDimensions(currentDimension);

      currentCanvasDimensions.textContent = `${w} by ${h}px`;

      // If a target is being edited, the scale edit control needs updating
      // - Has to be done in a timeout as SC entity updates are batched to requestAnimationFrame calls
      const editInProgress = updateGroup.get('artefacts');
      if (editInProgress.length) {

        const ent = scrawl.findEntity(editInProgress[0]);
        if (ent) setTimeout(() => entityScale.value = `${ent.get('scale')}`, 50);
      }

      updateAllScribbles();
      updateLogoPosition();
    }
  };

  // Add the update function to the modal's dimensionsSelector element
  scrawl.addNativeListener('change', update, dimensionsSelector);

  return { 
    getDimensions,
    getScaler,
  };
};


// ------------------------------------------------------------------------
// Instructions modal
// - Offers users instructions for using the tool
// ------------------------------------------------------------------------
const initInstructions = () => {

  // Initialize DOM instructions button and associated modal
  scrawl.addNativeListener('click', () => openModal(instructionsModal), instructionsButton);
  scrawl.addNativeListener('click', closeModal, instructionsCloseButton);
  scrawl.addNativeListener('close', closeModal, instructionsModal);

  return {};
};


// ------------------------------------------------------------------------
// Teleprompter functionality
// ------------------------------------------------------------------------
const initTeleprompter = () => {

  // Initialize DOM teleprompter edit button and associated modal
  scrawl.addNativeListener('click', () => openTelepromptModal(), telepromptButton);
  scrawl.addNativeListener('click', closeModal, telepromptCloseButton);
  scrawl.addNativeListener('close', closeModal, telepromptModal);

  // Local state variables management
  let telepromptIndex = -1;  

  const telepromptLines = [],
    telepromptTimestamps = [],
    initialReadingText = 'Press space bar to advance text',
    initialStageText = 'Stage prompts will appear here',
    endOfFileText = '[Ends]';

  telepromptReading.textContent = initialReadingText;
  telepromptStage.textContent = initialStageText;

  const resetTelepromptRuntime = () => {

    telepromptLines.length = 0;
    telepromptIndex = -1;
    telepromptTimestamps.length = 0;

    telepromptReading.textContent = initialReadingText;
    telepromptStage.textContent = initialStageText;
  };


  // Setup teleprompter reveal/hide functionality
  const toggleTeleprompterArea = () => {

    if (teleprompterIsRunning) return;

    teleprompterIsVisible = !teleprompterIsVisible;

    if (teleprompterIsVisible) {

      appPanel.classList.add('teleprompter-active');
      telepromptAreaButton.textContent = 'Close teleprompter';
    }
    else {

      appPanel.classList.remove('teleprompter-active');
      telepromptAreaButton.textContent = 'Use teleprompter';
    }
  };
  scrawl.addNativeListener('click', toggleTeleprompterArea, telepromptAreaButton);

  // Specific instructions when opening the teleprompter modal
  const openTelepromptModal = () => {

    openModal(telepromptModal);
    setTimeout(() => telepromptEditor.focus(), 120);
  };

  // Build state from teleprompt editor contents
  const parseTelepromptScript = () => {

    const raw = telepromptEditor.value.trim();

    if (!raw) return [];

    return raw
      .split(/\n/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(text => {

        if (text.startsWith('~')) {
          return {
            type: 'stage',
            text: text.slice(1).trim(),
          };
        }

        return {
          type: 'read',
          text,
        };
      });
  };

  // Buttons that should be disabled during test runs
  const teleprompterLockedButtons = [
    telepromptButton,
    recordingButton,
    telepromptAreaButton,
    dimensionsButton,
  ];

  const disableTeleprompterButtons = () => {

    teleprompterLockedButtons.forEach(btn => btn.setAttribute('disabled', ''));
  };

  const enableTeleprompterButtons = () => {

    teleprompterLockedButtons.forEach(btn => btn.removeAttribute('disabled'));
  };

  scrawl.addNativeListener('click', () => {

    if (!teleprompterIsRunning) startTeleprompterTest();
    else stopTeleprompterTest();

  }, telepromptTestButton);

  const displayNextTelepromptLine = () => {

    telepromptIndex++;

    if (telepromptIndex >= telepromptLines.length) {

      telepromptStage.textContent = '';
      telepromptReading.textContent = endOfFileText;
      return;
    }

    const line = telepromptLines[telepromptIndex];

    if (line.type === 'stage') {
      telepromptStage.textContent = line.text;
    }
    else {
      telepromptReading.textContent = line.text;

      telepromptTimestamps.push({
        text: line.text,
        time: recordingTimer.textContent,
      });
    }
  };

  const populateTelepromptState = () => {

    resetTelepromptRuntime();
    telepromptLines.push(...parseTelepromptScript());
  };

  const startTeleprompterTest = () => {

    populateTelepromptState();

    if (!telepromptLines.length) return;

    teleprompterIsRunning = true;

    closeModal();
    disableTeleprompterButtons();

    telepromptTestButton.textContent = 'Stop test';
    telepromptTestButton.classList.add('teleprompter-test-running');

    startRecordingTimer();
  };

  const stopTeleprompterTest = () => {

    teleprompterIsRunning = false;

    stopRecordingTimer();

    enableTeleprompterButtons();

    telepromptTestButton.textContent = 'Run test';
    telepromptTestButton.classList.remove('teleprompter-test-running');
  };

  scrawl.addNativeListener('keydown', (e) => {

    if (e.code !== 'Space') return;
    if (!teleprompterIsVisible) return;
    if (!teleprompterIsRunning) return;

    e.preventDefault();

    displayNextTelepromptLine();

  }, document);

  const telepromptHasScript = () => telepromptLines.length > 0;

  return {
    telepromptTimestamps,
    displayNextTelepromptLine,
    populateTelepromptState,
    telepromptHasScript,
  };
};


// ------------------------------------------------------------------------
// Head management controls
// - generates a talking head - with the help of a Google MediaPipe solution
// - https://ai.google.dev/edge/mediapipe/solutions/guide
// ------------------------------------------------------------------------
const initTalkingHead = () => {

  // Camera discovery
  DeviceManager.onChange(({ cameras }) => {

    const frag = document.createDocumentFragment();

    if (cameras.length) {
      cameras.forEach(cam => {
        const opt = document.createElement('option');
        opt.value = cam.id;
        opt.textContent = cam.label;
        frag.appendChild(opt);
      });
    }
    else {
      const opt = document.createElement('option');
      opt.value = 'none';
      opt.textContent = 'No cameras found';
      frag.appendChild(opt);
    }

    headCamera.replaceChildren(...frag.querySelectorAll('option'));
  });

  // Initialize DOM head button and associated modal
  scrawl.addNativeListener('change', () => selectedCamera = headCamera.value, headCamera);

  // Google MediaPipe ML model code
  let imageSegmenter,
    modelIsRunning = false;

  const startModel = async () => {

    const vision = await MediaPipe.FilesetResolver.forVisionTasks();

    // For reasons, the vision attributes don't match the file structure laid out in this repo
    vision.wasmBinaryPath = `js/mediapipe/wasm${vision.wasmBinaryPath}`;
    vision.wasmLoaderPath = `js/mediapipe/wasm${vision.wasmLoaderPath}`;

    imageSegmenter = await MediaPipe.ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'js/mediapipe/model/selfie_segmenter.tflite',
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: 'LIVE_STREAM',
    });

    modelIsRunning = true;
  };

  // We can start the model code running straight away
  // - It's the camera for which we need user permission
  startModel();

  // Set up some hidden Cells to process the camera data and create the desired output
  // - This first Cell receives the camera data
  const talkingHeadFrame = canvas.buildCell({

    name: name('talking-head-frame'),
    dimensions: [768, 768],
    cleared: false,
    compiled: false,
    shown: false,
  });

  // We use this Cell to feed data into MediaPipe
  const talkingHeadInput = canvas.buildCell({

    name: name('talking-head-input'),
    dimensions: [256, 256],
    shown: false,
  });

  // We also need a Cell where we can composite the final head image output
  const talkingHeadOutput = canvas.buildCell({

    name: name('talking-head-output'),
    dimensions: [768, 768],
    shown: false,
  });

  // We process the model's output in a dedicated mask Cell
  // - We do this using direct manipulation of the Cell's image data
  const talkingHeadMask = canvas.buildCell({

    name: name('talking-head-mask'),
    dimensions: [256, 256],
    cleared: false,
    compiled: false,
    shown: false,
  });

  const maskData = talkingHeadMask.getCellData(true),
    pixels = maskData.pixelState;

  // This function gets consumed by the model's imageSegmenter object
  // - imageSegmenter doesn't start its work until it has something to segment
  const processModelData = (results) => {

    const data = results.categoryMask.containers[0];

    if (data && data.length) {

      data.forEach((val, index) => pixels[index].alpha = 255 - val);

      talkingHeadMask.paintCellData(maskData);

      talkingHeadFrame.clear();
      talkingHeadFrame.compile();
    }
  };

  // The framePicture's asset will be the camera feed, in due course
  const framePicture = scrawl.makePicture({

    name: name('talking-head-frame-picture'),
    group: talkingHeadFrame,
    copyDimensions: ['100%', '100%'],
    start: ['center', 'center'],
    handle: ['center', 'center'],
  });

  scrawl.makePicture({

    name: name('talking-head-input-picture'),
    group: talkingHeadInput,
    asset: talkingHeadFrame,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
  });

  const squareShape = scrawl.makeBlock({

    name: name('talking-head-square'),
    group: talkingHeadOutput,
    dimensions: ['100%', '100%'],
  });

  const roundShape = scrawl.makeWheel({

    name: name('talking-head-round'),
    group: talkingHeadOutput,
    start: ['center', 'center'],
    handle: ['center', 'center'],
    radius: '50%',
    visibility: false,
  })

  scrawl.makeFilter({

    name: name('mask-blur'),
    method: 'gaussianBlur',
    radius: 3,
  })

  const maskPicture = scrawl.makePicture({

    name: name('talking-head-mask-picture'),
    group: talkingHeadOutput,
    asset: talkingHeadMask,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
    filters: [name('mask-blur')],
    globalCompositeOperation: 'source-in',
  });

  scrawl.makePicture({

    name: name('talking-head-overlay-picture'),
    group: talkingHeadOutput,
    asset: talkingHeadFrame,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
    globalCompositeOperation: 'source-in',
    order: 1,
  });

  // Finally we can grab the composited output and display it on the main canvas
  let headIsDisplayed;

  const outputPicture = scrawl.makePicture({

    name: name('talking-head-output-picture'),
    asset: talkingHeadOutput,
    dimensions: [768, 768],
    copyDimensions: ['100%', '100%'],

    order: 200,

    start: ['75%', '75%'],
    handle: ['center', 'center'],

    flipReverse: true,
    scale: 0.5,

    method: 'fill',

    visibility: false,
  });

  // Capture the device camera output
  // - But only after the user agrees
  let mycamera,
    myCameraAnimation;

  const startCamera = () => {

    scrawl.importMediaStream({

      name: name('camera-feed'),
      audio: false,
      video: {
        width: { ideal: 768 },
        height: { ideal: 768 },
        deviceId: selectedCamera,
      },
      onMediaStreamEnd: () => stopCamera(),

    }).then(res => {

      mycamera = res;

      // We asked for a 768 x 768 media stream, but the browser won't guarantee returning those dimensions
      // - Thus we need to adapt the picture elements to accommodate vaiations
      scrawl.addNativeListener('loadedmetadata', () => {

        const width = mycamera.source.videoWidth,
          height = mycamera.source.videoHeight,
          minimumDimension = Math.min(width, height),
          scale = 768 / minimumDimension;

        framePicture.set({
          dimensions: [width, height],
          scale,
          asset: mycamera, 
        }, mycamera.source);

        talkingHeadFrame.clear();
        talkingHeadFrame.compile();

        outputPicture.set ({ visibility: true });

        headShowCheckbox.removeAttribute('disabled');

        // We need to feed input data into the model discretely, via an SC animation object
        myCameraAnimation = scrawl.makeAnimation({

          name: name('head-segmenter'),
          order: 0,
          fn: () => {

            if (imageSegmenter && imageSegmenter.segmentForVideo) {

              imageSegmenter.segmentForVideo(talkingHeadInput.element, performance.now(), processModelData);
            }
          }
        });
      }, mycamera.source);

    }).catch(err => console.log(err.message));
  };

  // Kill the camera media stream and all associated SC objects
  const stopCamera = () => {

    headShowCheckbox.setAttribute('disabled', '');

    mycamera.source.srcObject = null;

    if (mycamera.mediaStreamTrack != null) mycamera.mediaStreamTrack.stop();

    myCameraAnimation.kill();

    framePicture.set({ asset: '' });
    outputPicture.set ({ visibility: false });

    mycamera.kill();
  };

  // Displaying and removing the talking head
  // - Option only appears after a camera media stream capture starts
  const toggleHead = (toggle) => {

    if (modelIsRunning) {

      if (toggle && !headIsDisplayed) {

        startCamera();

        headHorizontal.removeAttribute('disabled');
        headVertical.removeAttribute('disabled');
        headScale.removeAttribute('disabled');
        headOpacity.removeAttribute('disabled');
        headRotation.removeAttribute('disabled');

        headIsDisplayed = true;
      }
      else if (!toggle && headIsDisplayed) {

        stopCamera();

        headHorizontal.setAttribute('disabled', '');
        headVertical.setAttribute('disabled', '');
        headScale.setAttribute('disabled', '');
        headOpacity.setAttribute('disabled', '');
        headRotation.setAttribute('disabled', '');

        headIsDisplayed = false;
      }
    }
    else {

      if (headIsDisplayed) stopCamera();

      headHorizontal.setAttribute('disabled', '');
      headVertical.setAttribute('disabled', '');
      headScale.setAttribute('disabled', '');
      headOpacity.setAttribute('disabled', '');
      headRotation.setAttribute('disabled', '');

      headIsDisplayed = false;
    }
  }

  // More event listeners for the 'head' modal's user interaction
  // ... 'Use talking head' checkbox (keyboard: SPACE)
  scrawl.addNativeListener('change', () => {

    if (headUseCheckbox.checked) toggleHead(true);
    else toggleHead(false);

  }, headUseCheckbox);

  // ... 'Show talking head' checkbox (keyboard: SPACE)
  scrawl.addNativeListener('change', () => {

    if (myCameraAnimation) {

      if (headShowCheckbox.checked && !headIsDisplayed) {

        outputPicture.set ({ visibility: true });
        headIsDisplayed = true;
      }
      else if (!headShowCheckbox.checked && headIsDisplayed) {

        outputPicture.set ({ visibility: false });
        headIsDisplayed = false;
      }
    }
  }, headShowCheckbox);

  // All the other talking head parameters (which are ranges, thus keyboard: ARROW keys)
  scrawl.makeUpdater({

    event: ['input', 'change'],
    origin: '.head-controls',

    target: outputPicture,

    useNativeListener: true,
    preventDefault: true,

    updates: {
      ['head-horizontal']: ['startX', '%'],
      ['head-vertical']: ['startY', '%'],
      ['head-scale']: ['scale', 'float'],
      ['head-opacity']: ['globalAlpha', 'float'],
      ['head-rotation']: ['roll', 'float'],
    },
  });

  // Show a round or square head (keyboard: ARROWS, RETURN)
  scrawl.addNativeListener('change', () => {

    const res = parseInt(headShape.value, 10);

    if (res) {

      squareShape.set({ visibility: false });
      roundShape.set({ visibility: true });
    }
    else {

      squareShape.set({ visibility: true });
      roundShape.set({ visibility: false });
    }

  }, headShape);

  // Show or remove the head background (keyboard: ARROWS, RETURN)
  scrawl.addNativeListener('change', () => {

    maskPicture.set({ visibility: headBackground.value === '1' ? true : false });

  }, headBackground);

  // Filter effects on the head (keyboard: ARROWS, RETURN)
  scrawl.addNativeListener('change', () => {

    talkingHeadOutput.set({ filters: [headFilter.value] });

  }, headFilter);
};


// ------------------------------------------------------------------------
// Targets management controls
// ------------------------------------------------------------------------
const initTargets = () => {

  // Initialize DOM targets button and associated modal
  scrawl.addNativeListener('click', () => requestScreenCapture(), targetRequestButton);

  // Local state
  let targetCount = 0;
  const targetsPictureArray = [],
    targetNamesObject = {};

  // The main request screen capture function
  // - Users can add multiple screen-captured targets to the canvas
  const requestScreenCapture = () => {

    const targetId = name(`target-${targetCount}`);
    targetCount++;

    targetNamesObject[targetId] = targetId;

    // Screen capture streams are brittle
    // - We need to remove associated assets and entitys from SC when they fail us
    // - TODO: not yet implemented
    let cleanup = () => console.log(`${targetId} - video track stream has ended`);

    // The main event!
    // - Gets the user's desired media stream (via browser functionality)
    // - Creates an SC asset (including a hidden video element) and Picture entity from it
    scrawl.importScreenCapture({

      name: targetId,

      // Is this the line causing audio issues?
      audio: { suppressLocalAudioPlayback: true },

      onMediaStreamEnd: () => cleanup(),

    }).then(mycamera => {

      // Create a Picture entity to display the media stream on the canvas
      const targetPicture = scrawl.makePicture({

        name: targetId,
        asset: mycamera.name,

        dimensions: [1, 1],
        copyDimensions: ['100%', '100%'],

        start: ['50%', '50%'],
        handle: ['50%', '50%'],

        method: 'fill',

        bringToFrontOnDrag: false,

        button: {

          name: `${targetId}-button`,
          description: `Press enter to edit ${targetId}`,

          clickAction: function () {

            if (updateGroup.get('artefacts').includes(targetPicture.name)) cleanupAction();
            else {

              updateGroup.clearArtefacts();
              updateGroup.addArtefacts(targetPicture);

              updateEntityControls(targetPicture, targetNamesObject[targetId]);

              entityBeingEdited.textContent = targetPicture.name;
            }
          },
        },
      });

      // Target acquisition is asynchronous, given the need to manipulate the DOM
      // - Expect the work to complete within 1 second
      // - We can only set the Picture dimensions and scale after the media stream starts, well, streaming
      // - TODO: There's probably a better, more "listenery" way to achieve this
      let checkerAttempts = 0,
        details, detailsEvent, 
        summary, summaryEvent,
        removeButton, centerButton, renameButton, 
        removeEvent, centerEvent, renameEvent;

      const checker = () => {

        setTimeout(() => {

          if (targetPicture.sourceLoaded) {

            // Assume that users won't want to be scribbling until after they position the target on the canvas
            setScribblesFlag(false);
            enableDragging();

            const [cameraWidth, cameraHeight] = targetPicture.get('copyDimensions');
            const [canvasWidth, canvasHeight] = getDimensions(currentDimension);

            const widthRatio = canvasWidth / cameraWidth,
              heightRatio = canvasHeight / cameraHeight;

            const scale = (widthRatio < 1 || heightRatio < 1) ? Math.min(widthRatio, heightRatio) / 1.5 : 1;

            targetPicture.set({
              dimensions: [cameraWidth, cameraHeight],
              scale,
            });

            // Make the Picture entity draggable
            dragGroup.addArtefacts(targetPicture);

            // Keep track of target names
            targetsPictureArray.push(targetPicture.name);

            // Each target needs a listing in the Targets modal
            details = document.createElement('details');
            details.name = 'targets-accordion';
            details.id = targetId;

            summary = document.createElement('summary');
            summary.id = `${targetId}-summary`;
            summary.textContent = targetNamesObject[targetId];
            summary.classList.add('target-summary');
            details.appendChild(summary);

            const controlsDiv = document.createElement('div');
            controlsDiv.classList.add('targets-container');

            renameButton = document.createElement('button');
            renameButton.textContent = 'Rename';
            renameButton.classList.add('target-button');

            controlsDiv.appendChild(renameButton);
            renameEvent = scrawl.addNativeListener('click', (e) => {

              e.stopPropagation();
              renameTarget();

            }, renameButton);

            centerButton = document.createElement('button');
            centerButton.textContent = 'Center';
            centerButton.classList.add('target-button');

            controlsDiv.appendChild(centerButton);

            centerEvent = scrawl.addNativeListener('click', (e) => {

              e.stopPropagation();
              centerTarget();

            }, centerButton);

            removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.classList.add('target-button');

            controlsDiv.appendChild(removeButton);

            removeEvent = scrawl.addNativeListener('click', (e) => {

              e.stopPropagation();
              removeTarget();

            }, removeButton);

            summaryEvent = scrawl.addNativeListener('keydown', (e) => {

              if (e.target.tagName.toLowerCase() !== 'summary') return;

              if (e.shiftKey && e.key === 'ArrowUp') {

                e.preventDefault();
                moveTargetUp(details);
              }
              else if (e.shiftKey && e.key === 'ArrowDown') {

                e.preventDefault();
                moveTargetDown(details);
              }
            }, summary);

            detailsEvent = scrawl.addNativeListener('toggle', () => {

              if (details.open) {

                updateGroup.clearArtefacts();
                updateGroup.addArtefacts(targetPicture);
                updateEntityControls(targetPicture, targetNamesObject[targetId]);
              }
            }, details);

            details.appendChild(controlsDiv);
            targetsHold.insertAdjacentElement('afterbegin', details);

            updateGroup.clearArtefacts();
            updateGroup.addArtefacts(targetPicture);

            updateEntityControls(targetPicture, targetNamesObject[targetId]);
          }
          else {

            checkerAttempts++;

            if (checkerAttempts < 5) checker();
          }

        }, 200);
      }

      // Start checking
      checker();

      // Clean up the mess left behind when a media stream fails
      cleanup = () => {

        const currentUpdate = updateGroup.get('artefacts');

        if (currentUpdate.includes(targetPicture.name)) cleanupAction();

        targetPicture.kill();
        mycamera.kill();

        if (details != null) {

          // scrawl.addNativeListener returns a function to remove the listener
          renameEvent();
          centerEvent();
          removeEvent();
          summaryEvent();
          detailsEvent();

          details.remove();
        }
      }

      const renameTarget = () => {

        const name = prompt('Change target label to', targetNamesObject[targetId]);

        if (name != null && name.trim() !== '') {

          targetNamesObject[targetId] = name;
          updateEntityControls(targetPicture, targetNamesObject[targetId]);

          const targ = targetsHold.querySelector(`#${targetId}-summary`);
          if (targ) targ.textContent = targetNamesObject[targetId];
        }
      };

      const centerTarget = () => targetPicture.set({ start: ['50%', '50%'] });

      const removeTarget = () => {

        if (mycamera.mediaStreamTrack != null) mycamera.mediaStreamTrack.stop();
        cleanup();
      };

      const moveTargetUp = (detailsEl) => {

        const prev = detailsEl.previousElementSibling;
        if (!prev) return;

        targetsHold.insertBefore(detailsEl, prev);
        setTimeout(updateTargetOrderValues, 0);
      };

      const moveTargetDown = (detailsEl) => {

        const next = detailsEl.nextElementSibling;
        if (!next) return;

        targetsHold.insertBefore(next, detailsEl);
        setTimeout(updateTargetOrderValues, 0);
      };
    }).catch(err => console.log('err', err));
  };

  const updateTargetOrderValues = () => {

    const targets = [...targetsHold.querySelectorAll('details')];

    const len = targets.length;

    targets.forEach((t, index) => {

      const pic = scrawl.findEntity(t.id);

      if (pic) pic.set({ order: len - index });
    });
  };


  const cleanupAction = () => { 

    updateGroup.clearArtefacts();

    entityBeingEdited.textContent = 'no target selected';

    if (areControlsEnabled()) disableControls();

    const targets = targetsHold.querySelectorAll('details');

    [...targets].forEach(t => {

      if (t.open) t.removeAttribute('open');
    });

    targetsPanelSummary.focus();
  };

  const updateTargetScales = (oldScaler, newScaler) => {

    if (oldScaler !== newScaler) {

      targetsPictureArray.forEach(id => {

        const entity = scrawl.findEntity(id);

        if (entity) {

          const scale = entity.get('scale');

          entity.set({
            scale: ((scale / oldScaler) * newScaler),
          });
        }
      });
    }
  };

  return { 
    updateTargetScales,
    cleanupAction,
    targetNamesObject,
  };
};


// ------------------------------------------------------------------------
// Video recording and download functionality
// ------------------------------------------------------------------------
const initVideoRecording = () => {

  let selectedFiletype = 'mp4';

  // Microphone level meter state
  let audioContext,
    analyserNode,
    analyserSource,
    analyserData,
    meterAnimationId;

  const meterColorFactory = scrawl.makeColor({
    name: name('microphone-meter'),
    minimumColor: 'rgb(80 255 80)',
    maximumColor: 'rgb(255 80 80)',
    colorSpace: 'OKLAB',
  });

  const initMicrophoneAnalyser = () => {

    if (!myMicrophone || !myMicrophone.mediaStream) return;

    if (!audioContext) {

      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;

      audioContext = new Ctor();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserData = new Uint8Array(analyserNode.frequencyBinCount);

    analyserSource = audioContext.createMediaStreamSource(myMicrophone.mediaStream);
    analyserSource.connect(analyserNode);
  };

  const updateMicrophoneMeter = () => {

    if (!analyserNode || !analyserData) {
      meterAnimationId = requestAnimationFrame(updateMicrophoneMeter);
      return;
    }

    analyserNode.getByteTimeDomainData(analyserData);

    let sumSquares = 0;
    for (let i = 0; i < analyserData.length; i++) {
      const v = analyserData[i] - 128;
      sumSquares += v * v;
    }

    const rms = Math.sqrt(sumSquares / analyserData.length) / 128;
    const level = Math.min(Math.max(rms, 0), 1);

    meterBar.style.width = `${(level * 100).toFixed(0)}%`;
    meterBar.style.background = meterColorFactory.getRangeColor(level);

    meterAnimationId = requestAnimationFrame(updateMicrophoneMeter);
  };

  const startMicrophoneMeter = () => {

    if (!analyserNode) initMicrophoneAnalyser();

    if (!meterAnimationId && analyserNode) {
      meterAnimationId = requestAnimationFrame(updateMicrophoneMeter);
    }
  };

  const stopMicrophoneMeter = () => {

    if (meterAnimationId) {
      cancelAnimationFrame(meterAnimationId);
      meterAnimationId = null;
    }

    if (meterBar) {
      meterBar.style.width = '0%';
    }
  };

  // Microphone discovery
  DeviceManager.onChange(({ microphones }) => {

    const frag = document.createDocumentFragment();

    if (microphones.length) {
      microphones.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        frag.appendChild(opt);
      });
    }
    else {
      const opt = document.createElement('option');
      opt.value = 'none';
      opt.textContent = 'No microphones found';
      frag.appendChild(opt);
    }

    recordingMicrophone.replaceChildren(...frag.querySelectorAll('option'));
  });

  // Initialize DOM recording button and associated modal
  recordingButton.removeAttribute('disabled');
  scrawl.addNativeListener(
    'click',
    () => openModal(recordingModal, () => DeviceManager.refreshDevices()),
    recordingButton
  );

  scrawl.addNativeListener('click', closeModal, recordingCloseButton);
  scrawl.addNativeListener('close', closeModal, recordingModal)

  scrawl.addNativeListener('change', () => selectedMicrophone = recordingMicrophone.value, recordingMicrophone);

  scrawl.addNativeListener('change', () => selectedFiletype = recordingFiletype.value, recordingFiletype);

  // Capture and release the microphone feed
  let myMicrophone;

  const startMicrophone = () => {

    return new Promise((resolve, reject) => {

      if (myMicrophone) {

        const realTrack = myMicrophone.mediaStream.getAudioTracks()[0];

        if (realTrack) resolve(realTrack);
        else reject('Microphone stream has no audio tracks');
        return;
      }

      scrawl.importMediaStream({

        name: name('microphone-feed'),

        audio: {

          deviceId: selectedMicrophone === 'none'
            ? undefined
            : { exact: selectedMicrophone },

          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 48000,
        },

        onMediaStreamEnd: () => stopMicrophone(),

      })
      .then(res => {

        myMicrophone = res;

        const track = myMicrophone.mediaStream.getAudioTracks()[0];

        if (!track) {

          stopMicrophone();
          reject('This microphone device provides no usable audio track.');
          return;
        }

        // Prepare Web Audio analyser for level meter
        initMicrophoneAnalyser();

        resolve(track);
      })
      .catch(err => {

        console.warn("Microphone error:", err);

        let msg = '';

        if (err.name === 'OverconstrainedError') {

          msg = `The selected microphone cannot satisfy required settings.
This is common with older USB headsets.

Please:
• unplug/re-plug the device; or
• select another microphone.`;
        }
        else if (err.name === 'NotFoundError')  {
        
          msg = `No microphone is available.`;
        }
        else if (err.name === 'NotAllowedError') {

          msg = `Microphone access was blocked. Allow microphone permissions to continue.`;
        }
        else {

          msg = `Failed to access microphone: ${err.message || err}`;
        }

        reject(msg);
      });
    });
  };

  // Kill the camera media stream and all associated SC objects
  const stopMicrophone = () => {

    // Stop the visual meter first
    stopMicrophoneMeter();

    // Tear down Web Audio graph
    if (analyserSource) {
      analyserSource.disconnect();
      analyserSource = null;
    }

    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (!myMicrophone) return;

    myMicrophone.source.srcObject = null;

    if (myMicrophone.mediaStreamTrack != null) myMicrophone.mediaStreamTrack.stop();

    myMicrophone.kill();
    myMicrophone = null;
  };

  // Local variables used by both startRecording and stopRecording functions
  let recorder, stopListener, dataCodec,
    recordingTimerIntervalValue, recordingStartedAt;

  const recordedChunks = [];

  // Keeping track of whether the page is currently recording, or not
  let isRecording = false;

  // Setup and start recording the canvas
  const recordingLockedButtons = [
    telepromptButton,
    telepromptTestButton,
    telepromptAreaButton,
    dimensionsButton,
  ];

  const disableRecordingTeleprompterButtons = () => {
    recordingLockedButtons.forEach(btn => btn.setAttribute('disabled', ''));
  };

  const enableRecordingTeleprompterButtons = () => {
    recordingLockedButtons.forEach(btn => btn.removeAttribute('disabled'));
  };

  const startRecording = () => {

    if (isRecording) return;

    startMicrophone()
    .then(microphoneTrack => {

      isRecording = true;
      closeModal();
      recordingStartButton.setAttribute('disabled', '');

      stopListener = scrawl.addNativeListener('click', stopRecording, recordingButton);
      recordingButton.classList.add('is-recording');
      recordingButton.textContent = 'Stop recording';

      const stream = canvas.base.element.captureStream(25);
      stream.addTrack(microphoneTrack);

      let mimeType = `video/${selectedFiletype}`;
      if (recordingCodec.value) mimeType += `; codecs="${recordingCodec.value}"`;

      recorder = new MediaRecorder(stream, { mimeType });

      recordedChunks.length = 0;

      recorder.ondataavailable = e => {

        if (e.data.size > 0) {

          dataCodec = e.data.type;
          recordedChunks.push(e.data);
        }
      };

      recorder.start(1000);

      // Teleprompter
      if (teleprompterIsVisible) {

        populateTelepromptState();

        if (telepromptHasScript()) {

          teleprompterIsRunning = true;

          disableRecordingTeleprompterButtons();
        }
      }

      // Time elapsed
      startRecordingTimer();

      // Microphone level meter
      microphoneLevel.removeAttribute('aria-hidden');
      microphoneLevel.style.display = 'block';
      startMicrophoneMeter();
    })
    .catch(errMsg => {

      alert(errMsg);

      console.warn("Recording aborted:", errMsg);

      recordingStartButton.removeAttribute('disabled');
      recordingButton.classList.remove('is-recording');
      recordingButton.textContent = 'Record';

      isRecording = false;
    });
  };

  const startRecordingTimer = () => {

    recordingTimer.removeAttribute('aria-hidden');
    recordingTimer.style.display = 'block';
    recordingTimer.textContent = '00:00:00';
    recordingTimer.setAttribute('aria-label', 'Recording started');

    recordingStartedAt = Date.now();
    recordingTimerIntervalValue = setInterval(recordingTimerFunction, 500);
  };

  const recordingTimerFunction = () => {

    const elapsed = parseInt((Date.now() - recordingStartedAt) / 1000, 10);

    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0'),
      mins = String(Math.floor(elapsed / 60)).padStart(2, '0'),
      secs = String(elapsed % 60).padStart(2, '0');

    recordingTimer.textContent = `${hrs}:${mins}:${secs}`;

    if (elapsed > 0 && elapsed % 15 === 0) recordingTimer.setAttribute('aria-label', `${elapsed} seconds`);
  };

  const stopRecordingTimer = () => {

    clearInterval(recordingTimerIntervalValue);

    recordingTimer.style.display = 'none';
    recordingTimer.setAttribute('aria-hidden', 'true');
    recordingTimer.removeAttribute('aria-label');
  };

  const stopRecording = () => {

    if (isRecording) {

      stopListener();
      stopListener = null;

      stopMicrophone();

      recorder.stop();
      recorder = null;

      const lastTime = recordingTimer.textContent;
      stopRecordingTimer();

      microphoneLevel.style.display = 'none';
      microphoneLevel.setAttribute('aria-hidden', 'true');
      stopMicrophoneMeter();

      let txtString = '',
        srtString = '';

      if (teleprompterIsRunning) {

        txtString = telepromptTimestamps.map(item => item.text).join('\n');

        srtString = telepromptTimestamps.map((item, index) => {

          if (index < telepromptTimestamps.length - 1) return `${index + 1}\n${item.time},000 --> ${telepromptTimestamps[index + 1].time},000\n${item.text}\n\n`;
          else return `${index + 1}\n${item.time},000 --> ${lastTime},000\n${item.text}\n\n`;
        }).join('');
      }

      setTimeout(() => {

        const now = new Date();

        const pad = (n) => String(n).padStart(2, '0');

        const nowString = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

        if (!teleprompterIsRunning) {

          const blob = new Blob(recordedChunks, { type: dataCodec });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = `SC-screen-recording_${nowString}.${selectedFiletype}`;
          a.click();
          a.remove();
        }
        else {

          enableRecordingTeleprompterButtons();
          teleprompterIsRunning = false;

          const videoBlob = new Blob(recordedChunks, { type: dataCodec });

          downloadZip([{
            name: `SC-screen-recording_${nowString}.txt`,
            lastModified: now,
            input: txtString
          },{
            name: `SC-screen-recording_${nowString}.srt`,
            lastModified: now,
            input: srtString
          },{
            name: `SC-screen-recording_${nowString}.${selectedFiletype}`,
            lastModified: now,
            input: videoBlob
          }])
          .blob()
          .then(blob => {

            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `SC-screen-recording_${nowString}.zip`;
            a.click();
            a.remove();
          });
        }

        recordingButton.classList.remove('is-recording');
        recordingButton.textContent = 'Record';

        recordingStartButton.removeAttribute('disabled');

        isRecording = false;
      }, 0);
    }
  };

  scrawl.addNativeListener('click', startRecording, recordingStartButton);

  return {
    startRecordingTimer,
    stopRecordingTimer,
  };
};


// ------------------------------------------------------------------------
// Background color/images controls
// ------------------------------------------------------------------------

// Initialize background image functionality
const initBackground = () => {

  scrawl.addNativeListener('focus', () => backgroundUploadButton.classList.add('is-focussed'), backgroundUpload);
  scrawl.addNativeListener('blur', () => backgroundUploadButton.classList.remove('is-focussed'), backgroundUpload);
  scrawl.addNativeListener('focus', () => backgroundColorButton.classList.add('is-focussed'), backgroundColorInput);
  scrawl.addNativeListener('blur', () => backgroundColorButton.classList.remove('is-focussed'), backgroundColorInput);

  // Background color management
  const updateBackgroundColor = () => canvas.setBase({ backgroundColor: backgroundColorInput.value });
  scrawl.addNativeListener(['input', 'change'], updateBackgroundColor, backgroundColorInput);

  // Create a Picture entity to display the background image in the canvas
  const backgroundPicture = scrawl.makePicture({

    name: name('background'),
    dimensions: ['100%', '100%'],
  });

  // Only one background image can be displayed at any time
  // - Future TODO - add in some functionality to allow users to stop showing the background image?
  let currentBackgroundAsset = null;

  // UX: Load background images into the canvas using mouse drag-and-drop functionality
  // - Handles multiple dragged files; the last file processed is the one that gets displayed
  scrawl.addNativeListener(['dragenter', 'dragover', 'dragleave'], (e) => {

    e.preventDefault();
    e.stopPropagation();

  }, canvas.domElement);

  scrawl.addNativeListener('drop', (e) => {

    e.preventDefault();
    e.stopPropagation();

    const dt = e.dataTransfer;

    if (dt) [...dt.files].forEach(addBackgroundAsset);

  }, canvas.domElement);

  // UX: Load background images into the canvas using the browser's file selector
  // - Handles multiple selected files; the last file processed is the one that gets displayed
  scrawl.addNativeListener('change', (e) => {

    e.preventDefault();
    e.stopPropagation();

    [...backgroundUpload.files].forEach(addBackgroundAsset);

  }, backgroundUpload);

  // Add each file to the Scrawl-canvas system as an asset
  let counter = 0;
  const addBackgroundAsset = (file) => {

    if (file.type.indexOf('image/') === 0) {

      // Create a name for our new asset
      const imageId = `user-upload-${counter}`;
      counter++;

      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onloadend = function() {

        // Add the image to the DOM and create a Scrawl-canvas asset from it
        // - We wrap the <img> element in a <button> element
        // - The button then gets added to the Background modal
        // - Users can then quickly select previously uploaded images from the modal
        const img = document.createElement('img');
        img.src = reader.result;
        img.id = imageId;

        const btn = document.createElement('button');
        btn.setAttribute('data-target', imageId);

        // Function to run when user clicks on an image button in the background modal
        const buttonLoad = function () {

          const target = this.dataset.target;

          if (target) {

            const asset = scrawl.findAsset(target);

            if (asset) {
              currentBackgroundAsset = asset;

              backgroundPicture.set({ asset });
              updateBackgroundPicture();
            }
          }
        }

        scrawl.addNativeListener('click', buttonLoad, btn);

        btn.appendChild(img);
        backgroundImageHold.appendChild(btn);

        scrawl.importDomImage(`#${imageId}`);

        backgroundPicture.set({
          asset: imageId,
        });
      };

      // Async because loading an <img> element into the DOM takes its own sweet time
      setTimeout(() => {

        currentBackgroundAsset = scrawl.findAsset(imageId);
        updateBackgroundPicture();

      }, 200);
    }
    return { currentBackgroundAsset };
  };

  // Remove current background image
  const hideBackground = () => {

    currentBackgroundAsset = null;

    backgroundPicture.set({
      asset: '',
    });
  };
  scrawl.addNativeListener('click', hideBackground, backgroundImageHide);

  // Function to suitably display the background image in the canvas
  // - This emulates the <img> DOM `object-fit: cover` attribute functionality
  // - Runs whenever a new background image is loaded/selected, or the canvas dimensions change
  const updateBackgroundPicture = () => {

    if (currentBackgroundAsset != null) {

      const aWidth = currentBackgroundAsset.get('width'),
        aHeight = currentBackgroundAsset.get('height');

      const [dWidth, dHeight] = getDimensions(currentDimension);

      const rWidth = dWidth / aWidth,
        rHeight = dHeight / aHeight;

      let cX = 0,
        cY = 0,
        cWidth, cHeight;

      if (rWidth < rHeight) {

        cX = Math.floor((aWidth - (dWidth / rHeight)) / 2);
        cWidth = Math.floor(dWidth / rHeight);
        cHeight = Math.floor(dHeight / rHeight);
      }
      else {

        cY = Math.floor((aHeight - (dHeight / rWidth)) / 2);
        cWidth = Math.floor(dWidth / rWidth);
        cHeight = Math.floor(dHeight / rWidth);
      }

      backgroundPicture.set({
        copyStartX: cX,
        copyStartY: cY,
        copyWidth: cWidth,
        copyHeight: cHeight,
      });
    }
  };

  return {
    updateBackgroundPicture,
  };
};


// ------------------------------------------------------------------------
// Canvas UX interaction
// - Including drag-and-drop functionality
// ------------------------------------------------------------------------

// Build the update functionality
const initUpdates = () => {

  // The target entity controls are at the bottom of the screen
  let controlsEnabled = false;
  const areControlsEnabled = () => controlsEnabled;

  const entityControls = [entityStartX, entityStartY, entityScale, entityRoll, entityOpacity];

  const enableControls = () => {
    entityControls.forEach(control => control.removeAttribute('disabled'));
    entityFilter.removeAttribute('disabled'),
    controlsEnabled = true;
  };

  const disableControls = () => {
    entityControls.forEach(control => control.setAttribute('disabled', ''));
    entityFilter.setAttribute('disabled', '');
    controlsEnabled = false;
  };

  // Use a group to handle which entity is currently editable
  const updateGroup = scrawl.makeGroup({
    name: name('update-group'),
  });

  scrawl.makeUpdater({

    event: ['input', 'change'],
    origin: '.target-update',

    target: updateGroup,

    useNativeListener: true,
    preventDefault: true,

    updates: {
      startX: ['startX', '%'],
      startY: ['startY', '%'],
      scale: ['scale', 'float'],
      roll: ['roll', 'float'],
      opacity: ['globalAlpha', 'float'],
    },
  });

  scrawl.addNativeListener('change', () => {

    updateGroup.setArtefacts({ filters: [entityFilter.value] });

  }, entityFilter);

  // When changing between target entitys, we need to update controls to reflect current values for that entity
  const updateEntityControls = (entity, label) => {

    if (entity && label) {

      updateGroup.setArtefacts({
        method: 'fill',
      });

      updateGroup.clearArtefacts();

      // Need to use a timeout here to make sure updates happen after the latest Display cycle
      setTimeout(() => {

        const [w, h] = canvas.base.get('dimensions');
        const [x, y] = entity.get('start');
        const scale = entity.get('scale');
        const roll = entity.get('roll');
        const opacity = entity.get('globalAlpha');
        const filters = entity.get('filters')[0];

        // Positioning is relative to canvas dimensions
        const pX = (x / w) * 100; 
        const pY = (y / h) * 100; 

        entityBeingEdited.textContent = label;
        entityStartX.value = `${pX}`;
        entityStartY.value = `${pY}`;
        entityScale.value = `${scale}`;
        entityRoll.value = `${roll}`;
        entityOpacity.value = `${opacity}`;

        if (!filters) entityFilter.value = 'none';
        else entityFilter.value = filters;

        updateGroup.addArtefacts(entity);

        if (!controlsEnabled) enableControls();

      }, 0);
    }
  };

  // Build the drag functionality
  // - User can be either dragging, or scribbling; we use two groups to allow this
  // - Switch off dragging by moving all draggable entitys into dragHoldGroup
  // - Switch it back on by moving all draggable entitys into dragGroup
  const dragGroup = scrawl.makeGroup({ name: name('drag-group') });
  const dragHoldGroup = scrawl.makeGroup({ name: name('drag-hold-group') });

  // Dragging a target entity makes it the current entity for editing
  const dragger = scrawl.makeDragZone({

    zone: canvas,
    collisionGroup: dragGroup,
    exposeCurrentArtefact: true,
    endOn: ['up', 'leave'],
    updateOnEnd: () => { 

      const art = dragger().artefact;
      updateEntityControls(art, targetNamesObject[art.name]);
    },
  });

  const disableDragging = () => {

    dragHoldGroup.addArtefacts(...dragGroup.get('artefacts'));
    dragGroup.clearArtefacts();
  };

  const enableDragging = () => {

    dragGroup.addArtefacts(...dragHoldGroup.get('artefacts'));
    dragHoldGroup.clearArtefacts();
  }

  // Add in canvas click-to-unselect functionality
  // - Selecting an entity for editing happens as part of the drag-and-drop functionality
  // - This functionality cleans up things when user clicks anywhere on the canvas except over target or head entity
  const checkForCanvasClick = () => {

    const result = dragGroup.getArtefactAt(canvas.base.here);

    if (!result) cleanupAction();
  };

  scrawl.addNativeListener('click', checkForCanvasClick, canvas.domElement);

  return {
    updateGroup,
    updateEntityControls,
    areControlsEnabled,
    disableControls,
    dragGroup,
    disableDragging,
    enableDragging,
  };
};


// ------------------------------------------------------------------------
// Logo controls
// ------------------------------------------------------------------------
const initLogo = () => {

  scrawl.importDomImage('.logos');

  // State is determined by what is in the HTML code
  const logoElements = document.querySelectorAll('.logos');

  const logos = [...logoElements].map(el => {

    return {
      name: el.id,
      label: el.dataset.label || el.id,
    }
  });

  logos.forEach(logo => {

    const opt = document.createElement('option');

    opt.value = logo.name;
    opt.textContent = logo.label;

    logoChoice.appendChild(opt);
  });

  const logoGroup = scrawl.makeGroup({
    name: name('logo-group'),
    host: canvas.base,
    order: 2,
  });

  // Magic numbers for the actual dimensions of the logo image, divided by a convenient amount
  let logoPictureWidth = 0,
    logoPictureHeight = 0,
    currentLogo = logos[0].name;

  const logoPicture = scrawl.makePicture({
    name: name('logo'),
    group: logoGroup,
    asset: currentLogo,
    start: ['left', 'bottom'],
    handle: ['left', 'bottom'],
    dimensions: [logoPictureWidth, logoPictureHeight],
    copyDimensions: ['100%', '100%'],
    visibility: false,
  });

  const updateLogoChoice = () => {

    const logo = logoChoice.value;

    if (logo !== currentLogo) {

      currentLogo = logo;

      const asset = scrawl.findAsset(logo),
        scaler = getScaler(currentDimension);
      
      let width = asset.get('width'),
        height = asset.get('height');

      if (480 === scaler) {
        logoPictureWidth = width / 2.25;
        logoPictureHeight = height / 2.25;
      }
      else if (720 === scaler) {
        logoPictureWidth = width / 1.5;
        logoPictureHeight = height / 1.5;
      }
      else {
        logoPictureWidth = width;
        logoPictureHeight = height;
      }

      logoPicture.set({
        asset: logo,
        width: logoPictureWidth,
        height: logoPictureHeight,
      });
    }
  };
  scrawl.addNativeListener('change', updateLogoChoice, logoChoice);

  const updateLogoPosition = () => {

    // We invoke updateLogoChoice because image loading is async
    // - the logo is initially hidden; this will give it dimensions when first positioned 
    currentLogo = '';
    updateLogoChoice();

    switch (logoPosition.value) {

      case 'hide':
        logoPicture.set({
          visibility: false,
        });
        break;

      case 'top-left':
        logoPicture.set({
          start: ['left', 'top'],
          handle: ['left', 'top'],
          visibility: true,
        });
        break;

      case 'bottom-left':
        logoPicture.set({
          start: ['left', 'bottom'],
          handle: ['left', 'bottom'],
          visibility: true,
        });
        break;

      case 'bottom-right':
        logoPicture.set({
          start: ['right', 'bottom'],
          handle: ['right', 'bottom'],
          visibility: true,
        });
        break;

      case 'top-right':
        logoPicture.set({
          start: ['right', 'top'],
          handle: ['right', 'top'],
          visibility: true,
        });
        break;
    }
  };
  scrawl.addNativeListener('change', updateLogoPosition, logoPosition);

  return {
    updateLogoPosition,
  }
};


// ------------------------------------------------------------------------
// Scribble canvas
// - For drawing on the video while recording
// ------------------------------------------------------------------------
const initScribble = () => {

  // Initialize DOM scribbles button and associated modal
  // - The main "Scribbles" button opens an associated modal - all defined in HTML
  // - Users can use the modal to set the color and width of the scribble pen

  scrawl.addNativeListener('focus', () => scribblesColorInput.classList.add('is-focussed'), backgroundUpload);
  scrawl.addNativeListener('blur', () => scribblesColorInput.classList.remove('is-focussed'), backgroundUpload);
  scrawl.addNativeListener('focus', () => scribblesWidth.classList.add('is-focussed'), backgroundColorInput);
  scrawl.addNativeListener('blur', () => scribblesWidth.classList.remove('is-focussed'), backgroundColorInput);

  // Flag to indicate whether the user wants to scribble on the canvas, or not
  // - Required because user may also want to drag Targets around the canvas
  let scribblesAreActive = false;

  const getScribblesFlag = () => scribblesAreActive;

  const setScribblesFlag = (val, fromModal = false) => {

    val = !!val;
    scribblesAreActive = val;

    // We only need to update the modal checkbox when change is triggered from elsewhere
    if (!fromModal) {

      if (val) scribblesUseCheckbox.checked = '';
      else scribblesUseCheckbox.checked = null;
    }
  };

  scrawl.addNativeListener('change', () => {

    if (scribblesUseCheckbox.checked) {

      setScribblesFlag(true, true);
      disableDragging();
    }
    else {

      setScribblesFlag(false, true);
      enableDragging();
    }

  }, scribblesUseCheckbox);

  // Scribble color and width management
  let currentColor = '#000000',
    currentWidth = 1;

  scrawl.addNativeListener('change', () => {

    currentColor = scribblesColorInput.value;

  }, scribblesColorInput);

  scrawl.addNativeListener('change', () => {

    currentWidth = parseInt(scribblesWidth.value, 10);

  }, scribblesWidth);

  // Scribbling functionality
  // ------------------------
  const currentPins = [],
    lineHold = [],
    lineBin = [];

  let counter = 0,
    currentLine, lastX, lastY;

  const clearLines = () => {

    currentPins.length = 0;
  
    lineHold.forEach(line => line && line.kill());
    lineHold.length = 0;

    lineBin.forEach(line => line && line.kill());
    lineBin.length = 0;
  };
  scrawl.addNativeListener('click', clearLines, scribblesLineClear);

  const undoLine = () => {

    const line = lineHold.pop();

    if (line) {

        line.set({ visibility: false });
        lineBin.push(line);
    }
  };
  scrawl.addNativeListener('click', undoLine, scribblesLineUndo);

  const redoLine = () => {

    const line = lineBin.pop();

    if (line) {

        line.set({ visibility: true });
        lineHold.push(line);
    }
  };
  scrawl.addNativeListener('click', redoLine, scribblesLineRedo);

  // Accessibility
  // - CTRL + z     Clear the last line (undo)
  // - CTRL + y     Reinstate the last cleared line (redo)
  // - CTRL + x     Clear out all lines and reset (clear)
scrawl.makeKeyboardZone({

    zone: canvas,

    altOnly: {
      x: () => clearLines(),
      y: () => redoLine(),
      z: () => undoLine(),
    },
  });

  // We'll draw on a separate canvas, which then gets copied into the main canvas via a picture entity
  const scribbleCell = canvas.buildCell({
    name: name('scribble-cell'),
    dimensions: ['100%', '100%'],
    setRelativeDimensionsUsingBase: true,
    shown: false,
  });

  const getRelPos = (data) => {

    const { x, y, w, h } = data;

    const RX = `${(x / w) * 100}%`;
    const RY = `${(y / h) * 100}%`;

    return [RX, RY];
  }

  const startLine = function () {

    if (scribblesAreActive) {

      const here = canvas.getBaseHere();

      if (here.active) {

        currentPins.push(getRelPos(here));

        currentLine = scrawl.makePolyline({

          name: name(`line-${counter}`),
          group: scribbleCell.name,

          pins: currentPins,
          mapToPins: true,

          tension: 0.3,

          strokeStyle: currentColor,
          lineWidth: currentWidth,

          lineCap: 'round',
          lineJoin: 'round',

          method: 'draw',
        });

        counter++;
      }
    }
  };
  scrawl.addListener('down', startLine, canvas.domElement);

  const endLine = function () {

    if (scribblesAreActive && currentLine) lineHold.push(currentLine);

    currentLine = false;
    currentPins.length = 0;
    lastX = -1;
    lastY = -1;
  };
  scrawl.addListener(['up', 'leave'], endLine, canvas.domElement);

  const checkLine = function () {

    if (scribblesAreActive) {

      const here = canvas.getBaseHere();

      if (currentLine && here.active) {

        const {x, y} = here;

        if (x === lastX && y === lastY) return false;

        currentPins.push(getRelPos(here));

        currentLine.set({
            pins: currentPins,
        });

        lastX = x;
        lastY = y;
      }
    }
  };
  scrawl.addListener('move', checkLine, canvas.domElement);

  scrawl.makePicture({
    name: name('scribble-display'),
    asset: scribbleCell,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
    order: 999,
  });

  // Need a way to trigger scribbled lines to recalculate if user changes screen (video) dimensions
  const updateAllScribbles = () => {

    lineHold.forEach(line => line.set({ tension: 0.3 }));
    lineBin.forEach(line => line.set({ tension: 0.3 }));
  };

  return {
    getScribblesFlag,
    setScribblesFlag,
    updateAllScribbles,
  };
};


// ------------------------------------------------------------------------
// Control buttons management
// ------------------------------------------------------------------------
const dom = scrawl.initializeDomInputs([

  // Capture handles to the editing controls
  ['by-id', 'entity-being-edited'],
  ['by-id', 'current-canvas-dimensions'],
  ['input', 'startX', '50'],
  ['input', 'startY', '50'],
  ['input', 'scale', '1'],
  ['input', 'roll', '0'],
  ['input', 'opacity', '1'],
  ['select', 'target-filter', 0],

  // Capture handles to the head controls
  ['select', 'talking-head-camera', 0],
  ['input', 'use-talking-head', 'off'],
  ['input', 'show-talking-head', 'on'],
  ['input', 'head-horizontal', '75'],
  ['input', 'head-vertical', '75'],
  ['input', 'head-scale', '0.5'],
  ['input', 'head-opacity', '1'],
  ['input', 'head-rotation', '0'],
  ['select', 'head-shape', 0],
  ['select', 'head-background', 1],
  ['select', 'head-filter', 0],

  // Capture handles to the recording controls
  ['button', 'recording-modal-button', 'Record'],
  ['button', 'recording-modal-close', 'Close'],
  ['by-id', 'recording-modal'],
  ['select', 'recording-microphone', 0],
  ['select', 'video-output-filetype', 0],
  ['input', 'video-output-codec', ''],
  ['button', 'recording-start-button', 'Start recording'],

  // Capture handles to the recording visual display elements
  ['by-id', 'recording-timer'],
  ['by-id', 'microphone-level'],
  ['by-id', 'meter-bar'],

  // Capture handles to the targets-related HTML elements
  ['button', 'target-request-button', 'Request screen capture'],
  ['by-id', 'current-targets-hold'],
  ['by-id', 'targets-panel-summary'],

  // Capture handles to the background-related HTML elements
  ['input', 'background-upload', ''],
  ['by-id', 'background-upload-button'],
  ['input', 'background-color-input', '#ffffff'],
  ['by-id', 'background-color-button'],
  ['by-id', 'background-image-hold'],
  ['button', 'background-image-hide', 'Hide background image'],

  // Capture handles to the dimensions-related HTML elements
  ['button', 'dimensions-modal-button', 'Dimensions'],
  ['button', 'dimensions-modal-close', 'Close'],
  ['by-id', 'dimensions-modal'],
  ['select', 'video-dimensions', 2],

  // Capture handles to the dimensions-related HTML elements
  ['input', 'use-scribbles', 'off'],
  ['input', 'scribbles-color-input', '#000000'],
  ['input', 'scribbles-width', '1'],
  ['button', 'scribbles-line-undo', 'Undo line'],
  ['button', 'scribbles-line-redo', 'Restore line'],
  ['button', 'scribbles-line-clear', 'Clear lines'],

  // Capture handles to the logo positioning selector
  ['select', 'logo-choice', 0],
  ['select', 'logo-position', 0],

  // Capture handles for the instructions modal
  ['button', 'instructions-modal-button', 'Instructions'],
  ['button', 'instructions-modal-close', 'Close'],
  ['by-id', 'instructions-modal'],

  // Capture handles for the teleprompter modal and controls
  ['button', 'teleprompt-area-button', 'Use teleprompter'],
  ['button', 'teleprompt-editor-modal-button', 'Edit text'],
  ['button', 'teleprompt-editor-modal-close', 'Close'],
  ['button', 'teleprompt-test-button', 'Run test'],
  ['by-id', 'teleprompt-editor-modal'],
  ['by-id', 'teleprompt-editor'],
  ['by-id', 'teleprompter-reading'],
  ['by-id', 'teleprompter-stage'],
  ['by-id', 'app-panel'],
]);

const entityBeingEdited = dom['entity-being-edited'],
  currentCanvasDimensions = dom['current-canvas-dimensions'],
  entityStartX = dom['startX'],
  entityStartY = dom['startY'],
  entityScale = dom['scale'],
  entityRoll = dom['roll'],
  entityOpacity = dom['opacity'],
  entityFilter = dom['target-filter'],

  headUseCheckbox = dom['use-talking-head'],
  headCamera = dom['talking-head-camera'],
  headShowCheckbox = dom['show-talking-head'],
  headHorizontal = dom['head-horizontal'],
  headVertical = dom['head-vertical'],
  headScale = dom['head-scale'],
  headOpacity = dom['head-opacity'],
  headRotation = dom['head-rotation'],
  headShape = dom['head-shape'],
  headBackground = dom['head-background'],
  headFilter = dom['head-filter'],

  recordingModal = dom['recording-modal'],
  recordingButton = dom['recording-modal-button'],
  recordingCloseButton = dom['recording-modal-close'],
  recordingMicrophone = dom['recording-microphone'],
  recordingFiletype = dom['video-output-filetype'],
  recordingCodec = dom['video-output-codec'],
  recordingStartButton = dom['recording-start-button'],

  recordingTimer = dom['recording-timer'],
  microphoneLevel = dom['microphone-level'],
  meterBar = dom['meter-bar'],

  targetRequestButton = dom['target-request-button'],
  targetsHold = dom['current-targets-hold'],
  targetsPanelSummary = dom['targets-panel-summary'],

  backgroundUpload = dom['background-upload'],
  backgroundUploadButton = dom['background-upload-button'],
  backgroundColorInput = dom['background-color-input'],
  backgroundColorButton = dom['background-color-button'],
  backgroundImageHold = dom['background-image-hold'],
  backgroundImageHide = dom['background-image-hide'],

  dimensionsModal = dom['dimensions-modal'],
  dimensionsButton = dom['dimensions-modal-button'],
  dimensionsCloseButton = dom['dimensions-modal-close'],
  dimensionsSelector = dom['video-dimensions'],

  scribblesUseCheckbox = dom['use-scribbles'],
  scribblesColorInput = dom['scribbles-color-input'],
  scribblesWidth = dom['scribbles-width'],
  scribblesLineUndo = dom['scribbles-line-undo'],
  scribblesLineRedo = dom['scribbles-line-redo'],
  scribblesLineClear = dom['scribbles-line-clear'],

  logoChoice = dom['logo-choice'],
  logoPosition = dom['logo-position'],

  telepromptAreaButton = dom['teleprompt-area-button'],
  telepromptModal = dom['teleprompt-editor-modal'],
  telepromptButton = dom['teleprompt-editor-modal-button'],
  telepromptCloseButton = dom['teleprompt-editor-modal-close'],
  telepromptTestButton = dom['teleprompt-test-button'],
  telepromptEditor = dom['teleprompt-editor'],
  telepromptReading = dom['teleprompter-reading'],
  telepromptStage = dom['teleprompter-stage'],
  appPanel = dom['app-panel'],

  instructionsModal = dom['instructions-modal'],
  instructionsButton = dom['instructions-modal-button'],
  instructionsCloseButton = dom['instructions-modal-close'];



// ------------------------------------------------------------------------
// Filter effects
// ------------------------------------------------------------------------
scrawl.makeFilter({
  name: 'none',
  actions: [],
});

scrawl.makeFilter({
  name: 'blur',
  method: 'gaussianBlur',
  radius: 20,
  excludeTransparentPixels: true,
});

scrawl.makeFilter({
  name: 'gray',
  method: 'grayscale',
});

scrawl.makeFilter({
  name: 'monochrome',
  method: 'reducePalette',
  noiseType: 'bluenoise',
});

scrawl.makeFilter({
  name: 'sharpen',
  method: 'sharpen',
});

scrawl.makeFilter({
  name: 'nowhite',
  method: 'chroma',
  ranges: [[250, 250, 250, 255, 255, 255]],
  feather: 40,
});

// ------------------------------------------------------------------------
// Start the page running
// - Attempted to make the ordering of these invocations as irrelevant as possible
// - Be wary of including function calls defined in other invocations in an invocation function
// ------------------------------------------------------------------------

const {
  setScribblesFlag,
  updateAllScribbles,
} = initScribble();

const {
  updateLogoPosition,
} = initLogo();

const {
  updateGroup,
  updateEntityControls,
  areControlsEnabled,
  disableControls,
  dragGroup,
  disableDragging,
  enableDragging,
} = initUpdates();

const { 
  getDimensions,
  getScaler,
} = initDimensions();

const { 
  updateTargetScales,
  cleanupAction,
  targetNamesObject,
} = initTargets();

initTalkingHead();

const {
  updateBackgroundPicture,
} = initBackground();

const {
  startRecordingTimer,
  stopRecordingTimer,
} = initVideoRecording();

const {
  telepromptTimestamps,
  displayNextTelepromptLine,
  populateTelepromptState,
  telepromptHasScript,
} = initTeleprompter();

initInstructions();


// ------------------------------------------------------------------------
// Scrawl-canvas animation
// ------------------------------------------------------------------------
scrawl.makeRender({

  name: name('render'),
  target: canvas,
});

// ------------------------------------------------------------------------
// Request permissions
// ------------------------------------------------------------------------
DeviceManager.refreshDevices();

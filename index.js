// ------------------------------------------------------------------------
// Scrawl-canvas boilerplate
// ------------------------------------------------------------------------
import * as scrawl from './js/scrawl.js';
const name = (n) => `canvas-${n}`;
const canvas = scrawl.findCanvas('my-canvas');


// ------------------------------------------------------------------------
// MediaPipe imports
// ------------------------------------------------------------------------
import * as MediaPipe from './js/mediapipe-vision-bundle.js';


// ------------------------------------------------------------------------
// Camera and Audio device discovery
// ------------------------------------------------------------------------
const canWeEnumerateDevices = !!navigator.mediaDevices?.enumerateDevices;

const availableMicrophoneInputs = [],
  availableMicrophoneIds = [],
  availableCameraInputs = [],
  availableCameraIds = [];

let selectedMicrophone = 'none',
  selectedCamera = 'none';

const findMicrophoneDevices = () => {

  availableMicrophoneInputs.length = [];
  availableMicrophoneIds.length = [];

  return new Promise ((resolve, reject) => {

    if (canWeEnumerateDevices) {

      navigator.mediaDevices.enumerateDevices()
      .then((devices) => {

        devices.forEach((device) => {

          if (device.kind === 'audioinput') {

            availableMicrophoneInputs.push([
              device.deviceId, 
              device.label, 
              device.label.toLowerCase().includes('default') ? true : false,
            ]);

            availableMicrophoneIds.push(device.deviceId);
          }
        });

        if (!availableMicrophoneIds.includes(selectedMicrophone)) selectedMicrophone = 'none';

        resolve('Audio input devices discovered');
      })
      .catch(err => reject(`${err.name}: ${err.message}`));
    }
    
    else reject('Unable to find audio input devices');
  });
};

const findCameraInputDevices = async () => {

  availableCameraInputs.length = [];
  availableCameraIds.length = [];

  return new Promise ((resolve, reject) => {

    if (canWeEnumerateDevices) {

      navigator.mediaDevices.enumerateDevices()
      .then((devices) => {

        devices.forEach((device) => {

          if (device.kind === 'videoinput') {

            availableCameraInputs.push([
              device.deviceId, 
              device.label, 
              device.label.toLowerCase().includes('default') ? true : false,
            ]);

            availableCameraIds.push(device.deviceId);
          }
        });

        if (!availableCameraIds.includes(selectedCamera)) selectedCamera = 'none';

        resolve('Camera input devices discovered');
      })
      .catch(err => reject(`${err.name}: ${err.message}`));
    }
    
    else reject('Unable to find camera input devices');
  });
};


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
    }
  };

  // Add the update function to the modal's dimensionsSelector element
  scrawl.addNativeListener('change', update, dimensionsSelector);

  return { 
    getDimensions,
  };
};


// ------------------------------------------------------------------------
// Head management modal
// - generates a talking head - with the help of a Google MediaPipe solution
// - https://ai.google.dev/edge/mediapipe/solutions/guide
// ------------------------------------------------------------------------
const initTalkingHead = () => {

  // Camera discovery
  // - Runs every time the modal opens, to capture any changes in available cameras
  // - Discovers cameras, then lists them in the 'Selected camera' dropdown
  const cameraDiscovery = () => {

    findCameraInputDevices()
    .then(() => {

      const frag = document.createDocumentFragment();

      // Have we found any cameras?
      if (availableCameraInputs.length) {

        // We've found only one camera
        if (availableCameraInputs.length === 1) {

          const [id, label, def] = availableCameraInputs[0];

          selectedCamera = id;

          const opt = document.createElement('option');
          opt.value = id
          opt.textContent = label;
          opt.setAttribute('selected', '');
          frag.appendChild(opt);
        }

        // We have more than one camera
        else {

          availableCameraInputs.forEach(item => {

            const opt = document.createElement('option');
            opt.value = id
            opt.textContent = label;

            if (id === selectedCamera) opt.setAttribute('selected', '');

            frag.appendChild(opt);
          });
        }
      }

      // No cameras found
      else {

        selectedCamera = 'none';

        const opt = document.createElement('option');
        opt.value = 'none'
        opt.textContent = 'No cameras currently available';
        frag.appendChild(opt);
      }

      headCamera.replaceChildren(...frag.querySelectorAll('option'));
    })
    .catch(err => console.log('talkingHead camera listing error', err));
  };

  // Initialize DOM head button and associated modal
  headButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => openModal(headModal, cameraDiscovery), headButton);
  scrawl.addNativeListener('click', closeModal, headCloseButton);
  scrawl.addNativeListener('close', closeModal, headModal);

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

  const overlayPicture = scrawl.makePicture({

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
        });

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
        headRotation.removeAttribute('disabled');

        headIsDisplayed = true;
      }
      else if (!toggle && headIsDisplayed) {

        stopCamera();

        headHorizontal.setAttribute('disabled', '');
        headVertical.setAttribute('disabled', '');
        headScale.setAttribute('disabled', '');
        headRotation.setAttribute('disabled', '');

        headIsDisplayed = false;
      }
    }
    else {

      if (headIsDisplayed) stopCamera();

      headHorizontal.setAttribute('disabled', '');
      headVertical.setAttribute('disabled', '');
      headScale.setAttribute('disabled', '');
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
      ['head-rotation']: ['roll', 'float'],
    },
  });

  scrawl.addNativeListener('change', () => {

    const res = parseInt(headShape.value, 10);

    // Show round shape
    if (res) {

      squareShape.set({ visibility: false });
      roundShape.set({ visibility: true });
    }
    else {

      squareShape.set({ visibility: true });
      roundShape.set({ visibility: false });
    }

  }, headShape);

  scrawl.addNativeListener('change', () => {

    maskPicture.set({ 
      visibility: headBackground.value === '1' ? true : false,
    });

  }, headBackground);

  scrawl.addNativeListener('change', () => {

    if (headFilter.value) talkingHeadOutput.set({ filters: name(headFilter.value) });
    else talkingHeadOutput.set({ filters: [] });

  }, headFilter);
};


// ------------------------------------------------------------------------
// Targets management modal
// ------------------------------------------------------------------------
const initTargets = () => {

  // Initialize DOM targets button and associated modal
  targetsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => openModal(targetsModal), targetsButton);
  scrawl.addNativeListener('click', closeModal, targetsCloseButton);
  scrawl.addNativeListener('close', closeModal, targetsModal);

  scrawl.addNativeListener('click', () => requestScreenCapture(), targetRequestButton);

  // Local state
  let targetCount = 0;
  const targetsArray = [];

  // The main request screen capture function
  // - Users can add multiple screen-captured targets to the canvas
  const requestScreenCapture = () => {

    const targetId = name(`target-${targetCount}`);
    targetCount++;

    // Screen capture streams are brittle
    // - We need to remove associated assets and entitys from SC when they fail us
    let cleanup = () => console.log(`${targetId} - video track stream has ended`);

    // The main event!
    // - Gets the user's desired media stream (via browser functionality)
    // - Creates an SC asset (including a hidden video element) and Picture entity from it
    scrawl.importScreenCapture({

      name: targetId,
      audio: { suppressLocalAudioPlayback: true },
      onMediaStreamEnd: () => cleanup(),

    }).then(mycamera => {

      // Create a Picture entity to display the media stream on the canvas
      const targetPicture = scrawl.makePicture({

        name: `${targetId}-picture`,
        asset: mycamera.name,

        dimensions: [1, 1],
        copyDimensions: ['100%', '100%'],

        start: ['50%', '50%'],
        handle: ['50%', '50%'],

        strokeStyle: targetBorderColor.value,
        lineWidth: parseInt(targetBorderWidth.value, 10),
        lineDash: JSON.parse(targetBorderStyle.value),
        lineJoin: 'round',
        method: 'fill',

        button: {

          name: `${targetId}-button`,
          description: `Press enter to edit ${targetId}`,

          clickAction: function () {

            if (updateGroup.get('artefacts').includes(targetPicture.name)) cleanupAction();

            else {

              targetPicture.set({
                method: 'fillThenDraw',
              });

              updateGroup.setArtefacts({
                method: 'fill',
              });

              updateGroup.clearArtefacts();
              updateGroup.addArtefacts(targetPicture);

              updateEntityControls(targetPicture);

              entityBeingEdited.textContent = targetPicture.name;
            }
          },
        },

        onEnter: function () {

          targetPicture.set({
            method: 'fillThenDraw',
          });
        },

        onLeave: function () {

          targetPicture.set({
            method: 'fill',
          });
        },
      });

      // Target acquisition is asynchronous, given the need to manipulate the DOM
      // - Expect the work to complete within 1 second
      // - We can only set the Picture dimensions and scale after the media stream starts, well, streaming
      // - TODO: There's probably a better, more "listenery" way to achieve this
      let checkerAttempts = 0,
        listDiv;

      const checker = () => {

        setTimeout(() => {

          if (targetPicture.sourceLoaded) {

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
            targetsArray.push(targetPicture.name);

            // Each target needs a listing in the Targets modal
            listDiv = document.createElement('div');
            listDiv.id = `${targetId}-list-row`
            listDiv.classList.add('target-list-row');

            const itemTitle = document.createElement('div');
            itemTitle.textContent = targetId;
            listDiv.appendChild(itemTitle);

            const itemButton = document.createElement('button');
            itemButton.textContent = 'Remove';
            listDiv.appendChild(itemButton);

            // In case the user wantas to get rid of the target intentionally
            scrawl.addNativeListener('click', removeTarget, itemButton);

            targetsHold.appendChild(listDiv);

            updateGroup.setArtefacts({
              method: 'fill',
            });

            updateGroup.clearArtefacts();
            updateGroup.addArtefacts(targetPicture);

            updateGroup.setArtefacts({
              method: 'fillThenDraw',
            });

            updateEntityControls(targetPicture);
            closeModal();
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

        if (listDiv != null) listDiv.remove();
      }

      // Clean up the mess left behind when a user deliberately removes the target in the web page
      // - Can only be done by clicking the "Remove" button in the Targets modal
      const removeTarget = () => {

        if (mycamera.mediaStreamTrack != null) mycamera.mediaStreamTrack.stop();
        cleanup();
      };

    }).catch(err => console.log('err', err));
  };

  const cleanupAction = () => {

    updateGroup.setArtefacts({
      method: 'fill',
    });

    updateGroup.clearArtefacts();

    entityBeingEdited.textContent = 'no target selected';

    if (areControlsEnabled()) disableControls();
  }

  const updateTargetScales = (oldScaler, newScaler) => {

    if (oldScaler !== newScaler) {

      targetsArray.forEach(id => {

        const entity = scrawl.findEntity(id);

        if (entity) {

          const scale = entity.get('scale');

          entity.set({
            scale: ((scale / oldScaler) * newScaler),
          });

          // TODO: if the entity is currently being edited, need to adjust entityScale input
        }
      });
    }
  }

  scrawl.makeUpdater({

    event: ['input', 'change'],
    origin: '.target-border-controls',

    target: dragGroup,

    useNativeListener: true,
    preventDefault: true,

    updates: {
      ['target-border-width']: ['lineWidth', 'int'],
      ['target-border-style']: ['lineDash', 'parse'],
      ['target-border-color']: ['strokeStyle', 'raw'],
    },
  });

  return { 
    updateTargetScales,
    cleanupAction,
  };
};


// ------------------------------------------------------------------------
// Video recording and download functionality
// ------------------------------------------------------------------------
const initVideoRecording = () => {

  let selectedFiletype = 'mp4';

  // Microphone discovery
  // - Runs every time the modal opens, to capture any changes in available microphones
  const microphoneDiscovery = () => {

    findMicrophoneDevices()
    .then(() => {

      const frag = document.createDocumentFragment();

      if (availableMicrophoneInputs.length) {

        if (availableMicrophoneInputs.length === 1) {

          const [id, label] = availableMicrophoneInputs[0];

          selectedMicrophone = id;

          const opt = document.createElement('option');
          opt.value = id
          opt.textContent = label;
          opt.setAttribute('selected', '');
          frag.appendChild(opt);
        }

        else {

          availableMicrophoneInputs.forEach((item, index) => {

            const [id, label] = item;

            const opt = document.createElement('option');
            opt.value = id
            opt.textContent = label;

            if (id === selectedMicrophone) {

              opt.setAttribute('selected', '');
            }

            frag.appendChild(opt);
          });
        }
      }
      else {

        selectedMicrophone = 'none';

        const opt = document.createElement('option');
        opt.value = 'none'
        opt.textContent = 'No microphones currently available';
        frag.appendChild(opt);
      }

      recordingMicrophone.replaceChildren(...frag.querySelectorAll('option'));
    })
    .catch(err => console.log('recording microphone listing error', err));
  };

  // Initialize DOM recording button and associated modal
  recordingButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => openModal(recordingModal, microphoneDiscovery), recordingButton);
  scrawl.addNativeListener('click', closeModal, recordingCloseButton);
  scrawl.addNativeListener('close', closeModal, recordingModal)

  scrawl.addNativeListener('change', () => selectedMicrophone = recordingMicrophone.value, recordingMicrophone);

  scrawl.addNativeListener('change', () => selectedFiletype = recordingFiletype.value, recordingFiletype);

  // Capture and release the microphone feed
  let myMicrophone;

  // Get the microphone media stream
  const startMicrophone = () => {

    return new Promise ((resolve, reject) => {

      if (!myMicrophone) {

        scrawl.importMediaStream({

          name: name('microphone-feed'),
          audio: {
            deviceId: selectedMicrophone,
          },
          onMediaStreamEnd: () => stopMicrophone(),
        })
        .then(res => {

          myMicrophone = res;

          resolve(myMicrophone.mediaStreamTrack);
        })
        .catch(err => {

          console.log(err.message);
          reject('Failed to capture microphone');
        });
      }
    });
  };

  // Kill the camera media stream and all associated SC objects
  const stopMicrophone = () => {

    myMicrophone.source.srcObject = null;

    if (myMicrophone.mediaStreamTrack != null) myMicrophone.mediaStreamTrack.stop();

    myMicrophone.kill();
    myMicrophone = null;
  };

  // Local variables used by both startRecording and stopRecording functions
  let recorder, stopListener, dataCodec;

  const recordedChunks = [];

  // Keeping track of whether the page is currently recording, or not
  let isRecording = false;

  // Setup and start recording the canvas
  const startRecording = () => {

    if (!isRecording) {

      startMicrophone()
      .then(microphoneTrack => {

        isRecording = true;

        recordingStartButton.setAttribute('disabled', '');
        closeModal();

        stopListener = scrawl.addNativeListener('click', stopRecording, recordingButton);
        recordingButton.classList.add('is-recording');
        recordingButton.textContent = 'Stop recording';

        const stream = canvas.base.element.captureStream(25);
        stream.addTrack(microphoneTrack);

        let mimeType = `video/${selectedFiletype}`;
        if (recordingCodec.value) mimeType += `; codecs="${recordingCodec.value}"`;

        recorder = new MediaRecorder(stream, {
          mimeType,
        });

        recordedChunks.length = 0;

        recorder.ondataavailable = (e) => {

          if (e.data.size > 0) {

            dataCodec = e.data.type;
            recordedChunks.push(e.data);
          }
        };

        recorder.start(1000);
      })
      .catch(err => console.log(err));
    }
  };

  const stopRecording = () => {

    if (isRecording) {

      stopListener();
      stopListener = null;

      stopMicrophone();

      recorder.stop();
      recorder = null;

      setTimeout(() => {

        const blob = new Blob(recordedChunks, { type: dataCodec });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `SC-screen-recording_${Date().slice(4, 24)}.${selectedFiletype}`;
        a.click();

        URL.revokeObjectURL(url);

        recordingButton.classList.remove('is-recording');
        recordingButton.textContent = 'Record';

        recordingStartButton.removeAttribute('disabled');

        isRecording = false;
      }, 0);
    }
  };

  scrawl.addNativeListener('click', startRecording, recordingStartButton);
};


// ------------------------------------------------------------------------
// Setting the background
// - WARNING: loading more than a few images at one time will impact page performance!
// ------------------------------------------------------------------------

// Initialize background image functionality
const initBackground = () => {

  // Initialize DOM background button and associated modal
  // - The main "Background" button opens an associated modal - all defined in HTML
  // - Users can use the modal to upload new background images, or select an image loaded earlier
  // - Users can also drag-drop image files onto the canvas to upload/display them
  backgroundButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => openModal(backgroundModal), backgroundButton);
  scrawl.addNativeListener('click', closeModal, backgroundCloseButton);
  scrawl.addNativeListener('close', closeModal, backgroundModal);

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
              backgroundModal.close();
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

    backgroundModal.close();
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

  const entityControls = [entityStartX, entityStartY, entityScale, entityRoll, entityOrder];

  const enableControls = () => {
    entityControls.forEach(control => control.removeAttribute('disabled'));
    controlsEnabled = true;
  };

  const disableControls = () => {
    entityControls.forEach(control => control.setAttribute('disabled', ''));
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
      order: ['order', 'int'],
    },
  });

  // When changing between target entitys, we need to update controls to reflect current values for that entity
  const updateEntityControls = (entity) => {

    if (entity) {

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
        const order = entity.get('order');

        // Positioning is relative to canvas dimensions
        const pX = (x / w) * 100; 
        const pY = (y / h) * 100; 

        entityBeingEdited.textContent = entity.name;
        entityStartX.value = `${pX}`;
        entityStartY.value = `${pY}`;
        entityScale.value = `${scale}`;
        entityRoll.value = `${roll}`;
        entityOrder.value = `${order}`;

        updateGroup.addArtefacts(entity);

        updateGroup.setArtefacts({
          method: 'fillThenDraw',
        });

        if (!controlsEnabled) enableControls();

      }, 0);
    }
  };

  // Build the drag functionality
  const dragGroup = scrawl.makeGroup({

    name: name('drag-group'),
  });

  // Dragging a target entity makes it the current entity for editing
  const dragger = scrawl.makeDragZone({

    zone: canvas,
    collisionGroup: dragGroup,
    exposeCurrentArtefact: true,
    endOn: ['up', 'leave'],
    updateOnEnd: () => { updateEntityControls(dragger().artefact) },
  });

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
  ['input', 'order', '0'],

  // Capture handles to the talking head controls
  ['button', 'head-modal-button', 'Head'],
  ['button', 'head-modal-close', 'Close'],
  ['by-id', 'head-modal'],
  ['select', 'talking-head-camera', 0],
  ['input', 'use-talking-head', 'off'],
  ['input', 'show-talking-head', 'on'],
  ['input', 'head-horizontal', '75'],
  ['input', 'head-vertical', '75'],
  ['input', 'head-scale', '0.5'],
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

  // Capture handles to the targets-related HTML elements
  ['button', 'targets-modal-button', 'Targets'],
  ['button', 'targets-modal-close', 'Close'],
  ['by-id', 'targets-modal'],
  ['button', 'target-request-button', 'Request screen capture'],
  ['by-id', 'current-targets-hold'],
  ['input', 'target-border-width', '3'],
  ['select', 'target-border-style', 0],
  ['input', 'target-border-color', '#ff0000'],

  // Capture handles to the background-related HTML elements
  ['button', 'background-modal-button', 'Background'],
  ['button', 'background-modal-close', 'Close'],
  ['by-id', 'background-modal'],
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
]);

const entityBeingEdited = dom['entity-being-edited'],
  currentCanvasDimensions = dom['current-canvas-dimensions'],
  entityStartX = dom['startX'],
  entityStartY = dom['startY'],
  entityScale = dom['scale'],
  entityRoll = dom['roll'],
  entityOrder = dom['order'],

  headModal = dom['head-modal'],
  headButton = dom['head-modal-button'],
  headCloseButton = dom['head-modal-close'],
  headUseCheckbox = dom['use-talking-head'],
  headCamera = dom['talking-head-camera'],
  headShowCheckbox = dom['show-talking-head'],
  headHorizontal = dom['head-horizontal'],
  headVertical = dom['head-vertical'],
  headScale = dom['head-scale'],
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

  targetsModal = dom['targets-modal'],
  targetsButton = dom['targets-modal-button'],
  targetsCloseButton = dom['targets-modal-close'],
  targetRequestButton = dom['target-request-button'],
  targetsHold = dom['current-targets-hold'],
  targetBorderWidth = dom['target-border-width'],
  targetBorderStyle = dom['target-border-style'],
  targetBorderColor = dom['target-border-color'],

  backgroundModal = dom['background-modal'],
  backgroundButton = dom['background-modal-button'],
  backgroundCloseButton = dom['background-modal-close'],
  backgroundUpload = dom['background-upload'],
  backgroundUploadButton = dom['background-upload-button'],
  backgroundColorInput = dom['background-color-input'],
  backgroundColorButton = dom['background-color-button'],
  backgroundImageHold = dom['background-image-hold'],
  backgroundImageHide = dom['background-image-hide'],

  dimensionsModal = dom['dimensions-modal'],
  dimensionsButton = dom['dimensions-modal-button'],
  dimensionsCloseButton = dom['dimensions-modal-close'],
  dimensionsSelector = dom['video-dimensions'];


// ------------------------------------------------------------------------
// Filter effects
// ------------------------------------------------------------------------

scrawl.makeFilter({

  name: name('blur-effect'),
  method: 'gaussianBlur',
  radius: 20,
  excludeTransparentPixels: true,
});

scrawl.makeFilter({

  name: name('gray-effect'),
  method: 'grayscale',
});

scrawl.makeFilter({

  name: name('pixelate-effect'),
  method: 'pixelate',
  tileWidth: 20,
  tileHeight: 20,
});

scrawl.makeFilter({

  name: name('monochrome-effect'),
  method: 'reducePalette',
  noiseType: 'bluenoise',
});

scrawl.makeFilter({

  name: name('sharpen-effect'),
  method: 'sharpen',
});

scrawl.makeFilter({

  name: name('outline-effect'),
  method: 'flood',
  reference: 'gray',
  opacity: 0.95,
});

scrawl.makeFilter({

  name: name('cartoon-effect'),
  actions: [
    {
      action: 'grayscale',
      lineOut: 'top-filter-1',
    },{
      lineIn: 'top-filter-1',
      action: 'gaussian-blur',
      radius: 1,
      lineOut: 'top-filter-1',
    },{
      lineIn: 'top-filter-1',
      action: 'matrix',
      weights: [1, 1, 1, 1, -8, 1, 1, 1, 1],
      lineOut: 'top-filter-2',
    },{
      lineIn: 'top-filter-2',
      action: 'channels-to-alpha',
      lineOut: 'top-filter-2',
    },{
      lineIn: 'top-filter-2',
      action: 'threshold',
      low: [0, 0, 0, 0],
      high: [0, 0, 0, 255],
      includeAlpha: true,
      level: 20,
      lineOut: 'top-filter-2',
    },{
      lineIn: 'source',
      action: 'step-channels',
      red: 15,
      green: 60,
      blue: 60,
      lineOut: 'bottom-filter',
    },{
      lineIn: 'bottom-filter',
      action: 'modulate-channels',
      red: 2,
      green: 2,
      blue: 2,
      alpha: 0.5,
      lineOut: 'bottom-filter',
    },{
      lineIn: 'top-filter-2',
      lineMix: 'bottom-filter',
      action: 'compose',
      compose: 'source-over',
    }
  ],
});


// ------------------------------------------------------------------------
// Start the page running
// ------------------------------------------------------------------------

const {
  updateGroup,
  updateEntityControls,
  areControlsEnabled,
  disableControls,
  dragGroup,
} = initUpdates();

const { 
  getDimensions,
} = initDimensions();

const { 
  updateTargetScales,
  cleanupAction,
} = initTargets();

initTalkingHead();

const {
  updateBackgroundPicture,
} = initBackground();

initVideoRecording();


// ------------------------------------------------------------------------
// Scrawl-canvas animation
// ------------------------------------------------------------------------
scrawl.makeRender({

  name: name('render'),
  target: canvas,
});

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
// Video dimensions magic numbers
// ------------------------------------------------------------------------
let currentDimension = 'landscape_480';

const initDimensions = () => {

  dimensionsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => dimensionsModal.showModal(), dimensionsButton);
  scrawl.addNativeListener('click', () => dimensionsModal.close(), dimensionsCloseButton);
  currentCanvasDimensions.textContent = '854 by 480px';

  const magicDimensions = {

    // [width, height, scaler]
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

  const getDimensions = (dim) => {

    const [width, height] = magicDimensions[dim];
    return [width, height];
  };

  const getScaler = (dim) => {

    return magicDimensions[dim][2];
  };

  const update = () => {

    const newDimension = dimensionsSelector.value;

    if (newDimension !== currentDimension) {

      canvas.setBase({ dimensions: getDimensions(newDimension) });

      updateBackgroundPicture();
      updateTargetScales(getScaler(currentDimension), getScaler(newDimension));

      currentDimension = newDimension;

      const [w, h] = getDimensions(currentDimension);

      currentCanvasDimensions.textContent = `${w} by ${h}px`;
    }
  };

  scrawl.addNativeListener('change', update, dimensionsSelector);

  return { magicDimensions, getDimensions, getScaler }
};


// ------------------------------------------------------------------------
// Talking head - with the help of a Google MediaPipe solution
// - https://ai.google.dev/edge/mediapipe/solutions/guide
// ------------------------------------------------------------------------
const initTalkingHead = () => {

  headButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => headModal.showModal(), headButton);
  scrawl.addNativeListener('click', () => headModal.close(), headCloseButton);

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
  const talkingHeadInput = canvas.buildCell({

    name: name('talking-head-input'),
    dimensions: [768, 768],
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
    dimensions: [768, 768],
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
    }
  };

  // The inputPicture's asset will be the camera feed, in due course
  const inputPicture = scrawl.makePicture({

    name: name('talking-head-input-picture'),
    group: talkingHeadInput,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
  });

  // The maskPicture displays the mask Cell in the output Cell 
  // - We can blur it a bit to make it appear less harsh
  const headBlur = scrawl.makeFilter({

    name: name('head-blur'),
    method: 'gaussianBlur',
    radius: 2,
  });

  const maskPicture = scrawl.makePicture({

    name: name('talking-head-mask-picture'),
    group: talkingHeadOutput,
    asset: talkingHeadMask,
    dimensions: ['100%', '100%'],
    copyDimensions: ['100%', '100%'],
    filters: [headBlur],
  });

  // The overlayPicture's asset will also be the camera feed
  // - This time, it goes to the output Cell
  const overlayPicture = scrawl.makePicture({

    name: name('talking-head-overlay-picture'),
    group: talkingHeadOutput,
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

    strokeStyle: 'red',
    lineWidth: 4,
    lineJoin: 'round',
    method: 'fill',

    visibility: false,
  });

  // Capture the device camera output - but only after the user agrees
  // - Assumes the user is on a laptop-type device with a built-in camera!
  let mycamera,
    myCameraAnimation;

  const startCamera = () => {

    scrawl.importMediaStream({

      name: name('camera-feed'),
      audio: false,
      width: 768,
      height: 768,
      onMediaStreamEnd: () => stopCamera(),

    }).then(res => {

      mycamera = res;

      talkingHeadInput.set({
        cleared: true,
        compiled: true,
      });

      talkingHeadOutput.set({
        cleared: true,
        compiled: true,
      });

      inputPicture.set({ asset: mycamera });
      overlayPicture.set({ asset: mycamera });
      outputPicture.set ({ visibility: true });

      // We need to feed input data into the model discretely, via an SC animation object
      myCameraAnimation = scrawl.makeAnimation({

        name: name('head-segmenter'),
        fn: () => {

          if (imageSegmenter && imageSegmenter.segmentForVideo) {

            imageSegmenter.segmentForVideo(talkingHeadInput.element, performance.now(), processModelData);
          }
        }
      });

      headShowCheckbox.removeAttribute('disabled');

    }).catch(err => console.log(err.message));
  };

  const stopCamera = () => {

    headShowCheckbox.setAttribute('disabled', '');

    console.log(mycamera);

    mycamera.source.srcObject = null;

    if (mycamera.mediaStreamTrack != null) mycamera.mediaStreamTrack.stop();

    myCameraAnimation.kill();

    talkingHeadInput.set({
      cleared: false,
      compiled: false,
    });

    talkingHeadOutput.set({
      cleared: false,
      compiled: false,
    });

    inputPicture.set({ asset: '' });
    overlayPicture.set({ asset: '' });
    outputPicture.set ({ visibility: false });

    mycamera.kill();
  };

  // Displaying and removing the talking head
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

  // More event listeners
  scrawl.addNativeListener('change', () => {

    if (headUseCheckbox.checked) toggleHead(true);
    else toggleHead(false);

  }, headUseCheckbox);

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
};


// ------------------------------------------------------------------------
// Targets management
// ------------------------------------------------------------------------
const initTargets = () => {

  // Prepare page buttons for UX
  targetsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => targetsModal.showModal(), targetsButton); 
  scrawl.addNativeListener('click', () => targetsModal.close(), targetsCloseButton);
  scrawl.addNativeListener('click', () => requestScreenCapture(), targetRequestButton);

  // Local target entity tracker state
  let targetCount = 0;

  const targetsArray = [];

  // The main request screen capture function
  // - Users can add multiple screen captured targets in the canvas
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

        strokeStyle: 'red',
        lineWidth: 4,
        lineJoin: 'round',
        method: 'fill',

        button: {

          name: `${targetId}-button`,
          description: `Press enter to edit ${targetId}`,

          clickAction: function () {

            targetPicture.set({
              lineDash: [],
              method: 'fillThenDraw',
            });

            updateGroup.setArtefacts({
              lineDash: [],
              method: 'fill',
            });

            updateGroup.clearArtefacts();
            updateGroup.addArtefacts(targetPicture);

            updateEntityControls(targetPicture);

            entityBeingEdited.textContent = targetPicture.name;
            entityStartX.focus();
          },
        },

        onEnter: function () {

          targetPicture.set({
            lineDash: [5, 3],
            method: 'fillThenDraw',
          });
        },

        onLeave: function () {

          targetPicture.set({
            lineDash: [],
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

        if (currentUpdate.includes(targetPicture.name)) {

          // This is repeated code - needs to be refactored
          updateGroup.setArtefacts({
            lineDash: [],
            method: 'fill',
          });

          updateGroup.clearArtefacts();

          entityBeingEdited.textContent = 'no target selected';

          if (areControlsEnabled()) disableControls();
        }

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

  const updateTargetScales = (oldScaler, newScaler) => {

    if (oldScaler !== newScaler) {

      targetsArray.forEach(id => {

        const entity = scrawl.findEntity(id);

        if (entity) {

          const scale = entity.get('scale');

          entity.set({
            scale: ((scale / oldScaler) * newScaler),
          });
        }
      });
    }
  }

  return { requestScreenCapture, updateTargetScales };
};


// ------------------------------------------------------------------------
// Video recording and download functionality
// ------------------------------------------------------------------------
const initVideoRecording = () => {

  let recorder, recordedChunks;

  videoButton.addEventListener("click", () => {

    isRecordingVideo = !isRecordingVideo;

    if (isRecordingVideo) {

      videoButton.textContent = "Stop";

      const stream = canvas.domElement.captureStream(25);

      recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8"
      });

      recordedChunks = [];

      recorder.ondataavailable = (e) => {

        if (e.data.size > 0) recordedChunks.push(e.data);
      };

        recorder.start();
      }
    else {

      videoButton.textContent = "Record";

      recorder.stop();

      setTimeout(() => {

        const blob = new Blob(recordedChunks, { type: "video/webm" });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `SC-screen-recording_${Date().slice(4, 24)}.webm`;
        a.click();

        URL.revokeObjectURL(url);
      }, 0);
    }
  });
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
  scrawl.addNativeListener('click', () => backgroundModal.showModal(), backgroundButton);
  scrawl.addNativeListener('click', () => backgroundModal.close(), backgroundCloseButton);
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

      const [dWidth, dHeight] = canvas.base.get('dimensions');

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
    backgroundPicture,
    addBackgroundAsset,
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
        lineDash: [],
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
          lineDash: [],
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

    if (!result) {

      updateGroup.setArtefacts({
        lineDash: [],
        method: 'fill',
      });

      updateGroup.clearArtefacts();

      entityBeingEdited.textContent = 'no target selected';

      if (controlsEnabled) disableControls();
    }
  };

  scrawl.addNativeListener('click', checkForCanvasClick, canvas.domElement);

  return {
    updateGroup,
    updateEntityControls,
    areControlsEnabled,
    enableControls,
    disableControls,
    dragGroup,
    dragger,
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

  ['button', 'head-modal-button', 'Head'],
  ['button', 'head-modal-close', 'Close'],
  ['by-id', 'head-modal'],
  ['input', 'use-talking-head', 'off'],
  ['input', 'show-talking-head', 'on'],
  ['input', 'head-horizontal', '75'],
  ['input', 'head-vertical', '75'],
  ['input', 'head-scale', '1'],
  ['input', 'head-rotation', '0'],

  ['button', 'video-toggle', 'Record'],

  // Capture handles to the targets-related HTML elements
  ['button', 'targets-modal-button', 'Targets'],
  ['button', 'targets-modal-close', 'Close'],
  ['by-id', 'targets-modal'],
  ['button', 'target-request-button', 'Request screen capture'],
  ['by-id', 'current-targets-hold'],

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
  headShowCheckbox = dom['show-talking-head'],
  headHorizontal = dom['head-horizontal'],
  headVertical = dom['head-vertical'],
  headScale = dom['head-scale'],
  headRotation = dom['head-rotation'],

  videoButton = dom['video-toggle'],

  targetsModal = dom['targets-modal'],
  targetsButton = dom['targets-modal-button'],
  targetsCloseButton = dom['targets-modal-close'],
  targetRequestButton = dom['target-request-button'],
  targetsHold = dom['current-targets-hold'],

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
// Start the page running
// ------------------------------------------------------------------------
const {
  updateGroup,
  updateEntityControls,
  areControlsEnabled,
  // enableControls,
  disableControls,
  dragGroup,
  // dragger,
} = initUpdates();

const { 
  // magicDimensions,
  getDimensions,
  // getScaler,
} = initDimensions();

const { 
  // requestScreenCapture,
  updateTargetScales,
} = initTargets();

// const { 
//   talkingHead,
// } = initTalkingHead();
initTalkingHead();

const {
  // currentBackgroundAsset,
  // backgroundPicture,
  // addBackgroundAsset,
  updateBackgroundPicture,
} = initBackground();


// ------------------------------------------------------------------------
// Keyboard accessibility
// ------------------------------------------------------------------------


// ------------------------------------------------------------------------
// Scrawl-canvas animation
// ------------------------------------------------------------------------
scrawl.makeRender({

  name: name('render'),
  target: canvas,
});


// ------------------------------------------------------------------------
// Development and troubleshooting
// ------------------------------------------------------------------------
console.log(scrawl.library);


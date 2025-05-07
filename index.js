// ------------------------------------------------------------------------
// Scrawl-canvas boilerplate
// ------------------------------------------------------------------------
import * as scrawl from './js/scrawl.js';
const name = (n) => `canvas-${n}`;
const canvas = scrawl.findCanvas('my-canvas');


// ------------------------------------------------------------------------
// Video dimensions magic numbers
// ------------------------------------------------------------------------
let currentDimension = 'landscape_480';

const initDimensions = () => {

  dimensionsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => dimensionsModal.showModal(), dimensionsButton);
  scrawl.addNativeListener('click', () => dimensionsModal.close(), dimensionsCloseButton);

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

  // Talking head can go in its own Cell
  const talkingHeadAsset = canvas.buildCell({

    name: name('talking-head-asset'),
    dimensions: ['25%', '25%'],
    shown: false,
  });

  // Displaying the Cell in the canvas
  const talkingHead = scrawl.makePicture({

    name: name('talking-head'),
    asset: talkingHeadAsset,
    order: 1,

    dimensions: ['40%', '40%'],
    copyDimensions: ['100%', '100%'],

    start: ['80%', '80%'],
    handle: ['center', 'center'],

    flipReverse: true,

    visibility: false,

    lineDash: [2, 2],
    lineWidth: 1,
    strokeStyle: 'rgb(100 100 100 / 0.5)',
    method: 'fillThenDraw',
  });

  // Some convenience handles for the media stream asset
  let myMediaStream, mySegmentationModel, myBackground, myOutline;

  // Blur filter, to make the talking head meld with the background
  scrawl.makeFilter({

    name: name('body-blur'),
    method: 'gaussianBlur',
    radius: 5,
  });

  // MediaPipe outputs its results to a WebGL canvas element - SC can use that as an asset source
  // But because we want to manipulate that data we can route it through an SC raw asset wrapper
  const myModelOutputWrapper = scrawl.makeRawAsset({

    name: name('mediapipe-model-interpreter'),

    userAttributes: [
      {

        key: 'mask',
        defaultValue: [],
        setter: function (item) {

          item = (item.segmentationMask) ? item.segmentationMask : false;

          if (item) {

            this.canvasWidth = item.width;
            this.canvasHeight = item.height;
            this.mask = item;
            this.dirtyData = true;
          }
        },

      },{

        key: 'canvasWidth',
        defaultValue: 0,
        setter: () => {},

      },{

        key: 'canvasHeight',
        defaultValue: 0,
        setter: () => {},
      }
    ],

    updateSource: function (assetWrapper) {

      const { element, engine, canvasWidth, canvasHeight, mask } = assetWrapper;

      if (canvasWidth && canvasHeight && mask) {

        element.width = canvasWidth;
        element.height = canvasHeight;

        engine.drawImage(mask, 0, 0, canvasWidth, canvasHeight);
      }
    },
  });

  // The forever loop function captures the MediaPipe model's output and passes it on to our raw asset for processing
  const updateModelOutputWrapper = function (mask) {

    myModelOutputWrapper.set({ mask });

    if (!myOutline) {

      myOutline = scrawl.makePicture({

        name: name('mediapipe-results-outline'),
        group: talkingHeadAsset,
        asset: myModelOutputWrapper,
        dimensions: ['100%', '100%'],
        copyDimensions: ['100%', '100%'],
        filters: [name('body-blur')],
      });
    }
  };

  // Capture the user's device media stream
  scrawl.importMediaStream({

    name: name('device-camera'),
    audio: false,

  }).then(mycamera => {

    myMediaStream = mycamera;

    // Firefox bugfix
    myMediaStream.source.width = "1280";
    myMediaStream.source.height = "720";

    scrawl.makePicture({

      name: name('body'),
      group: talkingHeadAsset,
      asset: mycamera.name,
      order: 1,

      dimensions: ['100%', '100%'],
      copyDimensions: ['100%', '100%'],

      globalCompositeOperation: 'source-in',
    });

    // Start the MediaPipe model
    // The SelfieSegmentation object/class comes from the mediapipe-selfie-segmentation.js code
    mySegmentationModel = new SelfieSegmentation({

      // Have to go outside for this because I don't understand what the model wants
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    mySegmentationModel.setOptions({ modelSelection: 1 });
    mySegmentationModel.onResults(updateModelOutputWrapper);

    // The Camera object/class comes from the mediapipe-camera-utils.js code
    const mediaPipeCamera = new Camera(myMediaStream.source, {

      onFrame: async () => {

        await mySegmentationModel.send({image: myMediaStream.source});
      },

      width: 1280,
      height: 720,
    });

    mediaPipeCamera.start();

  }).catch(err => console.log(err.message));

  // Displaying the talking head
  let headIsVisible = false;

  const manageHead = () => {

    headIsVisible = !headIsVisible;

    if (headIsVisible) {

      headButton.textContent = 'Hide head';
      talkingHead.set({ visibility: true});
    }
    else {

      headButton.textContent = 'Show head';
      talkingHead.set({ visibility: false});
    }
  };
  scrawl.addNativeListener('click', manageHead, headButton);

  // Return the talking head picture entity (for keyboard control)
  return { talkingHead };
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
  ['input', 'startX', '50'],
  ['input', 'startY', '50'],
  ['input', 'scale', '1'],
  ['input', 'roll', '0'],
  ['input', 'order', '0'],

  ['button', 'video-toggle', 'Record'],
  ['button', 'head-toggle', 'Show head'],

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
  entityStartX = dom['startX'],
  entityStartY = dom['startY'],
  entityScale = dom['scale'],
  entityRoll = dom['roll'],
  entityOrder = dom['order'],

  videoButton = dom['video-toggle'],
  headButton = dom['head-toggle'],

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
  magicDimensions,
  getDimensions,
  getScaler,
} = initDimensions();

const { 
  // requestScreenCapture,
  updateTargetScales,
} = initTargets();

const { 
  talkingHead,
} = initTalkingHead();

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


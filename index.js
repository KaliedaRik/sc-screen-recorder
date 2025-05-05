// ------------------------------------------------------------------------
// Scrawl-canvas boilerplate
// ------------------------------------------------------------------------
import * as scrawl from './js/scrawl.js';
const name = (n) => `canvas-${n}`;
const canvas = scrawl.findCanvas('my-canvas');


// ------------------------------------------------------------------------
// Scrawl-canvas animation
// ------------------------------------------------------------------------
scrawl.makeRender({

  name: name('render'),
  target: canvas,
});


// ------------------------------------------------------------------------
// Video dimensions magic numbers
// ------------------------------------------------------------------------
// const baseMeasure = 80;

// const magicDimensions = {

//   // [width, height, width / baseMeasure, height / width]
//   landscape_1080: [1920, 1080, 1920 / baseMeasure, 1080 / 1920],
//   landscape_720: [1280, 720, 1280 / baseMeasure, 720 / 1280],
//   landscape_480: [854, 480, 854 / baseMeasure, 480 / 854],
//   square_1080: [1080, 1080, 1080 / baseMeasure, 1080 / 1080],
//   square_720: [720, 720, 720 / baseMeasure, 720 / 720],
//   square_480: [480, 480, 480 / baseMeasure, 480 / 480],
//   portrait_1080: [1080, 1920, 1080 / baseMeasure, 1920 / 1080],
//   portrait_720: [720, 1280, 720 / baseMeasure, 1280 / 720],
//   portrait_480: [480, 854, 480 / baseMeasure, 854 / 480],
// };

let currentDimension = 'landscape_480';

// const getDimensions = (dim) => {

//   const [width, height] = magicDimensions[dim];
//   return [width, height];
// };

  // dimensionsModal = dom['dimensions-modal'],
  // dimensionsButton = dom['dimensions-modal-button'],
  // dimensionsCloseButton = dom['dimensions-modal-close'],
  // dimensionsSelector = dom['video-dimensions'];

const initDimensions = () => {

  dimensionsButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => dimensionsModal.showModal(), dimensionsButton);
  scrawl.addNativeListener('click', () => dimensionsModal.close(), dimensionsCloseButton);

  const baseMeasure = 80;

  const magicDimensions = {

    // [width, height, width / baseMeasure, height / width]
    landscape_1080: [1920, 1080, 1920 / baseMeasure, 1080 / 1920],
    landscape_720: [1280, 720, 1280 / baseMeasure, 720 / 1280],
    landscape_480: [854, 480, 854 / baseMeasure, 480 / 854],
    square_1080: [1080, 1080, 1080 / baseMeasure, 1080 / 1080],
    square_720: [720, 720, 720 / baseMeasure, 720 / 720],
    square_480: [480, 480, 480 / baseMeasure, 480 / 480],
    portrait_1080: [1080, 1920, 1080 / baseMeasure, 1920 / 1080],
    portrait_720: [720, 1280, 720 / baseMeasure, 1280 / 720],
    portrait_480: [480, 854, 480 / baseMeasure, 854 / 480],
  };

  const getDimensions = (dim) => {

    const [width, height] = magicDimensions[dim];
    return [width, height];
  };

  const update = () => {

    const newDimension = dimensionsSelector.value;

    if (newDimension !== currentDimension) {

      canvas.setBase({ dimensions: getDimensions(newDimension) });

      currentDimension = newDimension;

      updateBackgroundPicture();
    }
  };

  scrawl.addNativeListener('change', update, dimensionsSelector);

  return { magicDimensions, getDimensions }
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
  return talkingHead;
};


// ------------------------------------------------------------------------
// Screen capture button management
// ------------------------------------------------------------------------
const initScreenCapture = () => {

  let targetSelected = false,
    cameraAsset, targetPicture;

  const cleanUp = () => {

    if (cameraAsset) {

      cameraAsset.kill();
      cameraAsset = null;
    }

    if (targetPicture) {

      targetPicture.kill();
      targetPicture = null;
    }

    targetSelected = false;
  };

  const updateToggle = () => {

    if (targetSelected) targetButton.textContent = 'Drop target';
    else targetButton.textContent = 'Get target';

    targetButton.removeAttribute('disabled');
  };

  const requestScreenCapture = () => {

    cleanUp();

    scrawl.importScreenCapture({

      name: name('my-screen-capture'),
      audio: { suppressLocalAudioPlayback: true },

    }).then(mycamera => {

      cameraAsset = mycamera;
      targetSelected = true;

      targetPicture = scrawl.makePicture({

        name: name('background'),
        asset: mycamera.name,

        dimensions: ['100%', '100%'],
        copyDimensions: ['100%', '100%'],
      });

      updateToggle();

    }).catch(err => {

      cleanUp();
      updateToggle();
    });
  };

  const releaseScreenCapture = () => {

    cleanUp();
    updateToggle();
  };

  const toggleScreenCapture = () => {

    targetButton.setAttribute('disabled', '');

    if (targetSelected) releaseScreenCapture();
    else requestScreenCapture();
  };

  scrawl.addNativeListener('click', toggleScreenCapture, targetButton);
}


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

// Only one background image can be displayed at any time
// - Future TODO - add in some functionality to allow users to stop showing the background image?
let currentBackgroundAsset;

// Initialize background image functionality
const backgroundInit = () => {

  // Initialize DOM background button and associated modal
  // - The main "Background" button opens an associated modal - all defined in HTML
  // - Users can use the modal to upload new background images, or select an image loaded earlier
  // - Users can also drag-drop image files onto the canvas to upload/display them
  backgroundButton.removeAttribute('disabled');
  scrawl.addNativeListener('click', () => backgroundModal.showModal(), backgroundButton);
  scrawl.addNativeListener('click', () => backgroundModal.close(), backgroundCloseButton);
  scrawl.addNativeListener('focus', () => backgroundUploadButton.classList.add('is-focussed'), backgroundUpload);
  scrawl.addNativeListener('blur', () => backgroundUploadButton.classList.remove('is-focussed'), backgroundUpload);

  // Create a Picture entity to display the background image in the canvas
  const backgroundPicture = scrawl.makePicture({

    name: name('background'),
    dimensions: ['100%', '100%'],
  });

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
        btn.setAttribute('data-target', imageId)

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
  };

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
// Control buttons management
// ------------------------------------------------------------------------
const dom = scrawl.initializeDomInputs([
  ['button', 'target-toggle', 'Get target'],
  ['button', 'video-toggle', 'Record'],
  ['button', 'head-toggle', 'Show head'],

  // Capture handles to the background-related HTML elements
  ['button', 'background-modal-button', 'Background'],
  ['button', 'background-modal-close', 'Close'],
  ['input', 'background-upload', ''],
  ['by-id', 'background-modal'],
  ['by-id', 'background-upload-button'],
  ['by-id', 'background-image-hold'],

  // Capture handles to the dimensions-related HTML elements
  ['button', 'dimensions-modal-button', 'Dimensions'],
  ['button', 'dimensions-modal-close', 'Close'],
  ['by-id', 'dimensions-modal'],
  ['select', 'video-dimensions', 2],
]);

const targetButton = dom['target-toggle'],
  videoButton = dom['video-toggle'],
  headButton = dom['head-toggle'],

  backgroundModal = dom['background-modal'],
  backgroundButton = dom['background-modal-button'],
  backgroundCloseButton = dom['background-modal-close'],
  backgroundUpload = dom['background-upload'],
  backgroundUploadButton = dom['background-upload-button'],
  backgroundImageHold = dom['background-image-hold'],

  dimensionsModal = dom['dimensions-modal'],
  dimensionsButton = dom['dimensions-modal-button'],
  dimensionsCloseButton = dom['dimensions-modal-close'],
  dimensionsSelector = dom['video-dimensions'];


// ------------------------------------------------------------------------
// Start the page running
// ------------------------------------------------------------------------
initScreenCapture();

const { magicDimensions, getDimensions } = initDimensions();

const headEntity = initTalkingHead();

const { backgroundPicture, addBackgroundAsset, updateBackgroundPicture } = backgroundInit();



// ------------------------------------------------------------------------
// Keyboard accessibility
// ------------------------------------------------------------------------


// ------------------------------------------------------------------------
// Drag-and-drop functionality
// ------------------------------------------------------------------------
const dragGroup = scrawl.makeGroup({

  name: name('drag-group'),
  artefacts: [headEntity],
});

scrawl.makeDragZone({

  zone: canvas,
  collisionGroup: dragGroup,
  endOn: ['up', 'leave'],
});


// ------------------------------------------------------------------------
// Development and troubleshooting
// ------------------------------------------------------------------------
console.log(scrawl.library);


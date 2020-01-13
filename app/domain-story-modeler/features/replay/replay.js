'use strict';

import { CONNECTION, GROUP } from '../../language/elementTypes';
import {
  getActivitesFromActors,
  getAllCanvasObjects,
  wasInitialized
} from '../../language/canvasElementRegistry';
import { traceActivities } from './initializeReplay';

let canvas;
let selection;

let replayOn = false;
let currentStep = 0;
let replaySteps = [];
let initialViewbox;

let errorStep = 0;

let modal = document.getElementById('modal');
let startReplayButton = document.getElementById('buttonStartReplay');
let nextStepButton = document.getElementById('buttonNextStep');
let previousStepButton = document.getElementById('buttonPreviousStep');
let stopReplayButton = document.getElementById('buttonStopReplay');
let currentReplayStepLabel = document.getElementById('replayStep');
let incompleteStoryDialog = document.getElementById('incompleteStoryInfo');

export function getReplayOn() {
  return replayOn;
}

export function initReplay(inCanvas, inSelection) {
  canvas = inCanvas;
  selection = inSelection;
  console.log(selection);

  document.addEventListener('keydown', function(e) {
    if (replayOn) {
      if (e.keyCode == 37 || e.keyCode == 40) {

        // leftArrow or downArrow
        previousStep();
      } else if (e.keyCode == 39 || e.keyCode == 38) {

        // rightArrow or UpArrow
        nextStep();
      }
    }
  });

  startReplayButton.addEventListener('click', function() {
    if (wasInitialized()) {
      initialViewbox = canvas.viewbox();
      let activities = getActivitesFromActors();

      if (!replayOn && activities.length > 0) {
        replaySteps = traceActivities(activities);

        if (isStoryConsecutivelyNumbered(replaySteps)) {
          replayOn = true;
          presentationMode();
          currentStep = 0;
          showCurrentStep();
        } else {
          let errorText = '\nThe numbers: ';
          for (let i = 0; i < replaySteps.length; i++) {
            if (errorStep[i]) {
              errorText += i + 1 + ',';
            }
          }
          errorText = errorText.substring(0, errorText.length - 1);
          errorText += ' are missing!';

          let oldText = incompleteStoryDialog.getElementsByTagName('text');
          if (oldText) {
            for (let i = 0; i < oldText.length; i++) {
              incompleteStoryDialog.removeChild(oldText[i]);
            }
          }

          let text = document.createElement('text');
          text.innerHTML =
            ' The activities in this Domain Story are not numbered consecutively.<br>' +
            'Please fix the numbering in order to replay the story.<br>' +
            errorText;
          incompleteStoryDialog.appendChild(text);
          incompleteStoryDialog.style.display = 'block';
          modal.style.display = 'block';
        }
      }
    }
  });

  nextStepButton.addEventListener('click', function() {
    nextStep();
  });

  previousStepButton.addEventListener('click', function() {
    previousStep();
  });

  stopReplayButton.addEventListener('click', function() {
    if (replayOn) {
      editMode();

      // show all canvas elements
      let allObjects = [];
      let groupObjects = [];
      let canvasObjects = canvas._rootElement.children;
      let i = 0;

      for (i = 0; i < canvasObjects.length; i++) {
        if (canvasObjects[i].type.includes(GROUP)) {
          groupObjects.push(canvasObjects[i]);
        } else {
          allObjects.push(canvasObjects[i]);
        }
      }

      i = groupObjects.length - 1;
      while (groupObjects.length >= 1) {
        let currentgroup = groupObjects.pop();
        currentgroup.children.forEach(child => {
          if (child.type.includes(GROUP)) {
            groupObjects.push(child);
          } else {
            allObjects.push(child);
          }
        });
        i = groupObjects.length - 1;
      }
      allObjects.forEach(element => {
        let domObject = document.querySelector(
          '[data-element-id=' + element.id + ']'
        );
        domObject.style.display = 'block';
      });

      replayOn = false;
      currentStep = 0;
      canvas.viewbox(initialViewbox);
    }
  });
}

function nextStep() {
  if (replayOn) {
    if (currentStep < replaySteps.length - 1) {
      currentStep += 1;
      showCurrentStep();
    }
  }
}

function previousStep() {
  if (replayOn) {
    if (currentStep > 0) {
      currentStep -= 1;
      showCurrentStep();
    }
  }
}

export function isPlaying() {
  return replayOn;
}

export function isStoryConsecutivelyNumbered(replaySteps) {
  errorStep = [];
  let complete = true;
  for (let i = 0; i < replaySteps.length; i++) {
    if (!replaySteps[i].activities[0]) {
      complete = false;
      errorStep[i] = true;
    } else {
      errorStep[i] = false;
    }
  }
  return complete;
}

// get all elements, that are supposed to be shown in the current step
export function getAllShown(stepsUntilNow) {
  let shownElements = [];

  // for each step until the current one, add all referenced elements to the list of shown elements
  stepsUntilNow.forEach(step => {

    // add the source of the step and their annotations to the shown elements
    shownElements.push(step.source);
    if (step.source.outgoing) {
      step.source.outgoing.forEach(out => {
        if (out.type.includes(CONNECTION)) {
          shownElements.push(out, out.target);
        }
      });
    }

    // add the target of the step and their annotations to the shown elements
    step.targets.forEach(target => {
      shownElements.push(target);
      if (target.outgoing) {
        target.outgoing.forEach(out => {
          if (out.type.includes(CONNECTION)) {
            shownElements.push(out, out.target);
          }
        });
      }

      // add each activity to the step
      step.activities.forEach(activity => {
        shownElements.push(activity);
      });
    });
  });
  return shownElements;
}

// get all elements, that are supposed to be hidden in the current step
export function getAllNotShown(allObjects, shownElements) {
  let notShownElements = [];

  // every element that is not referenced in shownElements
  // and is neither a group (since they are not refeenced n allObjects),
  // nor an annotation conntected to a group should be hidden
  allObjects.forEach(element => {
    if (!shownElements.includes(element)) {
      if (element.type.includes(CONNECTION)) {
        if (!element.source.type.includes(GROUP)) {
          notShownElements.push(element);
        } else {
          shownElements.push(element.target);
        }
      } else {
        notShownElements.push(element);
      }
    }
  });
  return notShownElements;
}

// replay functions
function presentationMode() {

  removeSelectionAndEditing();

  const contextPadElements = document.getElementsByClassName('djs-context-pad');
  const paletteElements = document.getElementsByClassName('djs-palette');

  const infoContainer = document.getElementById('infoContainer');
  infoContainer.style.display = 'none';

  const editModeButtons = document.getElementById('editModeButtons');
  editModeButtons.style.display = 'none';
  editModeButtons.style.pointerEvents = 'none';

  const presentationModeButtons = document.getElementById(
    'presentationModeButtons'
  );
  presentationModeButtons.style.display = 'block';
  presentationModeButtons.style.pointerEvents = 'all';

  const headerAndCanvas = document.getElementsByClassName('headerAndCanvas')[0];
  headerAndCanvas.style.gridTemplateRows = '0px 50px 1px auto';

  const headlineAndButtons = document.getElementById('headlineAndButtons');
  headlineAndButtons.style.gridTemplateColumns = 'auto 230px 3px';

  let i = 0;
  for (i = 0; i < contextPadElements.length; i++) {
    contextPadElements[i].style.display = 'none';
  }

  for (i = 0; i < paletteElements.length; i++) {
    paletteElements[i].style.display = 'none';
  }

  currentReplayStepLabel.style.opacity = 1;
}

function removeSelectionAndEditing() {
  selection.select([]);
  const directEditingBoxes = document.getElementsByClassName('djs-direct-editing-parent');

  if (directEditingBoxes.length > 0) {
    const directEditing = directEditingBoxes[0];
    directEditing.parentElement.removeChild(directEditing);
  }
}

function editMode() {
  let contextPadElements = document.getElementsByClassName('djs-context-pad');
  let paletteElements = document.getElementsByClassName('djs-palette');

  let infoContainer = document.getElementById('infoContainer');
  infoContainer.style.display = 'block';
  infoContainer.style.height = '75px';

  let editModeButtons = document.getElementById('editModeButtons');
  editModeButtons.style.display = 'inherit';
  editModeButtons.style.pointerEvents = 'all';

  let presentationModeButtons = document.getElementById(
    'presentationModeButtons'
  );
  presentationModeButtons.style.display = 'none';
  presentationModeButtons.style.pointerEvents = 'none';

  let headerAndCanvas = document.getElementsByClassName('headerAndCanvas')[0];
  headerAndCanvas.style.gridTemplateRows = '0px 125px 1px auto';

  let headlineAndButtons = document.getElementById('headlineAndButtons');
  headlineAndButtons.style.gridTemplateColumns = 'auto 390px 3px';

  let i = 0;
  for (i = 0; i < contextPadElements.length; i++) {
    contextPadElements[i].style.display = 'block';
  }

  for (i = 0; i < paletteElements.length; i++) {
    paletteElements[i].style.display = 'block';
  }
  currentReplayStepLabel.style.opacity = 0;
}

function showCurrentStep() {
  let stepsUntilNow = [];
  let allObjects = [];
  let i = 0;

  currentReplayStepLabel.innerText =
    currentStep + 1 + ' / ' + replaySteps.length;

  for (i = 0; i <= currentStep; i++) {
    stepsUntilNow.push(replaySteps[i]);
  }

  allObjects = getAllCanvasObjects(canvas);

  let shownElements = getAllShown(stepsUntilNow);

  let notShownElements = getAllNotShown(allObjects, shownElements);

  // hide all elements, that are not to be shown
  notShownElements.forEach(element => {
    let domObject = document.querySelector(
      '[data-element-id=' + element.id + ']'
    );
    domObject.style.display = 'none';
  });

  shownElements.forEach(element => {
    let domObject = document.querySelector(
      '[data-element-id=' + element.id + ']'
    );
    domObject.style.display = 'block';
  });
  const currentViewbox = canvas.viewbox();
  if (stepNotInView(currentStep, currentViewbox)) {
    focusOnActiveActivity();
  }
}

function stepNotInView(stepNumber, viewBox) {

 let stepBounds = createViewboxForStep(stepNumber);

  if (viewBox.x <= stepBounds.x && viewBox.y <= stepBounds.y) {
    if (
      viewBox.x + viewBox.width >
      stepBounds.x + stepBounds.width
    ) {
      if (
        viewBox.y + viewBox.height >
        stepBounds.y + stepBounds.height
      ) {
        return false;
      }
    }
  }
  return true;
}

function focusOnActiveActivity() {
  const stepViewBoxes = [];
  for(let i=0; i<=currentStep; i++) {
    stepViewBoxes[i] = createViewboxForStep(i);
  }

  const stepViewbox = stepViewBoxes[currentStep];
  if(currentStep > 0) {
    for(let j = currentStep -1; j>=0; j--) {
      const additionalStapViewBox = stepViewBoxes[j];

      const stepViewboxRight = stepViewbox.x + stepViewbox.width;
      const additionalStapViewBoxRight = additionalStapViewBox.x + additionalStapViewBox.width;
      const stepViewboxDown = stepViewbox.y + stepViewbox.height;
      const additionalStapViewBoxDown = additionalStapViewBox.y + additionalStapViewBox.height;

      // if the previous step is further left,
      // move the x-value as far to the left as possible to include the step
      if(stepViewbox.x > additionalStapViewBox.x) {
        // Check if the whole additional step can be included
        if(stepViewbox.width + stepViewbox.x - additionalStapViewBox.x < initialViewbox.width) {
          stepViewbox.width += (stepViewbox.x - additionalStapViewBox.x);
          stepViewbox.x = additionalStapViewBox.x;
        }
        // Move the x as much as possible to include the additional step
        else {
          stepViewbox.x -= (initialViewbox.width - stepViewbox.width);
          stepViewbox.width = initialViewbox.width;
        }
      } 
      // if the previous step is further right,
      // move the width as far to the right as possible to include the step
      if( stepViewboxRight < additionalStapViewBoxRight ) {
        // Check if the whole additional step can be included
        if(stepViewbox.width + stepViewboxRight - additionalStapViewBoxRight < initialViewbox.width) {
          stepViewbox.width = additionalStapViewBoxRight;
        }
        // Move the width much as possible to include the additional step
        else {
          stepViewbox.width = initialViewbox.width;
        }
      }
      // if the previous step is further up,
      // move the y-value as far to up as possible to include the step
      if(stepViewbox.y > additionalStapViewBox.y) {
        // Check if the whole additional step can be included
        if(stepViewbox.height + stepViewbox.y - additionalStapViewBox.y < initialViewbox.height) {
          stepViewbox.height += (stepViewbox.y - additionalStapViewBox.y);
          stepViewbox.y = additionalStapViewBox.y;
        }
        // Move the y as much as possible to include the additional step
        else {
          stepViewbox.y -= (initialViewbox.height - stepViewbox.height);
          stepViewbox.height = initialViewbox.height;
        }
      }
      // if the previous step is further down,
      // move the height as far to the bottom as possible to include the step
      if( stepViewboxDown < additionalStapViewBoxDown ) {
        // Check if the whole additional step can be included
        if(stepViewbox.height + stepViewboxDown - additionalStapViewBoxDown < initialViewbox.height) {
          stepViewbox.height = additionalStapViewBoxDown;
        }
        // Move the height much as possible to include the additional step
        else {
          stepViewbox.height = initialViewbox.height;
        }
      }
    }
  }

  stepViewbox.width = initialViewbox.width;
  stepViewbox.height = initialViewbox.height;

  canvas.viewbox(stepViewbox);
}

function createViewboxForStep(stepNumber) {
  const step = replaySteps[stepNumber];
  const initialElement = step.source;

  let elements = [];
  step.targets.forEach(target => {
    elements.push(target);
  });

  let stepBounds = {
    x: initialElement.x,
    y: initialElement.y,
    width: initialElement.width,
    height: initialElement.height
  };
  elements.forEach(element => {
    if (element.x < stepBounds.x) {
      stepBounds.x = element.x;
    } else {
      if (stepBounds.width < element.x + element.width) {
        stepBounds.width = element.x + element.width;
      }
    }
    if (element.y < stepBounds.y) {
      stepBounds.y = element.y;
    } else {
      if (stepBounds.height < element.y + element.height) {
        stepBounds.height = element.y + element.height;
      }
    }
  });
  return stepBounds;
}
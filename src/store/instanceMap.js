import invariant from 'invariant';
import Project from '../models/Project';
import Block from '../models/Block';

/*
 Tracks a map of blocks / projects which have been loaded. Only contains the latest version. Serves as a place to store blocks / projects which do not need to be in the store.

 Works in concert with the store. Autosave relies on the store, for tracking versions of each instance. Other middlewares rely on the store as well.

 However, as long as the undo stack is erased on location change, the store only needs to contain the blocks / project that is open and being edited.
 */

//tracks rolls, so keep blocks at their state when last saved
const rollMap = new Map();

//map of blocks
const blockMap = new Map();

//map of projects
const projectMap = new Map();

/* helpers */

//compares two rollups for effective changes
//unforunately, the reducers run after the promise resolutions in these loading / saving functions, so project.version will increment immediately after the roll is set here, but that is ok - we handle that check below in isRollSame.
const isRollDifferent = (oldRollup, newRollup) => {
  if (!oldRollup || !newRollup) return true;

  //check projects same
  if (!Project.compare(oldRollup.project, newRollup.project)) return true;

  //check all blocks same
  return oldRollup.blocks.some(oldBlock => {
    const analog = newRollup.blocks.find(newBlock => newBlock.id === oldBlock.id);
    return !analog || analog !== oldBlock;
  });
};

/* get */

export const getProject = (projectId) => projectMap.get(projectId);

export const getBlock = (blockId) => blockMap.get(blockId);

/* recursing */

//returns map of components if all present, or null otherwise
const getBlockComponents = (acc = {}, ...blockIds) => {
  if (acc === null) {
    return null;
  }
  blockIds.forEach(blockId => {
    const block = getBlock(blockId);
    Object.assign(acc, { [block.id]: block });

    if (!block) {
      return null;
    }

    //check components
    if (block.components.length) {
      return getBlockComponents(acc, ...block.components);
    }

    //check options
    const optionsArray = Object.keys(block.options);
    if (optionsArray.length) {
      return getBlockComponents(acc, ...optionsArray);
    }
  });
  return acc;
};

const getProjectComponents = (projectId) => {
  const project = getProject(projectId);
  const componentMap = getBlockComponents({}, ...project.components);
  return Object.keys(componentMap).map(compId => componentMap[compId]);
};

//recursively check blocks' presence + their components / options
export const blockLoaded = (...blockIds) => {
  return blockIds.every(blockId => {
    const block = getBlock(blockId);
    if (!block) {
      return false;
    }

    //check components
    if (block.components.length) {
      return blockLoaded(...block.components);
    }

    //check options
    const optionsArray = Object.keys(block.options);
    if (optionsArray.length) {
      return blockLoaded(...optionsArray);
    }

    //otherwise we're good at the leaf
    return true;
  });
};

//check if whole project is loaded
export const projectLoaded = (projectId) => {
  const project = getProject(projectId);
  if (!project) {
    return false;
  }
  return blockLoaded(...project.components);
};

/* save */

export const saveProject = (...projects) => {
  projects.forEach(project => projectMap.set(project.id, project));
};

export const saveBlock = (...blocks) => {
  blocks.forEach(block => blockMap.set(block.id, block));
};

/* remove */
//likely dont need to do this, unless truly temporary (e.g. search results)

export const removeProject = (...projectIds) => {
  projectIds.forEach(projectId => projectMap.delete(projectId));
};

export const removeBlock = (...blockIds) => {
  blockIds.forEach(blockId => blockMap.delete(blockId));
};

/* rollups */

const getSavedRollup = (projectId) => rollMap.get(projectId);

export const getRollup = (projectId) => ({
  project: getProject(projectId),
  blocks: getProjectComponents(projectId),
});

export const saveRollup = (rollup) => {
  rollMap.set(rollup.project.id, rollup);
  saveProject(rollup.project);
  rollup.blocks.forEach(block => saveBlock(block));
};

export const isRollupNew = (rollup) => {
  return isRollDifferent(getSavedRollup(rollup.project.id), rollup);
};

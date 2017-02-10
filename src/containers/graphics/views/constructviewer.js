/*
 Copyright 2016 Autodesk,Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
import invariant from 'invariant';
import debounce from 'lodash.debounce';
import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import Box2D from '../geometry/box2d';
import Vector2D from '../geometry/vector2d';
import { palettes } from '../../../utils/color/index';
import GlobalNav from '../../../components/GlobalNav/GlobalNav';

import {
  blockAddComponent,
  blockAddComponents,
  blockClone,
  blockCreate,
  blockDelete,
  blockDetach,
  blockRemoveComponent,
  blockRename,
  blockSetPalette,
  blockSetListBlock,
} from '../../../actions/blocks';
import {
  focusBlockOption,
  focusBlocks,
  focusBlocksAdd,
  focusBlocksToggle,
  focusConstruct,
} from '../../../actions/focus';
import { orderCreate, orderList, orderSetName } from '../../../actions/orders';
import {
  projectAddConstruct,
  projectRemoveConstruct,
  projectSave,
} from '../../../actions/projects';
import {
  inspectorToggleVisibility,
  inventoryToggleVisibility,
  uiInlineEditor,
  uiSetGrunt,
  uiShowDNAImport,
  uiShowMenu,
  uiShowGenBankImport,
  uiShowOrderForm,
  uiToggleDetailView,
  inspectorSelectTab,
} from '../../../actions/ui';
import RoleSvg from '../../../components/RoleSvg';
import { role as roleDragType } from '../../../constants/DragTypes';
import { blockGetComponentsRecursive, blockGetParents } from '../../../selectors/blocks';
import { projectGet } from '../../../selectors/projects';
import '../../../styles/constructviewer.css';
import '../../../styles/inline-editor.css';
import SceneGraph2D from '../scenegraph2d/scenegraph2d';
import UserInterface from './constructvieweruserinterface';
import Layout from './layout';
import TitleAndToolbar from '../../../components/toolbars/title-and-toolbar';
import downloadProject from '../../../middleware/utils/downloadProject';


// static hash for matching viewers to constructs
const idToViewer = {};

export class ConstructViewer extends Component {
  static propTypes = {
    currentProjectId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    construct: PropTypes.object.isRequired,
    constructId: PropTypes.string.isRequired,
    inspectorToggleVisibility: PropTypes.func.isRequired,
    inspectorSelectTab: PropTypes.func.isRequired,
    inventoryToggleVisibility: PropTypes.func.isRequired,
    focusBlocks: PropTypes.func.isRequired,
    focusBlocksAdd: PropTypes.func.isRequired,
    focusBlocksToggle: PropTypes.func.isRequired,
    focusConstruct: PropTypes.func.isRequired,
    focusBlockOption: PropTypes.func.isRequired,
    blockCreate: PropTypes.func,
    blockClone: PropTypes.func,
    blockRename: PropTypes.func,
    blockSetPalette: PropTypes.func,
    blockSetListBlock: PropTypes.func,
    blockAddComponent: PropTypes.func,
    blockAddComponents: PropTypes.func,
    blockDetach: PropTypes.func,
    uiShowDNAImport: PropTypes.func,
    uiShowMenu: PropTypes.func,
    uiShowOrderForm: PropTypes.func.isRequired,
    uiSetGrunt: PropTypes.func.isRequired,
    uiShowGenBankImport: PropTypes.func.isRequired,
    uiInlineEditor: PropTypes.func.isRequired,
    orderCreate: PropTypes.func.isRequired,
    orderList: PropTypes.func.isRequired,
    orderSetName: PropTypes.func.isRequired,
    blockRemoveComponent: PropTypes.func,
    blockGetComponentsRecursive: PropTypes.func,
    blockGetParents: PropTypes.func,
    projectGet: PropTypes.func,
    projectRemoveConstruct: PropTypes.func,
    projectSave: PropTypes.func,
    projectAddConstruct: PropTypes.func,
    blocks: PropTypes.object,
    focus: PropTypes.object,
    testIndex: PropTypes.number.isRequired,
    inventoryVisible: PropTypes.bool.isRequired,
  };

  /**
   * given a construct ID return the current viewer if there is one
   */
  static getViewerForConstruct(id) {
    return idToViewer[id];
  }

  /**
   * return all instantiated viewers
   * @returns {Array}
   */
  static getAllViewers() {
    return Object.keys(idToViewer).map(cid => idToViewer[cid]);
  }

  /**
   * get position for a context menu attached to one of the inline toolbar items
   * @param anchorElement
   */
  static getToolbarAnchorPosition(anchorElement) {
    const box = new Box2D(anchorElement.getBoundingClientRect());
    return new Vector2D(box.cx, box.bottom);
  }

  constructor(props) {
    super(props);
    idToViewer[this.props.constructId] = this;
    this.update = debounce(this._update.bind(this), 16);
  }

  state = {
    showHidden: false,
    minimized: false, // controls the toggle between hide all / show all children
  };

  /**
   * setup the scene graph and layout component.
   */
  componentDidMount() {
    // create the scene graph we are going to use to display the construct
    this.sg = new SceneGraph2D({
      width: this.dom.clientWidth,
      height: this.dom.clientHeight,
      availableWidth: this.dom.clientWidth,
      availableHeight: this.dom.clientHeight,
      parent: this.sceneGraphEl,
      userInterfaceConstructor: UserInterface,
    });
    // create the layout object
    this.layout = new Layout(this, this.sg, {});
    // the user interface will also need access to the layout component
    this.sg.ui.layout = this.layout;
    // getting more ugly, the UI needs access to ourselves, the constructviewer
    this.sg.ui.constructViewer = this;
    // initial render won't call componentDidUpdate so force an update to the layout/scenegraph
    this.update();
    // handle window resize to reflow the layout
    this.resizeDebounced = debounce(this.windowResized.bind(this), 5);
    window.addEventListener('resize', this.resizeDebounced);

    // if there is no focused construct then we should grab it
    if (!this.props.focus.constructId) {
      this.props.focusConstruct(this.props.constructId);
    }
  }

  componentWillReceiveProps(nextProps) {
    // scroll into view when focused by user, unless this is a result of a drag operation
    if (!this.sg.ui.dragInside) {
      const hasFocus = this.isFocused();
      const willFocus = nextProps.construct.id === nextProps.focus.constructId;
      if (!hasFocus && willFocus) {
        const element = ReactDOM.findDOMNode(this);
        const parent = element.parentElement;
        const box1 = new Box2D(element.getBoundingClientRect());
        const box2 = new Box2D(parent.getBoundingClientRect());
        if (!box1.intersectWithBox(box2)) {
          if (element.scrollIntoViewIfNeeded) {
            element.scrollIntoViewIfNeeded(true);
          } else {
            element.scrollIntoView();
          }
        }
      }
    }
  }

  /**
   * scroll into view if needed and update scenegraph
   */
  componentDidUpdate(prevProps) {
    this.update();
  }

  /**
   * ensure we don't get any resize events after dismounting
   */
  componentWillUnmount() {
    delete idToViewer[this.props.constructId];
    this.resizeDebounced.cancel();
    window.removeEventListener('resize', this.resizeDebounced);
    this.sg.destroy();
  }

  /**
   * launch DNA form for this construct
   */
  onOrderDNA = () => {
    let order = this.props.orderCreate(this.props.currentProjectId, [this.props.construct.id]);
    this.props.orderList(this.props.currentProjectId)
      .then((orders) => {
        order = this.props.orderSetName(order.id, `Order ${orders.length}`);
        this.props.uiShowOrderForm(true, order.id);
      });
  };

  /**
   * inline edit the title of the construct when the title is clicked
   */
  onTitleClicked = (event) => {
    const { construct } = this.props;
    const wasFocused = construct.id === this.props.focus.constructId;
    this.props.focusBlocks([]);
    this.props.focusConstruct(construct.id);
    if (!construct.isFixed() && wasFocused) {
      // there might be an autoscroll when focusing the construct so wait for that to complete
      window.setTimeout(() => {
        const target = ReactDOM.findDOMNode(this).querySelector('.title-and-toolbar-container .title');
        const bounds = target.getBoundingClientRect();
        this.showInlineEditor((value) => {
          this.renameBlock(construct.id, value);
        }, construct.getName(), bounds, 'inline-editor-construct-title', target);
      }, 10);
    }
  };

  /**
   * get the parent of the given block, which is either the construct or the parents
   * of the block if a nested construct.
   *
   */
  getBlockParent(blockId) {
    const parents = this.props.blockGetParents(blockId);
    invariant(parents && parents.length, 'blocks are expected to have parents');
    return parents[0];
  }
  /**
   * get project our construct is from
   */
  getProject() {
    return this.props.projectGet(this.props.currentProjectId);
  }

  /**
   * get all the items for palette menu
   */
  getPaletteMenuItems() {
    const project = this.getProject();
    const palette = this.props.construct.metadata.palette || project.metadata.palette;
    const paletteItems = palettes.map(paletteName => ({
      text: paletteName[0].toUpperCase() + paletteName.slice(1),
      checked: palette === paletteName,
      action: () => this.props.blockSetPalette(this.props.constructId, paletteName),
    }));
    return [
      {
        text: 'Palette',
        disabled: true,
      },
      ...paletteItems,
    ];
  }

  /**
   * set state of minimized property
   * @param minimized
   */
  setMinimized(minimized) {
    this.sg.ui.setMinimized(minimized);
    this.setState({ minimized });
  }

  /**
   * return all blocks in our construct
   */
  getAllBlocks() {
    return this.props.blockGetComponentsRecursive(this.props.construct.id);
  }

  /**
   * update the layout and then the scene graph
   */
  _update() {
    this.layout.update({
      construct: this.props.construct,
      blocks: this.props.blocks,
      currentBlocks: this.props.focus.blockIds,
      currentConstructId: this.props.focus.constructId,
      focusedOptions: this.props.focus.options,
      showHidden: this.state.showHidden,
    });
    this.sg.update();
    this.sg.ui.update();
  }

  /**
   * close all popup menus
   */
  closePopups = () => {
    this.setState({
      blockPopupMenuOpen: false,
      constructPopupMenuOpen: false,
    });
  };

  /**
   * open any popup menu by apply the appropriate state and global position
   */
  openPopup = (state) => {
    this.setState(state);
  };

  /**
   * open the inspector
   *
   */
  openInspector() {
    this.props.inspectorToggleVisibility(true);
    this.props.inspectorSelectTab('Information');
  }

  /**
   * return true if the given block can accept children.
   * @param  {string}  blockId
   * @return {Boolean}
   */
  blockCanHaveChildren(blockId) {
    const block = this.props.blocks[blockId];
    invariant(block, 'expected to get a block');
    // list blocks cannot have children
    return !block.isList();
  }

  /**
   * show the block context menu at the given global coordinates.
   * @param menuPosition
   */
  showBlockContextMenu(menuPosition) {
    this.props.uiShowMenu(this.blockContextMenuItems(), menuPosition);
  }

  /**
   * menu items for blocks context menu, can get merged with construct context menu
   */
  blockContextMenuItems = () => {
    const singleBlock = this.props.focus.blockIds.length === 1;
    const firstBlock = this.props.blocks[this.props.focus.blockIds[0]];
    const canListify = singleBlock && !firstBlock.hasSequence();
    const listItems = singleBlock ? [
      {
        text: `Convert to ${firstBlock.isList() ? ' Normal Block' : ' List Block'}`,
        disabled: this.props.construct.isFixed() || !canListify,
        action: () => {
          this.props.blockSetListBlock(firstBlock.id, !firstBlock.isList());
        },
      },
    ] : [];

    return [
      ...listItems,
      {
        text: `Delete ${singleBlock ? 'Block' : 'Blocks'}`,
        disabled: this.props.construct.isFixed() || this.props.construct.isFrozen(),
        action: () => {
          this.removePartsList(this.sg.ui.selectedElements);
        },
      },
      {},
      {
        text: 'Edit Sequence',
        disabled: !singleBlock || (this.props.construct.isFixed() || this.props.construct.isFrozen()),
        action: () => {
          this.props.uiShowDNAImport(true);
        },
      },
      {},
      {
        text: 'Select Empty Blocks',
        disabled: false,
        action: () => {
          this.selectEmptyBlocks();
        },
      },
      ...GlobalNav.getSingleton().getEditMenuItems(),
    ];
  };

  /**
   * return JSX for construct context menu
   */
  showConstructContextMenu(menuPosition) {
    // select construct
    this.sg.ui.selectConstruct();
    // add the blocks context menu items if there are selected blocks
    const items = [...this.constructContextMenuItems(), ...GlobalNav.getSingleton().getEditMenuItems()];
    this.props.uiShowMenu(items, menuPosition);
  }

  toggleHiddenBlocks = () => {
    this.setState({ showHidden: !this.state.showHidden });
  };

  /**
   * menu items for the construct context menu
   */
  constructContextMenuItems = () => {
    const typeName = this.props.construct.getType('Construct');

    return [
      {
        text: `Duplicate ${typeName}`,
        disabled: this.isSampleProject(),
        action: () => {
          // clone the our construct/template and then add to project and ensure focused
          let clone = this.props.blockClone(this.props.construct);
          const oldName = clone.getName();
          if (!oldName.endsWith(' - copy')) {
            clone = this.props.blockRename(clone.id, `${oldName} - copy`);
          }
          this.props.projectAddConstruct(this.props.projectId, clone.id, true);
          this.props.focusConstruct(clone.id);
        },
      },
      {
        text: `Delete ${typeName}`,
        disabled: this.isSampleProject(),
        action: () => {
          this.props.projectRemoveConstruct(this.props.projectId, this.props.constructId);
        },
      },
      {
        text: `${this.state.showHidden ? 'Hide' : 'Show'} Hidden Blocks`,
        action: this.toggleHiddenBlocks,
      },
    ];
  };

  /**
   * add the given item using an insertion point from the constructviewer user interface.
   * Insertion point may be null, in which the block is added at the end
   */
  addItemAtInsertionPoint(payload, insertionPoint, event) {
    const { item, type } = payload;
    let index;
    // get the immediate parent ( which might not be the top level block if this is a nested construct )
    let parent = insertionPoint ? this.getBlockParent(insertionPoint.block) : this.props.construct;
    if (type === roleDragType) {
      // create new block with correct type of rules dictated by source symbol
      const droppedBlock = this.props.blockCreate({
        rules: item.rules,
        metadata: item.metadata,
      });
      // insert next to block, inject into a block, or add as the first block of an empty construct
      if (insertionPoint) {
        if (insertionPoint.edge) {
          // get index of insertion allowing for the edge closest to the drop if provided
          index = parent.components.indexOf(insertionPoint.block) + (insertionPoint.edge === 'right' ? 1 : 0);
          this.props.blockAddComponent(parent.id, droppedBlock.id, index);
        } else {
          // if the dropped block has sequence data then push down that block and the dropped block
          // ( if the block has sequence its components should currently be empty )
          const oldParent = parent;
          parent = this.props.blocks[insertionPoint.block];
          if (parent.hasSequence()) {
            // create a new parent for the old parent and the dropped item
            const block = this.props.blockCreate();
            const replaceIndex = oldParent.components.indexOf(parent.id);
            this.props.blockRemoveComponent(oldParent.id, parent.id);
            this.props.blockAddComponent(oldParent.id, block.id, replaceIndex);
            // now add the two blocks to the new parent
            this.props.blockAddComponents(block.id, [parent.id, droppedBlock.id]);
          } else {
            // we can just add the dropped item into the components of the parent
            this.props.blockAddComponent(parent.id, droppedBlock.id, parent.components.length);
          }
        }
        // return the dropped block for selection
        return [droppedBlock.id];
      }
      // the construct must be empty, add as the first child of the construct
      this.props.blockAddComponent(parent.id, droppedBlock.id, 0);
      return [droppedBlock.id];
    }

    // this will become the new blocks we are going to insert, declare here first
    // in case we do a push down
    const newBlocks = [];

    // if no edge specified then the parent becomes the target block and index is simply
    // the length of components to add them at the end of the current children
    if (insertionPoint && !insertionPoint.edge) {
      const oldParent = parent;
      parent = this.props.blocks[insertionPoint.block];
      index = parent.components.length;
      // if the block we are targeting already has a sequence then we will replace it with a new empty
      // block, then insert the old block at the start of the payload so it is added as a child to the new block
      if (parent.hasSequence()) {
        // create new block and replace current parent
        const block = this.props.blockCreate();
        const replaceIndex = oldParent.components.indexOf(parent.id);
        invariant(replaceIndex >= 0, 'expect to get an index here');
        this.props.blockRemoveComponent(oldParent.id, parent.id);
        this.props.blockAddComponent(oldParent.id, block.id, replaceIndex);
        // seed new blocks with the old target block
        newBlocks.push(parent.id);
        // bump the index
        index += 1;
        // now make parent equal to the new block so blocks get added to it.
        parent = block;
      }
    } else {
      index = parent.components.length;
      if (insertionPoint) {
        index = parent.components.indexOf(insertionPoint.block) + (insertionPoint.edge === 'right' ? 1 : 0);
      }
    }

    // add all blocks in the payload
    const blocks = Array.isArray(item) ? item : [item];
    // return the list of newly added blocks so we can select them for example
    blocks.forEach((block) => {
      const newBlock = (payload.source === 'inventory' || payload.copying)
        ? this.props.blockClone(block)
        : this.props.blocks[block];
      newBlocks.push(newBlock.id);
    });

    // now insert the blocks in one go
    return this.props.blockAddComponents(parent.id, newBlocks, index, true);
  }

  /**
   * return true if you can order DNA for this construct
   */
  allowOrder() {
    if (this.props.construct.isTemplate() && !this.isSampleProject()) {
      const canOrderFromEGF = this.props.construct.components.every((blockId) => {
        const block = this.props.blocks[blockId];

        //check blocks' source
        if (block.source.source === 'egf') {
          return true;
        }

        //check block options if source not valid
        const optionIds = Object.keys(block.options);
        if (optionIds.length > 0) {
          return optionIds.every((optionId) => {
            const option = this.props.blocks[optionId];
            return option.source.source && option.source.source === 'egf';
          });
        }
        return false;
      });
      return canOrderFromEGF;
    }
    return false;
  }

  isSampleProject() {
    return this.getProject().rules.frozen;
  }

  /**
   * true if our construct is focused
   * @return {Boolean}
   */
  isFocused() {
    return this.props.construct.id === this.props.focus.constructId;
  }

  lockIcon() {
    if (!this.props.construct.isFrozen()) {
      return null;
    }
    const isFocused = this.props.construct.id === this.props.focus.constructId;
    const classes = `lockIcon${isFocused ? '' : ' sceneGraph-dark'}`;
    return (
      <div className={classes}>
        <RoleSvg
          symbolName="lock"
          color={this.props.construct.getColor()}
          width="14px"
          height="14px"
          fill={this.props.construct.getColor()}
        />
      </div>
    );
  }

  /**
   * toggle the side panels
   */
  togglePanels = () => {
    const showPanels = !this.props.inventoryVisible;
    this.props.inventoryToggleVisibility(showPanels);
    this.props.inspectorToggleVisibility(showPanels);
  };


  /**
   * show the view context menu beneath the given element ( from the inline toolbar )
   * @param anchorElement
   */
  showViewMenu(anchorElement) {
    const showPanels = !this.props.inventoryVisible;
    this.props.uiShowMenu([
      {
        text: `${showPanels ? 'Show' : 'Hide'} all panels`,
        action: this.togglePanels,
      },
      {
        text: `${this.state.minimized ? 'Show' : 'Hide'} Nested Blocks`,
        action: () => { this.toggleMinimized(); },
      },
    ],
      ConstructViewer.getToolbarAnchorPosition(anchorElement),
      true);
  }

  /**
   * select the given block
   */
  constructSelected(id) {
    this.props.focusConstruct(id);
  }

  /**
   * rename the current construct
   * @param newName
   */
  renameBlock(blockId, newName) {
    this.props.blockRename(blockId, newName);
  }

  /**
   * select the given block
   */
  blockSelected(partIds) {
    this.props.focusBlocks(partIds);
  }

  /**
   * focus an option
   */
  optionSelected(blockId, optionId) {
    this.props.focusBlockOption(blockId, optionId);
  }

  /**
   * select the given block
   */
  blockToggleSelected(partIds) {
    this.props.focusBlocksToggle(partIds);
  }

  /**
   * add the given part by ID to the selections
   */
  blockAddToSelections(partIds) {
    this.props.focusBlocksAdd(partIds);
  }

  /**
   * Join the given block with any other selected block in the same
   * construct level and select them all
   */
  blockAddToSelectionsRange(partId, currentSelections) {
    // get all the blocks at the same level as this one
    const levelBlocks = (this.props.blockGetParents(partId)[0]).components;
    // find min/max index of these blocks if they are in the currentSelections
    let min = levelBlocks.indexOf(partId);
    let max = min;
    currentSelections.forEach((blockId, index) => {
      const blockIndex = levelBlocks.indexOf(blockId);
      if (blockIndex >= 0) {
        min = Math.min(min, blockIndex);
        max = Math.max(max, blockIndex);
      }
    });
    // now we can select the entire range
    this.props.focusBlocksAdd(levelBlocks.slice(min, max + 1));
  }

  /**
   * select all the empty block ( no sequence ) in our construct
   */
  selectEmptyBlocks() {
    const allChildren = this.props.blockGetComponentsRecursive(this.props.focus.constructId);
    const emptySet = allChildren.filter(block => !block.hasSequence()).map(block => block.id);
    this.props.focusBlocks(emptySet);
    if (!emptySet.length) {
      this.props.uiSetGrunt('There are no empty blocks in the current construct');
    }
  }
  /**
   * select all blocks
   */
  selectAllBlocks() {
    this.props.focusBlocks(this.props.blockGetComponentsRecursive(this.props.construct.id).map(block => block.id));
  }

  /**
   * accessor that fetches the actual scene graph element within our DOM
   *
   */
  get sceneGraphEl() {
    return this.dom.querySelector('.sceneGraph');
  }

  /**
   * expose the minimized state
   * @returns {boolean}
   */
  isMinimized() {
    return this.state.minimized;
  }

  /**
   * toggle the expand / collapsed state of children for all nodes.
   */
  toggleMinimized() {
    this.setMinimized(!this.state.minimized);
  }

  /**
   * accessor for our DOM node.
   *
   */
  get dom() {
    return ReactDOM.findDOMNode(this);
  }

  /**
   * window resize, update layout and scene graph with new dimensions
   *
   */
  windowResized() {
    this.sg.availableWidth = this.dom.clientWidth;
    this.sg.availableHeight = this.dom.clientHeight;
    this.forceUpdate();
  }

  /**
   * remove all parts in the list
   */
  removePartsList(partList) {
    this.props.blockDetach(...partList);
  }

  /**
   * remove the given block, which we assume if part of our construct and
   * return the scenegraph node that was representing it.
   */
  removePart(partId) {
    this.props.blockDetach(partId);
  }

  /**
   * show the inline editor
   * @param commit
   * @param cancel
   * @param position
   */
  showInlineEditor(commit, value, position, className, target) {
    this.props.uiInlineEditor(commit, value, position, className, target);
  }

  /**
   * show palette menu
   * @param anchorElement
   */
  showPaletteMenu(anchorElement) {
    this.props.uiShowMenu(this.getPaletteMenuItems(), ConstructViewer.getToolbarAnchorPosition(anchorElement), true);
  }

  /**
   * the concatenation of all the inline toolbar actions and sub menus
   * @param anchorElement
   */
  showMoreMenu(anchorElement) {
    this.props.uiShowMenu([
      {
        text: `${this.state.minimized ? 'Show' : 'Hide'} Nested Blocks`,
        //action: () => { this.sg.ui.toggleCollapsedState(); },
        action: () => { this.toggleMinimized(); },
      },
      {
        text: `${this.state.showHidden ? 'Hide' : 'Show'} Hidden Blocks`,
        action: this.toggleHiddenBlocks,
      },
      {
        text: 'Color',
        disabled: this.isSampleProject() || this.props.construct.isFixed(),
        menuItems: this.getPaletteMenuItems(),
      },
      {
        text: 'Order DNA',
        disabled: !this.allowOrder(),
        action: this.onOrderDNA,
      },
      {
        text: 'Upload',
        disabled: false,
        action: this.upload,
      },
      {
        text: 'Download Construct',
        disabled: false,
        action: () => {
          downloadProject(this.props.currentProjectId, this.props.focus.options);
        },
      },
      {
        text: 'Delete Construct',
        disabled: this.isSampleProject(),
        action: () => {
          this.props.projectRemoveConstruct(this.props.projectId, this.props.constructId);
        },
      },
    ],
      ConstructViewer.getToolbarAnchorPosition(anchorElement),
      true);
  }

  /**
   * start an upload
   */
  upload = () => {
    this.props.projectSave(this.props.currentProjectId)
      .then(() => {
        this.props.uiShowGenBankImport(true);
      });
  };

  /**
   * toolbar items / states and actions
   * @returns {Array}
   */
  toolbarItems() {
    return [
      {
        text: 'View',
        imageURL: '/images/ui/view.svg',
        enabled: true,
        clicked: (event) => {
          this.showViewMenu(event.target);
        },
      },
      {
        text: 'Palette',
        imageURL: '/images/ui/color.svg',
        enabled: !this.isSampleProject() && !this.props.construct.isFixed(),
        clicked: (event) => {
          this.showPaletteMenu(event.target);
        },
      },
      {
        text: 'Order DNA',
        imageURL: '/images/ui/order.svg',
        enabled: this.allowOrder(),
        clicked: this.onOrderDNA,
      },
      {
        text: 'Upload Genbank or CSV',
        imageURL: '/images/ui/upload.svg',
        enabled: !this.isSampleProject(),
        clicked: this.upload,
      },
      {
        text: 'Download Construct',
        imageURL: '/images/ui/download.svg',
        enabled: true,
        clicked: () => {
          downloadProject(this.props.currentProjectId, this.props.focus.options);
        },
      },
      {
        text: 'Delete Construct',
        imageURL: '/images/ui/delete.svg',
        enabled: !this.isSampleProject(),
        clicked: () => {
          this.props.projectRemoveConstruct(this.props.projectId, this.props.constructId);
        },
      },
      {
        text: 'More...',
        imageURL: '/images/ui/more.svg',
        enabled: true,
        clicked: (event) => {
          this.showMoreMenu(event.target);
        },
      },
    ];
  }

  /**
   * render the component, the scene graph will render later when componentDidUpdate is called
   */
  render() {
    const { construct } = this.props;
    const isFocused = construct.id === this.props.focus.constructId;
    const viewerClasses = `construct-viewer${isFocused ? ' construct-viewer-focused' : ''}`;
    const subTitle = `${construct.isTemplate() ? 'Template' : ''}`;
    return (
      <div
        className={viewerClasses}
        key={this.props.construct.id}
        data-index={this.props.testIndex}
      >
        <div className="sceneGraphContainer">
          <div className="sceneGraph" />
        </div>
        <div className={`title-and-toolbar-container${isFocused ? '' : ' title-and-toolbar-unfocused'}`}>
          <TitleAndToolbar
            toolbarItems={this.toolbarItems()}
            title={this.props.construct.getName('New Construct')}
            subTitle={subTitle}
            fontSize="16px"
            noHover={construct.isFixed() || !isFocused}
            color={construct.getColor()}
            onClick={this.onTitleClicked}
            onContextMenu={position => this.showConstructContextMenu(position)}
            itemActivated={() => this.props.focusConstruct(this.props.constructId)}
          />
        </div>
        {this.lockIcon()}
      </div>
    );
  }
}

function mapStateToProps(state, props) {
  return {
    focus: state.focus,
    construct: state.blocks[props.constructId],
    blocks: state.blocks,
    inventoryVisible: state.ui.inventory.isVisible,
  };
}

export default connect(mapStateToProps, {
  blockCreate,
  blockDelete,
  blockDetach,
  blockClone,
  blockSetListBlock,
  blockSetPalette,
  blockAddComponent,
  blockAddComponents,
  blockRemoveComponent,
  blockGetParents,
  blockGetComponentsRecursive,
  blockRename,
  focusBlocks,
  focusBlocksAdd,
  focusBlocksToggle,
  focusBlockOption,
  focusConstruct,
  projectGet,
  projectRemoveConstruct,
  projectSave,
  projectAddConstruct,
  inspectorToggleVisibility,
  inspectorSelectTab,
  inventoryToggleVisibility,
  uiShowDNAImport,
  uiShowOrderForm,
  uiShowGenBankImport,
  uiShowMenu,
  uiSetGrunt,
  uiInlineEditor,
  uiToggleDetailView,
  orderCreate,
  orderList,
  orderSetName,
})(ConstructViewer);

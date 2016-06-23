import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import SceneGraph2D from '../../containers/graphics/scenegraph2d/scenegraph2d';
import Layout from '../../containers/graphics/views/layout';
import { orderGenerateConstructs } from '../../actions/orders';
import invariant from 'invariant';

import '../../../src/styles/ordermodal.css';
import '../../../src/styles/SceneGraphPage.css';

class ConstructPreview extends Component {
  static propTypes = {
    order: PropTypes.object.isRequired,
    orderGenerateConstructs: PropTypes.func.isRequired,
  };

  constructor(props) {
    super();
    this.generateConstructs(props);
  }

  state = {
    index: 1,
  };

  get dom() {
    return ReactDOM.findDOMNode(this);
  }

  get sceneGraphEl() {
    return this.dom.querySelector('.scenegraph');
  }

  get containerEl() {
    return this.dom.querySelector('.container');
  }

  /**
   * construct scene graph and layout once mounted
   * @return {[type]} [description]
   */
  componentDidMount() {
    // create the scene graph we are going to use to display the construct
    this.sg = new SceneGraph2D({
      width: this.dom.clientWidth,
      height: this.dom.clientHeight,
      availableWidth: this.dom.clientWidth,
      availableHeight: this.dom.clientHeight,
      parent: this.sceneGraphEl,
    });
    // create the layout object
    this.layout = new Layout(this, this.sg, {
      showHeader: false,
      insetX: 10,
      insetY: 10,
      baseColor: 'lightgray',
    });

    //trigger a render because we've set components, and can't do it in the constructor
    this.forceUpdate();
  }

  componentWillUpdate(nextProps, nextState) {
    //if the props changed... valid so long as state is only the page
    if (this.state === nextState) {
      this.generateConstructs(nextProps);
    }
  }

  componentDidUpdate() {
    if (this.constructs.length) {
      this.containerEl.scrollTop = 0;
      invariant(this.props.order.constructIds.length === 1, 'expect exactly 1 construct per order');
      const parentConstruct = this.props.blocks[this.props.order.constructIds[0]];
      const construct = this.constructs[this.state.index - 1];
      const constructIndex = this.state.index;
      const componentIds = construct;
      this.layout.update({
        construct: {
          metadata: {
            color: parentConstruct.metadata.color || 'lightgray',
          },
          components: componentIds,
          // this fake construct should not be a template, so we don't get empty list block placeholders
          isTemplate: () => {return false;},
        },
        blocks: this.props.blocks,
        currentBlocks: [],
        currentConstructId: constructIndex,
        blockColor: (blockId) => {
          return this.blockColor(blockId);
        },
      });
      this.sg.update();
    }
  }

  /**
   * gets called with the id of an option. Return the color for the owning block
   */
  blockColor(optionId) {
    this.optionColorHash = this.optionColorHash || {};
    const hashedColor = this.optionColorHash[optionId];
    if (hashedColor) {
      return hashedColor;
    }
    const parentConstruct = this.props.blocks[this.props.order.constructIds[0]];
    const blockIndex = parentConstruct.components.findIndex((blockId, index) => {
      const block = this.props.blocks[blockId];
      const optionIds = Object.keys(block.options);
      return optionIds.indexOf(optionId) >= 0;
    });
    if (blockIndex >= 0) {
      // we have the index of the parent block
      return this.optionColorHash[optionId] = this.props.blocks[parentConstruct.components[blockIndex]].metadata.color;
    }
    return 'lightgray';
  }

  generateConstructs(props = this.props) {
    console.log('generating');
    this.constructs = props.orderGenerateConstructs(props.order.id);
  }

  onChangeConstruct = (evt) => {
    const index = parseInt(evt.target.value, 10);
    this.setState({ index: Number.isInteger(index) ? Math.min(this.constructs.length, Math.max(1, index)) : 1 });
  };

  render() {
    const label = `of ${this.constructs.length} combinations`;
    return (
      <div className="preview">
        <label>Reviewing assembly</label>
        <input
          className="input-updown"
          type="number"
          defaultValue="1"
          min="1"
          max={this.constructs.length}
          onChange={this.onChangeConstruct}
        />
        <label>{label}</label>
        <div className="container">
          <div className="scenegraph"></div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, props) {
  return {
    blocks: state.blocks,
  };
}

export default connect(mapStateToProps, {
  orderGenerateConstructs,
})(ConstructPreview);

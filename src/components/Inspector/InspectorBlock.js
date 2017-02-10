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
import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';

import { blockMerge, blockRename, blockSetColor, blockSetPalette, blockSetRole } from '../../actions/blocks';
import { blockGetParents } from '../../selectors/blocks';
import Block from '../../models/Block';
import { abort, commit, transact } from '../../store/undo/actions';
import InputSimple from './../InputSimple';
import ColorPicker from './../ui/ColorPicker';
import PalettePicker from './../ui/PalettePicker';
import Expando from './../ui/Expando';
import SBOLPicker from './../ui/SBOLPicker';
import BlockNotes from './BlockNotes';
import BlockSource from './BlockSource';
import InspectorRow from './InspectorRow';
import ListOptions from './ListOptions';
import TemplateRules from './TemplateRules';
import { getLocal } from '../../utils/localstorage';
import { getPaletteName } from '../../utils/color/index';
import '../../styles/InspectorBlock.css';

export class InspectorBlock extends Component {
  static propTypes = {
    readOnly: PropTypes.bool.isRequired,
    instances: PropTypes.arrayOf((propValue, key) => {
      const instance = propValue[key];
      if (!(Block.validate(instance) && instance instanceof Block)) {
        return new Error(`Must pass valid instances of blocks to the inspector, got ${JSON.stringify(instance)}`);
      }
    }).isRequired,
    construct: PropTypes.object,
    overrides: PropTypes.shape({
      color: PropTypes.string,
      role: PropTypes.string,
    }).isRequired,
    blockSetColor: PropTypes.func.isRequired,
    blockSetPalette: PropTypes.func.isRequired,
    blockSetRole: PropTypes.func.isRequired,
    blockGetParents: PropTypes.func.isRequired,
    blockMerge: PropTypes.func.isRequired,
    blockRename: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    transact: PropTypes.func.isRequired,
    commit: PropTypes.func.isRequired,
    abort: PropTypes.func.isRequired,
    forceIsConstruct: PropTypes.bool,
  };

  static defaultProps = {
    forceIsConstruct: false,
  };

  state = {
    colorSymbolText: 'Color & Symbol',
  };

  setBlockName = (name) => {
    this.props.instances.forEach((block) => {
      this.props.blockRename(block.id, name);
    });
  };

  setBlockDescription = (description) => {
    this.props.instances.forEach((block) => {
      this.props.blockMerge(block.id, { metadata: { description } });
    });
  };

  setColorSymbolText = (str) => {
    this.setState({ colorSymbolText: str || 'Color & Symbol' });
  };

  selectColor = (colorIndex) => {
    this.startTransaction();
    this.props.instances.forEach((block) => {
      this.props.blockSetColor(block.id, colorIndex);
    });
    this.endTransaction();
  };

  selectPalette = (paletteName) => {
    this.props.blockSetPalette(this.props.construct.id, paletteName);
  };

  selectSymbol = (symbol) => {
    this.startTransaction();
    this.props.instances.forEach((block) => {
      this.props.blockSetRole(block.id, symbol);
    });
    this.endTransaction();
  };

  startTransaction = () => {
    this.props.transact();
  };

  endTransaction = (shouldAbort = false) => {
    if (shouldAbort === true) {
      this.props.abort();
      return;
    }
    this.props.commit();
  };


  /**
   * color of selected instance or null if multiple blocks selected
   */
  currentColor() {
    const { instances, overrides } = this.props;
    if (overrides.color) {
      return overrides.color;
    }
    if (instances.length === 1) {
      return instances[0].metadata.color;
    }
    return null;
  }

  /**
   * role symbol of selected instance or null if multiple blocks selected
   */
  currentRoleSymbol() {
    const { instances, overrides } = this.props;
    if (overrides.role) {
      return overrides.role;
    }
    if (instances.length === 1) {
      return instances[0].getRole(false);
    }
    return null;
  }

  /**
   * current name of instance or null if multi-select
   */
  currentName(useGetName = true) {
    if (this.props.instances.length === 1) {
      const defaultName = this.props.forceIsConstruct ? 'New Construct' : null;
      return useGetName ? this.props.instances[0].getName(defaultName) : this.props.instances[0].metadata.name;
    }
    return '';
  }

  /**
   * current name of instance or null if multi-select
   */
  currentDescription() {
    if (this.props.instances.length === 1) {
      return this.props.instances[0].metadata.description || '';
    }
    return '';
  }

  allBlocksWithSequence() {
    return this.props.instances.every(instance => !!instance.sequence.length);
  }

  currentSequenceLength() {
    if (this.allBlocksWithSequence()) {
      const reduced = this.props.instances.reduce((acc, instance) => acc + (instance.sequence.length || 0), 0);
      return `${reduced} bp`;
    }
    return this.props.instances.length > 1 ?
      'Incomplete Sketch' :
      'No Sequence';
  }

  currentAnnotations() {
    if (this.props.instances.length > 1) {
      return [];
    } else if (this.props.instances.length === 1) {
      return this.props.instances[0].sequence.annotations;
    }
    return [];
  }

  currentSource() {
    const lenInstances = this.props.instances.length;
    const firstBlock = this.props.instances[0];
    const firstSource = firstBlock.source;
    const { id: firstId, source: firstName } = firstSource;
    const firstHasSource = !!firstName;

    if (firstHasSource && (lenInstances === 1 ||
      this.props.instances.every(block => block.source.id === firstId && block.source.source === firstName))) {
      return (<BlockSource block={firstBlock} />);
    }
    if (lenInstances > 1) {
      return (<p>Multiple Sources</p>);
    }
    return null;
  }

  render() {
    const { instances, construct, readOnly, forceIsConstruct } = this.props;
    const singleInstance = instances.length === 1;
    const isList = singleInstance && instances[0].isList();
    const isConstruct = singleInstance && instances[0].isConstruct();
    const isFixed = (construct && construct.isFixed()) || instances.some(inst => inst.isFixed());
    const hasParents = this.props.blockGetParents(instances[0].id).length > 0;

    const inputKey = instances.map(inst => inst.id).join(',');

    const palette = getPaletteName(construct ? construct.metadata.palette || this.props.project.metadata.palette : null);

    const defaultType = forceIsConstruct ? 'Construct' : 'Block';
    const type = singleInstance ? instances[0].getType(defaultType) : 'Blocks';

    const currentSourceElement = this.currentSource();
    const annotations = this.currentAnnotations();

    const hasSequence = this.allBlocksWithSequence();
    const hasNotes = singleInstance && Object.keys(instances[0].notes).length > 0;

    // determines the default state of the palette expando
    const paletteStateKey = 'expando-color-palette';
    // text before palette, depends on expanded state.
    const paletteOpen = getLocal(paletteStateKey, false, true);
    let colorPaletteText = 'Color Palette';
    if (!paletteOpen) {
      colorPaletteText += `: ${palette}`;
    }

    return (
      <div className="InspectorContent InspectorContentBlock">

        <InspectorRow heading={type}>
          <InputSimple
            refKey={inputKey}
            placeholder={this.currentName(true) || 'Enter a name'}
            readOnly={readOnly}
            onChange={this.setBlockName}
            onFocus={this.startTransaction}
            onBlur={this.endTransaction}
            onEscape={() => this.endTransaction(true)}
            maxLength={64}
            value={this.currentName(false)}
          />
        </InspectorRow>

        <InspectorRow heading="Description">
          <InputSimple
            refKey={`${inputKey}desc`}
            placeholder="Enter a description"
            useTextarea
            readOnly={readOnly}
            onChange={this.setBlockDescription}
            onFocus={this.startTransaction}
            onBlur={this.endTransaction}
            onEscape={() => this.endTransaction(true)}
            maxLength={1024}
            value={this.currentDescription()}
          />
        </InspectorRow>

        <InspectorRow
          heading="Source"
          condition={!!currentSourceElement}
        >
          {currentSourceElement}
        </InspectorRow>

        <InspectorRow
          heading="Sequence Length"
          condition={hasSequence}
        >
          <p><strong>{this.currentSequenceLength()}</strong></p>
        </InspectorRow>


        { hasNotes
          ? <Expando
            text={`${type} Metadata`}
            stateKey="inspector-template-metadata"
            content={<div className="InspectorContent-section">
              <BlockNotes notes={instances[0].notes} />
            </div>}
          />
          : null
        }
        {isConstruct && singleInstance && !hasParents
          ?
            <Expando
              text={colorPaletteText}
              capitalize
              stateKey={paletteStateKey}
              onClick={() => this.forceUpdate()}
              content={
                <PalettePicker
                  paletteName={palette}
                  onSelectPalette={this.selectPalette}
                  readOnly={readOnly || isFixed}
                />}
            />
          :
            null
        }
        <div className="color-symbol-label">{this.state.colorSymbolText}</div>
        <div className="color-symbol">
          <ColorPicker
            setText={this.setColorSymbolText}
            current={this.currentColor()}
            readOnly={readOnly || isFixed}
            paletteName={palette}
            onSelectColor={this.selectColor}
          />
          <SBOLPicker
            setText={this.setColorSymbolText}
            current={this.currentRoleSymbol()}
            readOnly={readOnly || isFixed}
            onSelect={this.selectSymbol}
          />
        </div>
        <InspectorRow
          heading={`${type} Rules`}
          condition={!isConstruct && singleInstance}
        >
          <TemplateRules
            block={instances[0]}
            readOnly={isFixed}
            isConstruct={isConstruct}
          />
        </InspectorRow>

        <InspectorRow
          heading="Annotations"
          condition={annotations.length > 0}
        >
          <div className="InspectorContentBlock-Annotations">
            {annotations.map((annotation, idx) => (
              <span
                className="InspectorContentBlock-Annotation"
                key={idx}
              >
                {annotation.name || annotation.description || '?'}
              </span>
              ))}
          </div>
        </InspectorRow>

        <InspectorRow
          heading="List Options"
          condition={isList}
        >
          <ListOptions
            toggleOnly={isFixed}
            block={instances[0]}
          />
        </InspectorRow>

      </div>
    );
  }
}

export default connect(() => ({}), {
  blockSetColor,
  blockSetPalette,
  blockSetRole,
  blockGetParents,
  blockRename,
  blockMerge,
  transact,
  commit,
  abort,
})(InspectorBlock);

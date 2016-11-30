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
import Box2D from '../../containers/graphics/geometry/box2d';
import Vector2D from '../../containers/graphics/geometry/vector2d';
import SubMenu from './SubMenu';
import { uiShowMenu } from '../../actions/ui';

import '../../../src/styles/MenuOverlay.css';
/**
 * Elements that holds the active menu and blocks access to the page behind it.
 */
class MenuOverlay extends Component {
  static propTypes = {};

  constructor() {
    super();
  }

  /**
   * get the side class based on our target selector
   */
  getSideClass() {
    return this.props.menuPosition.x < document.body.clientWidth / 2 ? 'menu-overlay-menu menu-overlay-left' : 'menu-overlay-menu menu-overlay-right';
  }

  /**
   * handle window resizes
   */
  componentDidMount() {
    window.addEventListener('resize', this.windowResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.windowResize);
  }

  windowResize = () => {
    this.forceUpdate();
  };


  /**
   * close by clearing out the menu items
   */
  close = () => {
    this.props.uiShowMenu();
  };

  mouseEnterMenu = () => {
    this.inside = true;
  };

  mouseLeaveMenu = () => {
    if (this.inside) {
      this.inside = false;
      this.close();
    }
  };

  /**
   * mouse down in overlay
   * @param evt
   */
  mouseOverlay = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    this.close();
  };

  /*
   * render modal dialog with owner supplied payload and optional buttons.
   */
  render() {
    // nothing if not open
    if (!this.props.menuItems) {
      return null;
    }
    const pos = this.props.menuPosition;
    // size and position pointer and menu
    const psize = 20;
    const pointerPosition = {
      width: psize + 'px',
      height: psize + 'px',
      left: pos.x - 10 + 'px',
      top: pos.y + 'px',
    };
    const menuPosition = {
      left: pos.x - 10 + 'px',
      top: pos.y + psize / 2 + 'px',
    };
    return (
      <div
        className="menu-overlay"
        onMouseDown={this.mouseOverlay}
      >
        <div className="menu-overlay-pointer" style={pointerPosition}></div>
        <SubMenu
          menuItems={this.props.menuItems}
          position={menuPosition}
          close={this.close}
          onMouseEnter={this.mouseEnterMenu}
          onMouseLeave={this.mouseLeaveMenu}
          className={this.getSideClass()}
        />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    menuItems: state.ui.modals.menuItems,
    menuPosition: state.ui.modals.menuPosition,
  };
}
export default connect(mapStateToProps, {
  uiShowMenu,
})(MenuOverlay);

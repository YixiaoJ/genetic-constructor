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

import track from '../analytics/ga';
import MenuOverlay from '../components/Menu/MenuOverlay';
import AboutForm from '../components/modal/aboutform';
import InlineEditor from '../components/inline-editor/inline-editor';
import ReportErrorModal from '../components/modal/ReportErrorModal';
import ModalSpinner from '../components/modal/modalspinner';
import RibbonGrunt from '../components/ribbongrunt';
import AuthenticationModals from './AuthenticationModals';

import '../styles/App.css';

class App extends Component {
  static propTypes = {
    children: PropTypes.node, // Injected by React Router
    location: PropTypes.shape({
      pathname: PropTypes.string.isRequired,
    }).isRequired,
    spinMessage: PropTypes.string.isRequired,
  };

  /**
   * return true if the event targets an input or editable element
   * @param evt
   */
  static isEditable(evt) {
    const rx = /INPUT|SELECT|TEXTAREA/i;
    if (evt.target.hasAttribute('contenteditable')) {
      return true;
    }
    if (rx.test(evt.target.tagName) && !evt.target.disabled && !evt.target.readOnly) {
      return true;
    }
    return false;
  }

  /**
   * reject backspace navigation but allow backspace in editable control
   * @param evt
   */
  static rejectBackspace(evt) {
    if (evt.which === 8 && !App.isEditable(evt)) {
      evt.preventDefault();
    }
  }

  /**
   * prevents default only if the target is not an extension
   * @param evt
   */
  static preventDefaultOutsideExtension(evt) {
    let element = evt.target;
    while (element) {
      if (element.classList && element.classList.contains('ExtensionView-content')) {
        return;
      }
      element = element.parentNode;
    }
    // if here the element is not attached to an extension
    evt.preventDefault();
  }

  /**
   * only allow the default context menu on text edit components
   * @param evt
   */
  static preventDefaultIfEditable(evt) {
    if (!App.isEditable(evt)) {
      evt.preventDefault();
    }
  }

  /**
   * attempt to eat backspace keys ( to prevent navigation ) unless an interactive
   * element is the target
   */
  componentDidMount() {
    document.addEventListener('keydown', App.rejectBackspace);
    document.addEventListener('keypress', App.rejectBackspace);

    // disable context menus since the app generates it own
    document.addEventListener('contextmenu', App.preventDefaultOutsideExtension);

    // disable all native drag and drop except on editable controls
    document.addEventListener('dragstart', App.preventDefaultIfEditable);

    // in production, track top level, unhandled exceptions in the app
    // not in production, ignore this so we dont garble the callstack
    if (process.env.NODE_ENV === 'production') {
      window.onerror = function trackError(...args) {
        const json = {};
        args.forEach((arg, index) => {
          // we except strings as arguments or stringable object. toString ensures
          // things like functions won't cause problems with JSON.stringify
          json[index] = arg.toString();
        });
        const str = JSON.stringify(json, null, 2);
        track('Errors', 'Unhandled Exception', str);

        // rethrow the error :(
        throw new Error(args[0]);
      };
    }
  }

  render() {
    //set by webpack
    const DevTools = (process.env.DEBUG_REDUX) ? require('./DevTools') : 'noscript'; //eslint-disable-line global-require
    //todo - should we check this better
    const onLanding = this.props.location.pathname.indexOf('homepage') >= 0;

    return (
      <div className="App">
        <RibbonGrunt atTop={onLanding} />
        <AuthenticationModals />
        <AboutForm />
        <ReportErrorModal />
        <div className="App-pageContent">
          {this.props.children}
        </div>
        <ModalSpinner spinMessage={this.props.spinMessage} />
        <InlineEditor />
        <MenuOverlay />
        <DevTools />
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  return {
    currentProjectId: ownProps.params.projectId,
    spinMessage: state.ui.modals.spinMessage,
  };
}

export default connect(mapStateToProps)(App);

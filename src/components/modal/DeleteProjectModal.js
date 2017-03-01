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
import _ from 'lodash';

import Snapshot from '../../models/Snapshot';
import { uiSetGrunt, uiShowProjectDeleteModal } from '../../actions/ui';
import { projectDelete } from '../../actions/projects';
import { snapshotsList } from '../../actions/snapshots';

import Modal from './Modal';
import ModalFooter from './ModalFooter';

class DeleteProjectModal extends Component {
  static propTypes = {
    projectId: PropTypes.string.isRequired,
    currentProjectId: PropTypes.string.isRequired, //eslint-disable-line react/no-unused-prop-types
    project: PropTypes.object.isRequired,
    snapshots: PropTypes.object.isRequired,
    open: PropTypes.bool,
    snapshotsList: PropTypes.func.isRequired,
    projectDelete: PropTypes.func.isRequired,
    uiSetGrunt: PropTypes.func.isRequired,
    uiShowProjectDeleteModal: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);

    this.state = {
      isPublished: _.some(_.filter(props.snapshots, { projectId: props.projectId }), Snapshot.isPublished),
    };
  }

  componentDidMount() {
    this.props.snapshotsList(this.props.projectId);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.snapshots !== nextProps.snapshots) {
      this.setState({
        isPublished: _.some(_.filter(nextProps.snapshots, { projectId: nextProps.projectId }), Snapshot.isPublished),
      });
    }
  }

  actions = [{
    text: 'Delete',
    onClick: () => {
      if (this.state.isPublished) {
        this.props.uiShowProjectDeleteModal(false);
        this.props.uiSetGrunt('The project cannot be deleted because it is shared in the Public inventory.');
        return;
      }

      this.props.uiShowProjectDeleteModal(false);
      this.props.projectDelete(this.props.projectId);
    },
  }];

  render() {
    if (!this.props.open) {
      return null;
    }

    return (
      <Modal
        isOpen={this.props.open}
        onClose={() => this.props.uiShowProjectDeleteModal(false)}
        title={'Delete Project'}
      >
        <div className="DeleteProjectModal Modal-paddedContent" style={{ textAlign: 'center' }}>
          <p><b>{this.props.project.getName() || 'Your project'}</b> and all related project data will be permanently
            deleted.</p>
          <br />
          <p>This action cannot be undone.</p>
        </div>
        <ModalFooter actions={this.actions} />
      </Modal>
    );
  }
}

export default connect((state, props) => {
  const projectId = state.ui.modals.projectDeleteForceProjectId || props.currentProjectId;
  return {
    projectId,
    snapshots: state.snapshots,
    open: state.ui.modals.projectDeleteDialog,
    project: state.projects[projectId],
  };
}, {
  projectDelete,
  snapshotsList,
  uiSetGrunt,
  uiShowProjectDeleteModal,
})(DeleteProjectModal);

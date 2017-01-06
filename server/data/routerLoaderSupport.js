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

import express from 'express';

import * as lodash from 'lodash';

import {
  errorDoesNotExist,
} from '../utils/errors';

import * as projectPersistence from './persistence/projects';

import Block from '../../src/models/Block';

const router = express.Router(); //eslint-disable-line new-cap

router.route('/savecomponent/:projectId?')
  .get((req, res, next) => {
    const { user } = req;
    const { projectId } = req.params;

    projectPersistence.projectGet(projectId)
      .then((rollup) => {
        if (rollup == null) {
          return res.status(404).send(errorDoesNotExist);
        }

        const constructId = rollup.project.components[0];
        const construct = rollup.blocks[constructId];
        const newBlock = new Block(construct);
        let blocksToMerge = {};
        blocksToMerge[newBlock.id] = newBlock;
        return projectPersistence.blocksMerge(projectId, user.uuid, blocksToMerge)
          .then((updatedRollup) => {
          console.log("newRollup", updatedRollup);
          res.status(200).json(updatedRollup);
        });
      })
      .catch(err => next(err));
  });

export default router;

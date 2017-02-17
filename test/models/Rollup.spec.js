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
import { expect, assert } from 'chai';
import _ from 'lodash';

import { testUserId } from '../constants';
import { createExampleRollup } from '../_utils/rollup';
import RollupSchema, { currentDataModelVersion } from '../../src/schemas/Rollup';
import Rollup from '../../src/models/Rollup';
import Project from '../../src/models/Project';
import Block from '../../src/models/Block';
import * as projectPersistence from '../../server/data/persistence/projects'

describe('Model', () => {
  describe('Rollup', () => {
    describe('validate()', () => {
      it('can throw on errors', () => {
        expect(() => Rollup.validate({ project: {}, blocks: {} }, true)).to.throw();
      });

      it('works on examples', () => {
        Rollup.validate(createExampleRollup(), true);
      });

      it('works on simple one', () => {
        const pr = Project.classless({ owner: testUserId });
        const bl = Block.classless({ projectId: pr.id });
        const rl = {
          schema: currentDataModelVersion,
          project: pr,
          blocks: {
            [bl.id]: bl,
          },
        };

        expect(Rollup.validate(rl)).to.equal(true);
        Rollup.validate(rl, true);
      });

      it('cheap validation just checks basic shape, e.g. ignores block projectId', () => {
        const pr = Project.classless({ owner: testUserId });
        const bl = Block.classless();
        const rl = Object.assign(RollupSchema.scaffold(), {
          project: pr,
          blocks: {
            [bl.id]: bl,
          },
        });

        expect(Rollup.validate(rl, false, false)).to.equal(true);
      });

      it('catches wrong projectId, in non-light validation', () => {
        const pr = Project.classless({ owner: testUserId });
        const bl = Block.classless({
          projectId: Project.classless().id,
        });
        const rl = {
          schema: currentDataModelVersion,
          project: pr,
          blocks: {
            [bl.id]: bl,
          },
        };

        expect(Rollup.validate(rl, false)).to.equal(false);

        rl.blocks[bl.id].projectId = pr.id;

        expect(Rollup.validate(rl, false)).to.equal(true);
      });

      it('checks for weird keys', () => {
        const pr = Project.classless({ owner: testUserId });
        const bl = Block.classless({
          projectId: Project.classless().id,
        });
        const rl = Object.assign(RollupSchema.scaffold(), {
          project: pr,
          blocks: {
            [bl.id]: bl,
          },
          random: 'value',
        });

        expect(Rollup.validate(rl, false)).to.equal(false);
      });

      it('checks if each block is valid', () => {
        const proj = Project.classless({ owner: testUserId });
        const invalidBlock = Object.assign(Block.classless({ projectId: proj.id }), { metadata: 'invalid' });

        const rl = Object.assign(RollupSchema.scaffold(), {
          project: proj,
          blocks: {
            [invalidBlock.id]: invalidBlock,
          },
        });

        expect(() => Rollup.validate(rl, true)).to.throw();
      });
    });

    describe('compare', () => {
      it('compare() can throw', () => {
        expect(() => Rollup.compare(createExampleRollup(), createExampleRollup(), true)).to.throw();
      });

      it('compare() picks up project difference, throws on error', () => {
        const one = createExampleRollup();
        const two = _.merge({}, one, { project: { blah: 'field' } });
        expect(Project.compare(one.project, two.project)).to.equal(false);
        expect(() => Rollup.compare(one, two, true)).to.throw();
      });

      it('compare() ignores project version stuff', () => {
        const roll = createExampleRollup();

        return projectPersistence.projectWrite(roll.project.id, roll, testUserId)
        .then(info => {
          Rollup.compare(info.data, roll, true);
        });
      });
    });

    describe('upgrade()', () => {
      it('upgrade() updates to the latest schema number', () => {
        const rl = Object.assign(RollupSchema.scaffold(), { schema: 1 });
        Rollup.upgrade(rl);
        expect(rl.schema).to.equal(currentDataModelVersion);
      });

      it('constructor() automatically updates', () => {
        const roll = new Rollup();
        expect(roll.schema).to.equal(currentDataModelVersion);

        const upgraded = new Rollup({
          schema: 1,
          project: new Project({}, false),
        });
        expect(upgraded.schema).to.equal(currentDataModelVersion);
      });

      it('v1 -> adds keywords', () => {
        const roll = new Rollup();

        //patch to v1, unset keywords
        roll.schema = 1;
        _.unset(roll, 'project.metadata.keywords');
        _.forEach(roll.blocks, block => _.unset(block, 'metadata.keywords'));

        expect(Rollup.validate(roll, false)).to.equal(false);

        Rollup.upgrade(roll);
        expect(Rollup.validate(roll, false)).to.equal(true);
      });
    });
  });
});

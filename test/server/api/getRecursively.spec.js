import chai from 'chai';
import generateTree, { flattenTree } from '../../utils/tree';
import range from '../../../src/utils/array/range';
import { set as dbSet, get as dbGet, getSafe as dbGetSafe } from '../../../server/database';
import getRecursively, { getParents, getComponents } from '../../../server/getRecursively';

const { expect } = chai;

describe('getRecursively', () => {
  const componentField = 'components';
  const treeDepth = 4;
  const treeNumberChildren = 3;
  const exampleTree = generateTree(treeDepth, treeNumberChildren, componentField);
  const flattened = flattenTree(exampleTree, componentField);
  const rootId = exampleTree.id;
  const leaves = flattened.leaves;
  delete flattened.leaves;

  before(() => {
    return Promise.all(Object.keys(flattened).map((key) => {
      const instance = flattened[key];
      return dbSet(instance.id, instance);
    }));
  });

  it('should resolve for no inputs with empty tree and leaves', () => {
    return getRecursively([]).then(val => {
      expect(val).to.eql({tree: {}, leaves: []});
    });
  });

  it('should accept a string as field specifier');
  it('should accept an accessor function as field specifier');

  it('should fetch a recursive structure', () => {
    return getRecursively([rootId])
      .then(result => {
        const { leaves, tree, ...instances } = result;
        expect(instances).to.eql(flattened);
      });
  });

  it('have the correct leaves', () => {
    return getRecursively([rootId])
      .then(result => {
        const { leaves, tree, ...instances } = result;
        expect(leaves).to.eql(leaves);
      });
  });

  //implicitly testing whole tree has resolved by checking leaves and all instances

  it('allow limiting of depth', () => {
    const shortDepth = treeDepth - 2;
    return getRecursively([rootId], componentField, shortDepth)
      .then(result => {
        const { leaves, tree, ...instances } = result;

        //start with 1, for the root node
        //reduce to get number of expected children...
        //e.g., if you have treeDepth = 4, shortDepth = 2, treeNumberChildren = 3,
        //[0,1] -> [1,2] -> (3 + 9 + 1) = 13 expected children
        const numberInstances = range(shortDepth)
          .map(ind => ind + 1)
          .reduce((acc, cur) => acc + Math.pow(treeNumberChildren, cur), 1);
        expect(Object.keys(instances).length).to.equal(numberInstances);
      });
  });

  //future
  it('should return the constructed tree');
});

import { expect } from 'chai';
import { Block as exampleBlock } from '../../schemas/examples';
import request from 'supertest';

const devServer = require('../../../devServer');

describe('REST', () => {
  let server;
  beforeEach(() => {
    server = devServer.listen();
  });
  afterEach(() => {
    server.close();
  });

  describe.only('Clone', () => {
    it('should require an ID', (done) => {
      const parent = exampleBlock;
      request(server)
        .post('/api/clone')
        .send(parent)
        .expect(404, done);
    });

    it('should be a valid endpoint with an ID', (done) => {
      const parent = exampleBlock;
      request(server)
        .put(`/api/block/${parent.id}`)
        .send(parent)
        .expect(200, makeClone);

      function makeClone() {
        request(server)
          .post(`/api/clone/${parent.id}`)
          .send()
          .expect(200, done);
      }
    });

    it('should only work with instances in the database');

    it('should return the clone, with proper parent', (done) => {
      const parent = Object.assign(exampleBlock, {
        other: 'field',
      });
      request(server)
        .put(`/api/block/${parent.id}`)
        .send(parent)
        .expect(200, makeClone);

      function makeClone() {
        request(server)
          .post(`/api/clone/${parent.id}`)
          .send()
          .expect(200)
          .expect(result => {
            const descendent = result.body;
            expect(descendent.id).to.not.equal(parent.id);
            expect(descendent.parent).to.equal(parent.id);
            expect(descendent.other).to.equal(parent.other);
          })
          .end(done);
      }
    });
  });
});

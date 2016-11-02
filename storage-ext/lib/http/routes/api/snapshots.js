"use strict";

var async = require('async');

var uuidValidate = require("uuid-validate");

var route = require("http-route");
var combiner = require('../../combiner');
var notNullOrEmpty = require('../../../util').notNullOrEmpty;
var notNullAndPosInt = require('../../../util').notNullAndPosInt;

var Sequelize = require('sequelize');
var Project = require('../../../project');
var Snapshot = require('../../../snapshot');

var fetchSnapshotByUUID = function (req, res) {
  var snapshotUUID = req.params.uuid;
  if (! snapshotUUID) {
    return res.status(400).send({
      message: 'failed to parse Snapshot \'uuid\' from URI',
    }).end();
  }

  if (! uuidValidate(snapshotUUID, 1)) {
    return res.status(400).send({
      message: 'UUID is invalid',
    }).end();
  }

  return Snapshot.findOne({
    where: {
      uuid: snapshotUUID,
    },
  }).then(function (result) {
    if (! result) {
      return res.status(404).send({
        message: 'snapshot [' + snapshotUUID + '] does not exist',
      }).end();
    }

    return res.status(200).send(result.get()).end();
  }).catch(function (err) {
    req.log.error(err);
    return res.status(500).send({
      message: err.message,
    }).end();
  });
};

var fetchSnapshots = function (req, res) {};

var checkSnapshots = function (req, res) {};

var saveSnapshot = function (req, res) {
  var body = req.body;
  if (! body) {
    return res.status(400).send({
      message: 'request body required to save new project',
    }).end();
  }

  console.log(req.body);
  if (! body.owner) {
    return res.status(400).send({
      message: '\'owner\' is required in request body',
    }).end();
  }

  if (! uuidValidate(body.owner, 1)) {
    return res.status(400).send({
      message: '\'owner\' UUID is invalid',
    }).end();
  }

  if (! body.projectId) {
    return res.status(400).send({
      message: '\'projectId\' is required in request body',
    }).end();
  }

  if (body.projectVersion == null) {
    return res.status(400).send({
      message: '\'projectVersion\' is required in request body',
    }).end();
  }

  if (! body.message) {
    return res.status(400).send({
      message: '\'message\' is required in request body',
    }).end();
  }

  var tags = {};
  if (body.tags != null) {
    if (typeof body.tags != "object") {
      return res.status(400).send({
        message: '\'tags\' should be an object',
      }).end();
    }

    tags = body.tags;
  }

  // lookup the project UUID to save a strict reference to a project version
  // assume the snapshot hasn't been created, because that should be the normal use case
  // catch a unique constraint and then update

  async.waterfall([
    function (cb) {
      return Project.findOne({
        where: {
          owner: body.owner,
          id: body.projectId,
          version: body.projectVersion,
        },
      }).then(function (result) {
        if (! result) {
          return cb({
            status: 404,
            message: 'target project does not exist',
          });
        }

        return cb(null, result.get('uuid'));
      }).catch(function (err) {
        return cb({
          status: 500,
          message: err.message,
          err: err,
        });
      });
    },
    function (projectUUID, cb) {
      return Snapshot.create({
        owner: body.owner,
        projectUUID: projectUUID,
        projectId: body.projectId,
        projectVersion: body.projectVersion,
        message: body.message,
        tags: tags,
      }).then(function (newSnapshot) {
        return cb(null, newSnapshot.get());
      }).catch(Sequelize.UniqueConstraintError, function () {
        return Snapshot.update({
          message: body.message,
          tags: tags,
        }, {
          returning: true,
          fields: ['message', 'tags'],
          where: {
            owner: body.owner,
            projectId: body.projectId,
            projectVersion: body.projectVersion,
          },
        }).then(function (results) {
          if (results[0] > 1) {
            return cb({
              status: 500,
              message: 'unexpectedly updated more than one snapshot',
            });
          }

          return cb(null, results[1][0].get());
        }).catch(function (err) {
          return cb({
            status: 500,
            message: err.message,
            err: err,
          });
        });
      }).catch(function (err) {
        return cb({
          status: 500,
          message: err.message,
          err: err,
        });
      });
    },
  ], function (err, result) {
    if (err) {
      if (err.err) {
        req.log.error(err);
      }
      return res.status(err.status).send({
        message: err.message,
      }).end();
    }

    return res.status(200).send(result).end();
  });
};

var routes = [
  route('GET /:projectId', fetchSnapshots),
  route('HEAD /:projectId', checkSnapshots),
  route('GET /uuid/:uuid', fetchSnapshotByUUID),
  route('POST /', saveSnapshot),
];

module.exports = combiner.apply(null, routes);

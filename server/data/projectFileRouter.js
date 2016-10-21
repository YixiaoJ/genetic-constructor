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
import bodyParser from 'body-parser';
import {
  errorInvalidRoute,
  errorDoesNotExist,
  errorFileNotFound,
} from './../utils/errors';
import { HOST_URL } from '../urlConstants';
import * as projectFiles from './persistence/projectFiles';

const router = express.Router(); //eslint-disable-line new-cap
const textParser = bodyParser.text();

//todo - verify this HOST_URL is correct when outward facing (i.e. in production)
const makeProjectFileLink = (projectId, namespace, file) => {
  return `${HOST_URL}/data/file/${projectId}/${namespace}/${file}`;
};

//permission checking currently handled by data router (user has access to project)

//todo - S3 access control ???? Necessary if all requests go through application server?

router.route('/:namespace/:file/:version?')
  .all((req, res, next) => {
    // const { projectId } = req; //already on the request
    const { namespace, file, version } = req.params;

    Object.assign(req, {
      namespace,
      file,
      version,
    });

    next();
  })
  .get((req, res, next) => {
    //todo - support for getting old versions
    //const params = (req.version && req.version !== 'latest') ? { VersionId: req.version } : {};

    const { projectId, namespace, file } = req;

    projectFiles.projectFileRead(projectId, namespace, file)
      .then(data => res.send(data))
      .catch(err => {
        if (err === errorDoesNotExist) {
          return res.status(404).send(errorDoesNotExist);
        }
        console.log('project file get err', err, err.stack);
        next(err);
      });
  })
  .post(textParser, (req, res, next) => {
    const { projectId, namespace, file } = req;
    const content = req.body;

    projectFiles.projectFileWrite(projectId, namespace, file, content)
      .then(resp => {
        const payload = {
          url: makeProjectFileLink(projectId, namespace, file),
          VersionId: resp.VersionId,
        };
        res.send(payload);
      })
      .catch((err) => {
        console.log('project file post err', err, err.stack);
        next(err);
      });
  })
  .delete((req, res, next) => {
    const { projectId, namespace, file } = req;

    projectFiles.projectFileDelete(projectId, namespace, file)
      .then(() => res.status(200).send())
      .catch(err => next(err));
  });

router.route('/:namespace')
  .all((req, res, next) => {
    // const { projectId } = req; //already on request
    const { namespace } = req.params;

    Object.assign(req, {
      namespace,
    });

    next();
  })
  .get((req, res, next) => {
    const { projectId, namespace } = req;

    projectFiles.projectFilesList(projectId, namespace)
      .then(contents => {
        const mapped = contents.map(filename => ({
          name: filename,
          url: makeProjectFileLink(projectId, namespace, filename),
        }));
        res.json(mapped);
      })
      .catch(err => res.status(404).send(errorFileNotFound));
  });

//default catch
router.use('*', (req, res) => {
  res.status(404).send(errorInvalidRoute);
});

export default router;

"use strict";
// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const google_gax_1 = require("google-gax");
const src_1 = require("../src");
const helpers_1 = require("./util/helpers");
const REQUEST_TIME = 'REQUEST_TIME';
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
const PROJECT_ID = 'test-project';
(0, mocha_1.describe)('set() method', () => {
    let firestore;
    let writeBatch;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
            writeBatch = firestore.batch();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('requires document name', () => {
        (0, chai_1.expect)(() => writeBatch.set()).to.throw('Value for argument "documentRef" is not a valid DocumentReference.');
    });
    (0, mocha_1.it)('requires object', () => {
        (0, chai_1.expect)(() => writeBatch.set(firestore.doc('sub/doc'))).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)('accepts document data', () => {
        writeBatch.set(firestore.doc('sub/doc'), { foo: 'bar' });
    });
    (0, mocha_1.it)('works with null objects', () => {
        const nullObject = Object.create(null);
        nullObject.bar = 'ack';
        writeBatch.set(firestore.doc('sub/doc'), nullObject);
    });
    (0, mocha_1.it)('requires the correct converter for Partial usage', async () => {
        const converter = {
            toFirestore(post) {
                return { title: post.title, author: post.author };
            },
            fromFirestore(snapshot) {
                const data = snapshot.data();
                return new helpers_1.Post(data.title, data.author);
            },
        };
        const ref = firestore.doc('sub/doc').withConverter(converter);
        (0, chai_1.expect)(() => writeBatch.set(ref, { title: 'foo' }, { merge: true })).to.throw('Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "author").');
    });
});
(0, mocha_1.describe)('delete() method', () => {
    let firestore;
    let writeBatch;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
            writeBatch = firestore.batch();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('requires document name', () => {
        (0, chai_1.expect)(() => writeBatch.delete()).to.throw('Value for argument "documentRef" is not a valid DocumentReference.');
    });
    (0, mocha_1.it)('accepts preconditions', () => {
        writeBatch.delete(firestore.doc('sub/doc'), {
            lastUpdateTime: new src_1.Timestamp(479978400, 123000000),
        });
    });
});
(0, mocha_1.describe)('update() method', () => {
    let firestore;
    let writeBatch;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
            writeBatch = firestore.batch();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('requires document name', () => {
        (0, chai_1.expect)(() => writeBatch.update({}, {})).to.throw('Value for argument "documentRef" is not a valid DocumentReference.');
    });
    (0, mocha_1.it)('requires object', () => {
        (0, chai_1.expect)(() => {
            writeBatch.update(firestore.doc('sub/doc'), firestore.doc('sub/doc'));
        }).to.throw('Update() requires either a single JavaScript object or an alternating list of field/value pairs that can be followed by an optional precondition. Value for argument "dataOrField" is not a valid Firestore document. Detected an object of type "DocumentReference" that doesn\'t match the expected instance. Please ensure that the Firestore types you are using are from the same NPM package.');
    });
    (0, mocha_1.it)('accepts preconditions', () => {
        writeBatch.update(firestore.doc('sub/doc'), { foo: 'bar' }, { lastUpdateTime: new src_1.Timestamp(479978400, 123000000) });
    });
    (0, mocha_1.it)('works with null objects', () => {
        const nullObject = Object.create(null);
        nullObject.bar = 'ack';
        writeBatch.update(firestore.doc('sub/doc'), nullObject);
    });
});
(0, mocha_1.describe)('create() method', () => {
    let firestore;
    let writeBatch;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
            writeBatch = firestore.batch();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('requires document name', () => {
        (0, chai_1.expect)(() => writeBatch.create()).to.throw('Value for argument "documentRef" is not a valid DocumentReference.');
    });
    (0, mocha_1.it)('requires object', () => {
        (0, chai_1.expect)(() => {
            writeBatch.create(firestore.doc('sub/doc'));
        }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)('works with null objects', () => {
        const nullObject = Object.create(null);
        nullObject.bar = 'ack';
        writeBatch.create(firestore.doc('sub/doc'), nullObject);
    });
});
(0, mocha_1.describe)('batch support', () => {
    const documentName = `projects/${PROJECT_ID}/databases/(default)/documents/col/doc`;
    let firestore;
    let writeBatch;
    (0, mocha_1.beforeEach)(() => {
        const overrides = {
            commit: (request, options) => {
                (0, chai_1.expect)(options.retry.retryCodes).contains(google_gax_1.Status.ABORTED);
                (0, chai_1.expect)(request).to.deep.eq({
                    database: `projects/${PROJECT_ID}/databases/(default)`,
                    writes: [
                        {
                            update: {
                                fields: {},
                                name: documentName,
                            },
                            updateTransforms: [
                                {
                                    fieldPath: 'foo',
                                    setToServerValue: REQUEST_TIME,
                                },
                            ],
                        },
                        {
                            currentDocument: {
                                exists: true,
                            },
                            update: {
                                fields: {
                                    foo: {
                                        stringValue: 'bar',
                                    },
                                },
                                name: documentName,
                            },
                            updateMask: {
                                fieldPaths: ['foo'],
                            },
                        },
                        {
                            currentDocument: {
                                exists: false,
                            },
                            update: {
                                fields: {},
                                name: documentName,
                            },
                        },
                        {
                            delete: documentName,
                        },
                    ],
                });
                return (0, helpers_1.response)({
                    commitTime: {
                        nanos: 0,
                        seconds: 0,
                    },
                    writeResults: [
                        {
                            updateTime: {
                                nanos: 0,
                                seconds: 0,
                            },
                        },
                        {
                            updateTime: {
                                nanos: 1,
                                seconds: 1,
                            },
                        },
                        {
                            updateTime: {
                                nanos: 2,
                                seconds: 2,
                            },
                        },
                        {
                            updateTime: {
                                nanos: 3,
                                seconds: 3,
                            },
                        },
                    ],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
            firestore = firestoreClient;
            writeBatch = firestore.batch();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    function verifyResponse(writeResults) {
        (0, chai_1.expect)(writeResults[0].writeTime.isEqual(new src_1.Timestamp(0, 0))).to.be.true;
        (0, chai_1.expect)(writeResults[1].writeTime.isEqual(new src_1.Timestamp(1, 1))).to.be.true;
        (0, chai_1.expect)(writeResults[2].writeTime.isEqual(new src_1.Timestamp(2, 2))).to.be.true;
        (0, chai_1.expect)(writeResults[3].writeTime.isEqual(new src_1.Timestamp(3, 3))).to.be.true;
    }
    (0, mocha_1.it)('accepts multiple operations', () => {
        const documentName = firestore.doc('col/doc');
        writeBatch.set(documentName, { foo: src_1.FieldValue.serverTimestamp() });
        writeBatch.update(documentName, { foo: 'bar' });
        writeBatch.create(documentName, {});
        writeBatch.delete(documentName);
        return writeBatch.commit().then(resp => {
            verifyResponse(resp);
        });
    });
    (0, mocha_1.it)('chains multiple operations', () => {
        const documentName = firestore.doc('col/doc');
        return writeBatch
            .set(documentName, { foo: src_1.FieldValue.serverTimestamp() })
            .update(documentName, { foo: 'bar' })
            .create(documentName, {})
            .delete(documentName)
            .commit()
            .then(resp => {
            verifyResponse(resp);
        });
    });
    (0, mocha_1.it)('handles exception', () => {
        firestore.request = () => {
            return Promise.reject(new Error('Expected exception'));
        };
        return firestore
            .batch()
            .commit()
            .then(() => {
            throw new Error('Unexpected success in Promise');
        })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('Expected exception');
        });
    });
    (0, mocha_1.it)('cannot append to committed batch', () => {
        const documentName = firestore.doc('col/doc');
        const batch = firestore.batch();
        batch.set(documentName, { foo: src_1.FieldValue.serverTimestamp() });
        batch.update(documentName, { foo: 'bar' });
        batch.create(documentName, {});
        batch.delete(documentName);
        const promise = batch.commit();
        (0, chai_1.expect)(() => {
            batch.set(documentName, {});
        }).to.throw('Cannot modify a WriteBatch that has been committed.');
        return promise;
    });
    (0, mocha_1.it)('can reset a committed batch', async () => {
        const documentName = firestore.doc('col/doc');
        const batch = firestore.batch();
        batch.set(documentName, { foo: src_1.FieldValue.serverTimestamp() });
        batch.update(documentName, { foo: 'bar' });
        batch.create(documentName, {});
        batch.delete(documentName);
        await batch.commit();
        batch._reset();
        batch.set(documentName, { foo: src_1.FieldValue.serverTimestamp() });
        batch.update(documentName, { foo: 'bar' });
        batch.create(documentName, {});
        batch.delete(documentName);
        await batch.commit();
    });
    (0, mocha_1.it)('can commit an unmodified batch multiple times', () => {
        const documentName = firestore.doc('col/doc');
        const batch = firestore.batch();
        batch.set(documentName, { foo: src_1.FieldValue.serverTimestamp() });
        batch.update(documentName, { foo: 'bar' });
        batch.create(documentName, {});
        batch.delete(documentName);
        return batch.commit().then(() => batch.commit);
    });
    (0, mocha_1.it)('can return same write result', () => {
        const overrides = {
            commit: () => {
                return (0, helpers_1.response)({
                    commitTime: {
                        nanos: 0,
                        seconds: 0,
                    },
                    writeResults: [
                        {
                            updateTime: {
                                nanos: 0,
                                seconds: 0,
                            },
                        },
                        {
                            updateTime: {},
                        },
                    ],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            const documentName = firestore.doc('col/doc');
            const batch = firestore.batch();
            batch.set(documentName, {});
            batch.set(documentName, {});
            return batch.commit().then(results => {
                (0, chai_1.expect)(results[0].isEqual(results[1])).to.be.true;
            });
        });
    });
});
//# sourceMappingURL=write-batch.js.map
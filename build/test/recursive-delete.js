"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Copyright 2021 Google LLC
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
const mocha_1 = require("mocha");
const assert_1 = require("assert");
const chai_1 = require("chai");
const google_gax_1 = require("google-gax");
const sinon = require("sinon");
const backoff_1 = require("../src/backoff");
const helpers_1 = require("./util/helpers");
const query_1 = require("./query");
const bulk_writer_1 = require("./bulk-writer");
const src_1 = require("../src");
const recursive_delete_1 = require("../src/recursive-delete");
const util_1 = require("../src/util");
const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;
(0, mocha_1.describe)('recursiveDelete() method:', () => {
    // We store errors from batchWrite inside an error object since errors thrown
    // in batchWrite do not affect the recursiveDelete promise.
    let batchWriteError;
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
    });
    (0, mocha_1.afterEach)(async () => {
        await (0, helpers_1.verifyInstance)(firestore);
        (0, backoff_1.setTimeoutHandler)(setTimeout);
        (0, chai_1.expect)(batchWriteError, 'batchWrite should not have errored').to.be
            .undefined;
    });
    function instantiateInstance(childrenDocs, deleteDocRef = '', responses) {
        const overrides = {
            runQuery: () => {
                return (0, helpers_1.stream)(...childrenDocs.map(docId => (0, query_1.result)(docId)));
            },
            batchWrite: request => {
                const documents = childrenDocs;
                if (deleteDocRef.length > 0) {
                    documents.push(deleteDocRef);
                }
                const expected = (0, bulk_writer_1.createRequest)(documents.map(docId => (0, bulk_writer_1.deleteOp)(docId)));
                try {
                    (0, chai_1.expect)(request.writes).to.deep.equal(expected.writes);
                }
                catch (e) {
                    batchWriteError = e;
                }
                const returnedResponse = responses !== null && responses !== void 0 ? responses : (0, bulk_writer_1.mergeResponses)(documents.map(() => (0, bulk_writer_1.successResponse)(1)));
                return (0, helpers_1.response)({
                    writeResults: returnedResponse.writeResults,
                    status: returnedResponse.status,
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides);
    }
    (0, mocha_1.describe)('calls getAllDescendants() with correct StructuredQuery', () => {
        function startAt(name) {
            return {
                referenceValue: DATABASE_ROOT + '/documents/' + name + '/' + recursive_delete_1.REFERENCE_NAME_MIN_ID,
            };
        }
        function endAt(name) {
            return {
                referenceValue: DATABASE_ROOT +
                    '/documents/' +
                    name +
                    String.fromCharCode(0) +
                    '/' +
                    recursive_delete_1.REFERENCE_NAME_MIN_ID,
            };
        }
        (0, mocha_1.it)('for root-level collections', async () => {
            const overrides = {
                runQuery: req => {
                    (0, query_1.queryEquals)(req, (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.fieldFiltersQuery)('__name__', 'GREATER_THAN_OR_EQUAL', startAt('root'), '__name__', 'LESS_THAN', endAt('root')), (0, query_1.limit)(recursive_delete_1.RECURSIVE_DELETE_MAX_PENDING_OPS));
                    return (0, helpers_1.stream)();
                },
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            return firestore.recursiveDelete(firestore.collection('root'));
        });
        (0, mocha_1.it)('for nested collections', async () => {
            const overrides = {
                runQuery: req => {
                    (0, query_1.queryEqualsWithParent)(req, 'root/doc', (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.fieldFiltersQuery)('__name__', 'GREATER_THAN_OR_EQUAL', startAt('root/doc/nestedCol'), '__name__', 'LESS_THAN', endAt('root/doc/nestedCol')), (0, query_1.limit)(recursive_delete_1.RECURSIVE_DELETE_MAX_PENDING_OPS));
                    return (0, helpers_1.stream)();
                },
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            return firestore.recursiveDelete(firestore.collection('root/doc/nestedCol'));
        });
        (0, mocha_1.it)('documents', async () => {
            const overrides = {
                runQuery: req => {
                    (0, query_1.queryEqualsWithParent)(req, 'root/doc', (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.limit)(recursive_delete_1.RECURSIVE_DELETE_MAX_PENDING_OPS));
                    return (0, helpers_1.stream)();
                },
                // Include dummy response for the deleted docRef.
                batchWrite: () => (0, helpers_1.response)((0, bulk_writer_1.successResponse)(1)),
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            return firestore.recursiveDelete(firestore.doc('root/doc'));
        });
        (0, mocha_1.it)('creates retry query after stream exception with last received doc', async () => {
            let callCount = 0;
            const overrides = {
                runQuery: request => {
                    callCount++;
                    if (callCount === 1) {
                        return (0, helpers_1.stream)((0, query_1.result)('doc1'), new Error('failed in test'));
                    }
                    else {
                        (0, query_1.queryEqualsWithParent)(request, 
                        /* parent= */ '', (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.orderBy)('__name__', 'ASCENDING'), (0, query_1.startAt)(false, {
                            referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                                'documents/collectionId/doc1',
                        }), (0, query_1.fieldFiltersQuery)('__name__', 'GREATER_THAN_OR_EQUAL', startAt('root'), '__name__', 'LESS_THAN', endAt('root')), (0, query_1.limit)(recursive_delete_1.RECURSIVE_DELETE_MAX_PENDING_OPS - 1));
                        return (0, helpers_1.stream)();
                    }
                },
                batchWrite: () => (0, helpers_1.response)((0, bulk_writer_1.successResponse)(1)),
            };
            const firestore = await (0, helpers_1.createInstance)(overrides);
            await firestore.recursiveDelete(firestore.collection('root'));
        });
        (0, mocha_1.it)('creates a second query with the correct startAfter', async () => {
            // This test checks that the second query is created with the correct
            // startAfter() once the RecursiveDelete instance is below the
            // MIN_PENDING_OPS threshold to send the next batch. Use lower limits
            // than the actual RecursiveDelete class in order to make this test run fast.
            const maxPendingOps = 100;
            const minPendingOps = 11;
            const maxBatchSize = 10;
            const cutoff = maxPendingOps - minPendingOps;
            let numDeletesBuffered = 0;
            // This deferred promise is used to delay the BatchWriteResponses from
            // returning in order to create the situation where the number of pending
            // operations is less than `minPendingOps`.
            const bufferDeferred = new util_1.Deferred();
            // This deferred completes when the second query is run.
            const secondQueryDeferred = new util_1.Deferred();
            const nLengthArray = (n) => Array.from(Array(n).keys());
            const firstStream = nLengthArray(maxPendingOps).map((_, i) => (0, query_1.result)('doc' + i));
            const batchWriteResponse = (0, bulk_writer_1.mergeResponses)(nLengthArray(maxBatchSize).map(() => (0, bulk_writer_1.successResponse)(1)));
            // Use an array to store that the queryEquals() method succeeded, since
            // thrown errors do not result in the recursiveDelete() method failing.
            const called = [];
            const overrides = {
                runQuery: request => {
                    if (called.length === 0) {
                        (0, query_1.queryEquals)(request, (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.fieldFiltersQuery)('__name__', 'GREATER_THAN_OR_EQUAL', startAt('root'), '__name__', 'LESS_THAN', endAt('root')), (0, query_1.limit)(maxPendingOps));
                        called.push(1);
                        return (0, helpers_1.stream)(...firstStream);
                    }
                    else if (called.length === 1) {
                        (0, query_1.queryEquals)(request, (0, query_1.select)('__name__'), (0, query_1.allDescendants)(/* kindless= */ true), (0, query_1.orderBy)('__name__', 'ASCENDING'), (0, query_1.fieldFiltersQuery)('__name__', 'GREATER_THAN_OR_EQUAL', startAt('root'), '__name__', 'LESS_THAN', endAt('root')), (0, query_1.startAt)(false, {
                            referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                                'documents/collectionId/doc' +
                                (maxPendingOps - 1),
                        }), (0, query_1.limit)(maxPendingOps));
                        called.push(2);
                        secondQueryDeferred.resolve();
                        return (0, helpers_1.stream)();
                    }
                    else {
                        called.push(3);
                        return (0, helpers_1.stream)();
                    }
                },
                batchWrite: () => {
                    const returnedResponse = (0, helpers_1.response)({
                        writeResults: batchWriteResponse.writeResults,
                        status: batchWriteResponse.status,
                    });
                    if (numDeletesBuffered < cutoff) {
                        numDeletesBuffered += batchWriteResponse.writeResults.length;
                        // By waiting for `bufferFuture` to complete, we can guarantee that
                        // the writes complete after all documents are streamed. Without
                        // this future, the test can race and complete the writes before
                        // the stream is finished, which is a different scenario this test
                        // is not for.
                        return bufferDeferred.promise.then(() => returnedResponse);
                    }
                    else {
                        // Once there are `cutoff` pending deletes, completing the future
                        // allows enough responses to be returned such that the number of
                        // pending deletes should be less than `minPendingOps`. This allows
                        // us to test that the second query is made.
                        bufferDeferred.resolve();
                        return secondQueryDeferred.promise.then(() => returnedResponse);
                    }
                },
            };
            const firestore = await (0, helpers_1.createInstance)(overrides);
            const bulkWriter = firestore.bulkWriter();
            bulkWriter._setMaxBatchSize(maxBatchSize);
            await firestore._recursiveDelete(firestore.collection('root'), maxPendingOps, minPendingOps, bulkWriter);
            (0, chai_1.expect)(called).to.deep.equal([1, 2]);
        });
    });
    (0, mocha_1.describe)('deletes', () => {
        (0, mocha_1.it)('collection', async () => {
            // The four documents are under the 'collectionId' collection, and is
            // automatically prefixed by `instantiateInstance()`.
            firestore = await instantiateInstance([
                'anna',
                'bob',
                'bob/children/charlie',
                'bob/children/daniel',
            ]);
            await firestore.recursiveDelete(firestore.collection('collectionId'));
        });
        (0, mocha_1.it)('document along with reference', async () => {
            firestore = await instantiateInstance(['bob/children/brian', 'bob/children/charlie', 'bob/children/daniel'], 'bob');
            await firestore.recursiveDelete(firestore.collection('collectionId').doc('bob'));
        });
        (0, mocha_1.it)('promise is rejected with the last error code if writes fail', async () => {
            firestore = await instantiateInstance(['bob/children/brian', 'bob/children/charlie', 'bob/children/daniel'], 'bob', (0, bulk_writer_1.mergeResponses)([
                (0, bulk_writer_1.successResponse)(1),
                (0, bulk_writer_1.failedResponse)(google_gax_1.Status.CANCELLED),
                (0, bulk_writer_1.failedResponse)(google_gax_1.Status.PERMISSION_DENIED),
                (0, bulk_writer_1.successResponse)(1),
            ]));
            try {
                await firestore.recursiveDelete(firestore.collection('collectionId').doc('bob'));
                (0, assert_1.fail)('recursiveDelete should have failed');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.PERMISSION_DENIED);
                (0, chai_1.expect)(err.message).to.contain('2 deletes failed');
            }
        });
        (0, mocha_1.it)('promise is rejected if BulkWriter success handler fails', async () => {
            firestore = await instantiateInstance(['bob/children/brian'], 'bob');
            const bulkWriter = firestore.bulkWriter();
            bulkWriter.onWriteResult(() => {
                throw new Error('User provided result callback failed');
            });
            try {
                await firestore.recursiveDelete(firestore.collection('collectionId').doc('bob'), bulkWriter);
                (0, assert_1.fail)('recursiveDelete() should have failed');
            }
            catch (err) {
                (0, chai_1.expect)(err.message).to.contain('2 deletes failed');
                (0, chai_1.expect)(err.stack).to.contain('User provided result callback failed');
            }
        });
        (0, mocha_1.it)('BulkWriter success handler provides the correct references and results', async () => {
            firestore = await instantiateInstance(['bob/children/brian', 'bob/children/charlie'], 'bob', (0, bulk_writer_1.mergeResponses)([
                (0, bulk_writer_1.successResponse)(1),
                (0, bulk_writer_1.successResponse)(2),
                (0, bulk_writer_1.successResponse)(3),
            ]));
            const results = [];
            const refs = [];
            const bulkWriter = firestore.bulkWriter();
            bulkWriter.onWriteResult((ref, result) => {
                results.push(result.writeTime.seconds);
                refs.push(ref.path);
            });
            await firestore.recursiveDelete(firestore.collection('collectionId').doc('bob'), bulkWriter);
            (0, chai_1.expect)(results).to.deep.equal([1, 2, 3]);
            (0, chai_1.expect)(refs).to.deep.equal([
                'collectionId/bob/children/brian',
                'collectionId/bob/children/charlie',
                'collectionId/bob',
            ]);
        });
        (0, mocha_1.it)('BulkWriter error handler provides the correct information', async () => {
            firestore = await instantiateInstance(['bob/children/brian', 'bob/children/charlie'], 'bob', (0, bulk_writer_1.mergeResponses)([
                (0, bulk_writer_1.failedResponse)(google_gax_1.Status.PERMISSION_DENIED),
                (0, bulk_writer_1.failedResponse)(google_gax_1.Status.UNAVAILABLE),
                (0, bulk_writer_1.failedResponse)(google_gax_1.Status.INTERNAL),
            ]));
            const codes = [];
            const refs = [];
            const bulkWriter = firestore.bulkWriter();
            bulkWriter.onWriteError(err => {
                codes.push(err.code);
                refs.push(err.documentRef.path);
                return false;
            });
            try {
                await firestore.recursiveDelete(firestore.collection('collectionId').doc('bob'), bulkWriter);
                (0, assert_1.fail)('recursiveDelete() should have failed');
            }
            catch (err) {
                (0, chai_1.expect)(codes).to.deep.equal([
                    google_gax_1.Status.PERMISSION_DENIED,
                    google_gax_1.Status.UNAVAILABLE,
                    google_gax_1.Status.INTERNAL,
                ]);
                (0, chai_1.expect)(refs).to.deep.equal([
                    'collectionId/bob/children/brian',
                    'collectionId/bob/children/charlie',
                    'collectionId/bob',
                ]);
            }
        });
        (0, mocha_1.it)('promise is rejected if provided reference was not deleted', async () => {
            const overrides = {
                runQuery: () => (0, helpers_1.stream)(),
                batchWrite: () => {
                    throw new google_gax_1.GoogleError('batchWrite() failed in test');
                },
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            try {
                await firestore.recursiveDelete(firestore.doc('root/doc'));
            }
            catch (err) {
                (0, chai_1.expect)(err.stack).to.contain('batchWrite() failed in test');
            }
        });
        (0, mocha_1.it)('retries stream errors', async () => {
            let attempts = 0;
            const overrides = {
                runQuery: () => {
                    attempts++;
                    throw new Error('runQuery() error in test');
                },
                batchWrite: () => (0, helpers_1.response)((0, bulk_writer_1.successResponse)(1)),
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            try {
                await firestore.recursiveDelete(firestore.doc('coll/foo'));
                (0, assert_1.fail)('recursiveDelete() should have failed');
            }
            catch (err) {
                (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.UNAVAILABLE);
                (0, chai_1.expect)(err.stack).to.contain('Failed to fetch children documents');
                (0, chai_1.expect)(err.stack).to.contain('runQuery() error in test');
                (0, chai_1.expect)(attempts).to.equal(src_1.MAX_REQUEST_RETRIES);
            }
        });
        (0, mocha_1.it)('handles successful stream error retries', async () => {
            let requestCounter = 0;
            const streamItems = [
                [(0, query_1.result)('a'), (0, query_1.result)('b'), new Error('runQuery() error in test')],
                [new Error('runQuery() error in test')],
                [(0, query_1.result)('c'), new Error('runQuery() error in test')],
                [(0, query_1.result)('d')],
            ];
            const overrides = {
                runQuery: () => {
                    const streamPromise = (0, helpers_1.stream)(...streamItems[requestCounter]);
                    requestCounter++;
                    return streamPromise;
                },
                batchWrite: request => {
                    const expected = (0, bulk_writer_1.createRequest)([
                        (0, bulk_writer_1.deleteOp)('a'),
                        (0, bulk_writer_1.deleteOp)('b'),
                        (0, bulk_writer_1.deleteOp)('c'),
                        (0, bulk_writer_1.deleteOp)('d'),
                    ]);
                    try {
                        (0, chai_1.expect)(request.writes).to.deep.equal(expected.writes);
                    }
                    catch (e) {
                        batchWriteError = e;
                    }
                    return (0, helpers_1.response)((0, bulk_writer_1.mergeResponses)(expected.writes.map(() => (0, bulk_writer_1.successResponse)(1))));
                },
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            await firestore.recursiveDelete(firestore.collection('letters'));
        });
        (0, mocha_1.it)('handles multiple calls to recursiveDelete()', async () => {
            let requestCounter = 0;
            const docIds = ['a', 'b', 'c'];
            const streamItems = docIds.map(docId => [(0, query_1.result)(docId)]);
            const expected = docIds.map(docId => (0, bulk_writer_1.createRequest)([(0, bulk_writer_1.deleteOp)(docId)]));
            const responses = docIds.map(() => (0, bulk_writer_1.successResponse)(1));
            const overrides = {
                runQuery: () => {
                    return (0, helpers_1.stream)(...streamItems[requestCounter]);
                },
                batchWrite: request => {
                    try {
                        (0, chai_1.expect)(request.writes).to.deep.equal(expected[requestCounter].writes);
                    }
                    catch (e) {
                        batchWriteError = e;
                    }
                    const responsePromise = (0, helpers_1.response)(responses[requestCounter]);
                    requestCounter++;
                    return responsePromise;
                },
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            await firestore.recursiveDelete(firestore.collection('a'));
            await firestore.recursiveDelete(firestore.collection('b'));
            await firestore.recursiveDelete(firestore.collection('c'));
        });
        (0, mocha_1.it)('accepts references with converters', async () => {
            const overrides = {
                runQuery: () => (0, helpers_1.stream)(),
                // Include response for deleting the provided document reference.
                batchWrite: () => (0, helpers_1.response)((0, bulk_writer_1.successResponse)(1)),
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            await firestore.recursiveDelete(firestore.doc('root/doc').withConverter(helpers_1.postConverter));
            await firestore.recursiveDelete(firestore.collection('root').withConverter(helpers_1.postConverter));
        });
    });
    (0, mocha_1.describe)('BulkWriter instance', () => {
        (0, mocha_1.it)('uses custom BulkWriter instance if provided', async () => {
            firestore = await instantiateInstance(['a', 'b', 'c']);
            let callbackCount = 0;
            const bulkWriter = firestore.bulkWriter();
            bulkWriter.onWriteResult(() => {
                callbackCount++;
            });
            await firestore.recursiveDelete(firestore.collection('foo'), bulkWriter);
            (0, chai_1.expect)(callbackCount).to.equal(3);
        });
        (0, mocha_1.it)('default: uses the same BulkWriter instance across calls', async () => {
            const overrides = {
                runQuery: () => (0, helpers_1.stream)(),
            };
            firestore = await (0, helpers_1.createInstance)(overrides);
            const spy = sinon.spy(firestore, 'bulkWriter');
            await firestore.recursiveDelete(firestore.collection('foo'));
            await firestore.recursiveDelete(firestore.collection('boo'));
            await firestore.recursiveDelete(firestore.collection('moo'));
            // Only the first recursiveDelete() call should have called the
            // constructor. Subsequent calls should have used the same bulkWriter.
            (0, chai_1.expect)(spy.callCount).to.equal(1);
        });
        (0, mocha_1.it)('throws error if BulkWriter instance is closed', async () => {
            firestore = await (0, helpers_1.createInstance)();
            const bulkWriter = firestore.bulkWriter();
            await bulkWriter.close();
            await (0, chai_1.expect)(() => () => firestore.recursiveDelete(firestore.collection('foo'), bulkWriter)).to.throw;
        });
    });
});
//# sourceMappingURL=recursive-delete.js.map
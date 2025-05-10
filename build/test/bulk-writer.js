"use strict";
// Copyright 2020 Google LLC
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
exports.createRequest = createRequest;
exports.successResponse = successResponse;
exports.failedResponse = failedResponse;
exports.mergeResponses = mergeResponses;
exports.setOp = setOp;
exports.updateOp = updateOp;
exports.createOp = createOp;
exports.deleteOp = deleteOp;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const google_gax_1 = require("google-gax");
const src_1 = require("../src");
const backoff_1 = require("../src/backoff");
const bulk_writer_1 = require("../src/bulk-writer");
const util_1 = require("../src/util");
const helpers_1 = require("./util/helpers");
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
const PROJECT_ID = 'test-project';
function createRequest(requests) {
    return {
        writes: requests,
    };
}
function successResponse(updateTimeSeconds) {
    return {
        writeResults: [
            {
                updateTime: {
                    nanos: 0,
                    seconds: updateTimeSeconds,
                },
            },
        ],
        status: [{ code: google_gax_1.Status.OK }],
    };
}
function failedResponse(code = google_gax_1.Status.DEADLINE_EXCEEDED) {
    return {
        writeResults: [
            {
                updateTime: null,
            },
        ],
        status: [{ code }],
    };
}
function mergeResponses(responses) {
    return {
        writeResults: responses.map(v => v.writeResults[0]),
        status: responses.map(v => v.status[0]),
    };
}
function setOp(doc, value) {
    return (0, helpers_1.set)({
        document: (0, helpers_1.document)(doc, 'foo', value),
    }).writes[0];
}
function updateOp(doc, value) {
    return (0, helpers_1.update)({
        document: (0, helpers_1.document)(doc, 'foo', value),
        mask: (0, helpers_1.updateMask)('foo'),
    }).writes[0];
}
function createOp(doc, value) {
    return (0, helpers_1.create)({
        document: (0, helpers_1.document)(doc, 'foo', value),
    }).writes[0];
}
function deleteOp(doc) {
    return (0, helpers_1.remove)(doc).writes[0];
}
(0, mocha_1.describe)('BulkWriter', () => {
    let firestore;
    let requestCounter;
    let opCount;
    let timeoutHandlerCounter = 0;
    (0, mocha_1.beforeEach)(() => {
        requestCounter = 0;
        opCount = 0;
        timeoutHandlerCounter = 0;
        (0, backoff_1.setTimeoutHandler)((fn, timeout) => {
            // Since a call to the backoff is made before each batchWrite, only
            // increment the counter if the timeout is non-zero, which indicates a
            // retry from an error.
            if (timeout > 0) {
                timeoutHandlerCounter++;
            }
            fn();
        });
    });
    function incrementOpCount() {
        opCount++;
    }
    function verifyOpCount(expected) {
        (0, chai_1.expect)(opCount).to.equal(expected);
    }
    /**
     * Creates an instance with the mocked objects.
     */
    function instantiateInstance(mock) {
        const overrides = {
            batchWrite: async (request, options) => {
                (0, chai_1.expect)(options.retry.retryCodes).contains(google_gax_1.Status.ABORTED);
                (0, chai_1.expect)(request).to.deep.eq({
                    database: `projects/${PROJECT_ID}/databases/(default)`,
                    writes: mock[requestCounter].request.writes,
                });
                const responsePromise = (0, helpers_1.response)({
                    writeResults: mock[requestCounter].response.writeResults,
                    status: mock[requestCounter].response.status,
                });
                requestCounter++;
                return responsePromise;
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
            firestore = firestoreClient;
            return firestore.bulkWriter();
        });
    }
    (0, mocha_1.afterEach)(async () => {
        await (0, helpers_1.verifyInstance)(firestore);
        (0, backoff_1.setTimeoutHandler)(setTimeout);
    });
    (0, mocha_1.describe)('options', () => {
        (0, mocha_1.it)('requires object', async () => {
            const firestore = await (0, helpers_1.createInstance)();
            (0, chai_1.expect)(() => firestore.bulkWriter(42)).to.throw('Value for argument "options" is not a valid bulkWriter() options argument. Input is not an object.');
        });
        (0, mocha_1.it)('initialOpsPerSecond requires positive integer', async () => {
            const firestore = await (0, helpers_1.createInstance)();
            (0, chai_1.expect)(() => firestore.bulkWriter({ throttling: { initialOpsPerSecond: -1 } })).to.throw('Value for argument "initialOpsPerSecond" must be within [1, Infinity] inclusive, but was: -1');
            (0, chai_1.expect)(() => firestore.bulkWriter({ throttling: { initialOpsPerSecond: 500.5 } })).to.throw('Value for argument "initialOpsPerSecond" is not a valid integer.');
        });
        (0, mocha_1.it)('maxOpsPerSecond requires positive integer', async () => {
            const firestore = await (0, helpers_1.createInstance)();
            (0, chai_1.expect)(() => firestore.bulkWriter({ throttling: { maxOpsPerSecond: -1 } })).to.throw('Value for argument "maxOpsPerSecond" must be within [1, Infinity] inclusive, but was: -1');
            (0, chai_1.expect)(() => firestore.bulkWriter({ throttling: { maxOpsPerSecond: 500.5 } })).to.throw('Value for argument "maxOpsPerSecond" is not a valid integer.');
        });
        (0, mocha_1.it)('maxOpsPerSecond must be greater than initial ops per second', async () => {
            const firestore = await (0, helpers_1.createInstance)();
            (0, chai_1.expect)(() => firestore.bulkWriter({
                throttling: { initialOpsPerSecond: 550, maxOpsPerSecond: 500 },
            })).to.throw('Value for argument "options" is not a valid bulkWriter() options argument. "maxOpsPerSecond" cannot be less than "initialOpsPerSecond".');
        });
        (0, mocha_1.it)('initial and max rates are properly set', async () => {
            const firestore = await (0, helpers_1.createInstance)();
            let bulkWriter = firestore.bulkWriter({
                throttling: { initialOpsPerSecond: 500, maxOpsPerSecond: 550 },
            });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(500);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(550);
            bulkWriter = firestore.bulkWriter({
                throttling: { maxOpsPerSecond: 1000 },
            });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(500);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(1000);
            bulkWriter = firestore.bulkWriter({
                throttling: { initialOpsPerSecond: 100 },
            });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(100);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(bulk_writer_1.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT);
            bulkWriter = firestore.bulkWriter({
                throttling: { maxOpsPerSecond: 100 },
            });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(100);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(100);
            bulkWriter = firestore.bulkWriter();
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(bulk_writer_1.DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(bulk_writer_1.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT);
            bulkWriter = firestore.bulkWriter({ throttling: true });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(bulk_writer_1.DEFAULT_INITIAL_OPS_PER_SECOND_LIMIT);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(bulk_writer_1.DEFAULT_MAXIMUM_OPS_PER_SECOND_LIMIT);
            bulkWriter = firestore.bulkWriter({ throttling: false });
            (0, chai_1.expect)(bulkWriter._rateLimiter.availableTokens).to.equal(Number.POSITIVE_INFINITY);
            (0, chai_1.expect)(bulkWriter._rateLimiter.maximumCapacity).to.equal(Number.POSITIVE_INFINITY);
        });
    });
    (0, mocha_1.it)('has a set() method', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: successResponse(2),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        let writeResult;
        bulkWriter.set(doc, { foo: 'bar' }).then(result => {
            incrementOpCount();
            writeResult = result;
        });
        return bulkWriter.close().then(async () => {
            verifyOpCount(1);
            (0, chai_1.expect)(writeResult.writeTime.isEqual(new src_1.Timestamp(2, 0))).to.be.true;
        });
    });
    (0, mocha_1.it)('has an update() method', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([updateOp('doc', 'bar')]),
                response: successResponse(2),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        let writeResult;
        bulkWriter.update(doc, { foo: 'bar' }).then(result => {
            incrementOpCount();
            writeResult = result;
        });
        return bulkWriter.close().then(async () => {
            verifyOpCount(1);
            (0, chai_1.expect)(writeResult.writeTime.isEqual(new src_1.Timestamp(2, 0))).to.be.true;
        });
    });
    (0, mocha_1.it)('has a delete() method', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([deleteOp('doc')]),
                response: successResponse(2),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        let writeResult;
        bulkWriter.delete(doc).then(result => {
            incrementOpCount();
            writeResult = result;
        });
        return bulkWriter.close().then(async () => {
            verifyOpCount(1);
            (0, chai_1.expect)(writeResult.writeTime.isEqual(new src_1.Timestamp(2, 0))).to.be.true;
        });
    });
    (0, mocha_1.it)('has a create() method', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([createOp('doc', 'bar')]),
                response: successResponse(2),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        let writeResult;
        bulkWriter.create(doc, { foo: 'bar' }).then(result => {
            incrementOpCount();
            writeResult = result;
        });
        return bulkWriter.close().then(async () => {
            verifyOpCount(1);
            (0, chai_1.expect)(writeResult.writeTime.isEqual(new src_1.Timestamp(2, 0))).to.be.true;
        });
    });
    (0, mocha_1.it)('surfaces errors', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        bulkWriter.set(doc, { foo: 'bar' }).catch(err => {
            incrementOpCount();
            (0, chai_1.expect)(err instanceof bulk_writer_1.BulkWriterError).to.be.true;
            (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.DEADLINE_EXCEEDED);
        });
        return bulkWriter.close().then(async () => verifyOpCount(1));
    });
    (0, mocha_1.it)('throws UnhandledPromiseRejections if no error handler is passed in', async () => {
        let errorThrown = false;
        const unhandledDeferred = new util_1.Deferred();
        process.on('unhandledRejection', () => {
            errorThrown = true;
            unhandledDeferred.resolve();
        });
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        bulkWriter.set(doc, { foo: 'bar' });
        await bulkWriter.close();
        await unhandledDeferred.promise;
        (0, chai_1.expect)(errorThrown).to.be.true;
    });
    (0, mocha_1.it)('swallows UnhandledPromiseRejections if an error handler is passed in', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        bulkWriter.set(doc, { foo: 'bar' });
        // Set the error handler after calling set() to ensure that the check is
        // performed when the promise resolves.
        bulkWriter.onWriteError(() => false);
        return bulkWriter.close();
    });
    (0, mocha_1.it)('flush() resolves immediately if there are no writes', async () => {
        const bulkWriter = await instantiateInstance([]);
        return bulkWriter.flush().then(() => verifyOpCount(0));
    });
    (0, mocha_1.it)('adds writes to a new batch after calling flush()', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([createOp('doc', 'bar')]),
                response: successResponse(2),
            },
            {
                request: createRequest([setOp('doc2', 'bar1')]),
                response: successResponse(2),
            },
        ]);
        bulkWriter
            .create(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter.flush();
        bulkWriter
            .set(firestore.doc('collectionId/doc2'), { foo: 'bar1' })
            .then(incrementOpCount);
        await bulkWriter.close().then(async () => {
            verifyOpCount(2);
        });
    });
    (0, mocha_1.it)('close() sends all writes', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([createOp('doc', 'bar')]),
                response: successResponse(2),
            },
        ]);
        const doc = firestore.doc('collectionId/doc');
        bulkWriter.create(doc, { foo: 'bar' }).then(incrementOpCount);
        return bulkWriter.close().then(async () => {
            verifyOpCount(1);
        });
    });
    (0, mocha_1.it)('close() resolves immediately if there are no writes', async () => {
        const bulkWriter = await instantiateInstance([]);
        return bulkWriter.close().then(() => verifyOpCount(0));
    });
    (0, mocha_1.it)('cannot call methods after close() is called', async () => {
        const bulkWriter = await instantiateInstance([]);
        const expected = 'BulkWriter has already been closed.';
        const doc = firestore.doc('collectionId/doc');
        await bulkWriter.close();
        (0, chai_1.expect)(() => bulkWriter.set(doc, {})).to.throw(expected);
        (0, chai_1.expect)(() => bulkWriter.create(doc, {})).to.throw(expected);
        (0, chai_1.expect)(() => bulkWriter.update(doc, {})).to.throw(expected);
        (0, chai_1.expect)(() => bulkWriter.flush()).to.throw(expected);
        // Calling close() multiple times is allowed.
        await bulkWriter.close();
    });
    (0, mocha_1.it)('send writes to the same documents in the different batches', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc1', 'bar')]),
                response: successResponse(1),
            },
            {
                request: createRequest([updateOp('doc1', 'bar2')]),
                response: successResponse(2),
            },
        ]);
        const doc1 = firestore.doc('collectionId/doc1');
        bulkWriter.set(doc1, { foo: 'bar' }).then(incrementOpCount);
        bulkWriter.update(doc1, { foo: 'bar2' }).then(incrementOpCount);
        return bulkWriter.close().then(async () => {
            verifyOpCount(2);
        });
    });
    (0, mocha_1.it)('sends writes to different documents in the same batch', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc1', 'bar'), updateOp('doc2', 'bar')]),
                response: mergeResponses([successResponse(1), successResponse(2)]),
            },
        ]);
        const doc1 = firestore.doc('collectionId/doc1');
        const doc2 = firestore.doc('collectionId/doc2');
        bulkWriter.set(doc1, { foo: 'bar' }).then(incrementOpCount);
        bulkWriter.update(doc2, { foo: 'bar' }).then(incrementOpCount);
        return bulkWriter.close().then(async () => {
            verifyOpCount(2);
        });
    });
    (0, mocha_1.it)('buffers subsequent operations after reaching maximum pending op count', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    setOp('doc1', 'bar'),
                    setOp('doc2', 'bar'),
                    setOp('doc3', 'bar'),
                ]),
                response: mergeResponses([
                    successResponse(1),
                    successResponse(2),
                    successResponse(3),
                ]),
            },
            {
                request: createRequest([setOp('doc4', 'bar'), setOp('doc5', 'bar')]),
                response: mergeResponses([successResponse(4), successResponse(5)]),
            },
        ]);
        bulkWriter._setMaxPendingOpCount(3);
        bulkWriter
            .set(firestore.doc('collectionId/doc1'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc3'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc4'), { foo: 'bar' })
            .then(incrementOpCount);
        (0, chai_1.expect)(bulkWriter._getBufferedOperationsCount()).to.equal(1);
        bulkWriter
            .set(firestore.doc('collectionId/doc5'), { foo: 'bar' })
            .then(incrementOpCount);
        (0, chai_1.expect)(bulkWriter._getBufferedOperationsCount()).to.equal(2);
        return bulkWriter.close().then(async () => {
            verifyOpCount(5);
        });
    });
    (0, mocha_1.it)('buffered operations are flushed after being enqueued', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    setOp('doc1', 'bar'),
                    setOp('doc2', 'bar'),
                    setOp('doc3', 'bar'),
                ]),
                response: mergeResponses([
                    successResponse(1),
                    successResponse(2),
                    successResponse(3),
                ]),
            },
            {
                request: createRequest([
                    setOp('doc4', 'bar'),
                    setOp('doc5', 'bar'),
                    setOp('doc6', 'bar'),
                ]),
                response: mergeResponses([
                    successResponse(4),
                    successResponse(5),
                    successResponse(6),
                ]),
            },
            {
                request: createRequest([setOp('doc7', 'bar')]),
                response: successResponse(7),
            },
        ]);
        bulkWriter._setMaxPendingOpCount(6);
        bulkWriter._setMaxBatchSize(3);
        bulkWriter
            .set(firestore.doc('collectionId/doc1'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc3'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc4'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc5'), { foo: 'bar' })
            .then(incrementOpCount);
        bulkWriter
            .set(firestore.doc('collectionId/doc6'), { foo: 'bar' })
            .then(incrementOpCount);
        // The 7th operation is buffered. We want to check that the operation is
        // still sent even though it is not enqueued when close() is called.
        bulkWriter
            .set(firestore.doc('collectionId/doc7'), { foo: 'bar' })
            .then(incrementOpCount);
        return bulkWriter.close().then(async () => {
            verifyOpCount(7);
        });
    });
    (0, mocha_1.it)('runs the success handler', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    createOp('doc1', 'bar'),
                    setOp('doc2', 'bar'),
                    updateOp('doc3', 'bar'),
                    deleteOp('doc4'),
                ]),
                response: mergeResponses([
                    successResponse(1),
                    successResponse(2),
                    successResponse(3),
                    successResponse(4),
                ]),
            },
        ]);
        const writeResults = [];
        bulkWriter.onWriteResult((documentRef, result) => {
            writeResults.push(result.writeTime.seconds);
        });
        bulkWriter.create(firestore.doc('collectionId/doc1'), { foo: 'bar' });
        bulkWriter.set(firestore.doc('collectionId/doc2'), { foo: 'bar' });
        bulkWriter.update(firestore.doc('collectionId/doc3'), { foo: 'bar' });
        bulkWriter.delete(firestore.doc('collectionId/doc4'));
        return bulkWriter.close().then(() => {
            (0, chai_1.expect)(writeResults).to.deep.equal([1, 2, 3, 4]);
        });
    });
    (0, mocha_1.it)('can retry failed operations with global error callback', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    createOp('doc', 'bar'),
                    setOp('doc1', 'bar'),
                    updateOp('doc2', 'bar'),
                    deleteOp('doc3'),
                ]),
                response: mergeResponses([
                    successResponse(1),
                    failedResponse(google_gax_1.Status.CANCELLED),
                    failedResponse(google_gax_1.Status.CANCELLED),
                    failedResponse(google_gax_1.Status.CANCELLED),
                ]),
            },
            {
                request: createRequest([
                    setOp('doc1', 'bar'),
                    updateOp('doc2', 'bar'),
                    deleteOp('doc3'),
                ]),
                response: mergeResponses([
                    successResponse(2),
                    successResponse(3),
                    successResponse(4),
                ]),
            },
        ]);
        const ops = [];
        const writeResults = [];
        bulkWriter.onWriteError(error => {
            ops.push(error.operationType);
            return true;
        });
        bulkWriter.onWriteResult((documentRef, result) => {
            ops.push('success');
            writeResults.push(result.writeTime.seconds);
        });
        bulkWriter.create(firestore.doc('collectionId/doc'), { foo: 'bar' });
        bulkWriter.set(firestore.doc('collectionId/doc1'), { foo: 'bar' });
        bulkWriter.update(firestore.doc('collectionId/doc2'), { foo: 'bar' });
        bulkWriter.delete(firestore.doc('collectionId/doc3'));
        return bulkWriter.close().then(() => {
            (0, chai_1.expect)(ops).to.deep.equal([
                'success',
                'set',
                'update',
                'delete',
                'success',
                'success',
                'success',
            ]);
            (0, chai_1.expect)(writeResults).to.deep.equal([1, 2, 3, 4]);
            (0, chai_1.expect)(timeoutHandlerCounter).to.equal(1);
        });
    });
    (0, mocha_1.it)('errors are still surfaced even if a retry function is specified', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
        ]);
        let onWriteErrorCalled = false;
        let catchCalled = false;
        bulkWriter.onWriteError(() => {
            onWriteErrorCalled = true;
            return false;
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .catch(err => {
            (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.INTERNAL);
            catchCalled = true;
        });
        await bulkWriter.flush();
        (0, chai_1.expect)(catchCalled).to.be.true;
        (0, chai_1.expect)(onWriteErrorCalled).to.be.true;
    });
    (0, mocha_1.it)('retries INTERNAL errors for deletes', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc1', 'bar'), deleteOp('doc2')]),
                response: mergeResponses([
                    failedResponse(google_gax_1.Status.INTERNAL),
                    failedResponse(google_gax_1.Status.INTERNAL),
                ]),
            },
            {
                request: createRequest([deleteOp('doc2')]),
                response: successResponse(2),
            },
        ]);
        let errorCaught = false;
        bulkWriter
            .set(firestore.doc('collectionId/doc1'), {
            foo: 'bar',
        })
            .catch(() => {
            errorCaught = true;
        });
        const del = bulkWriter.delete(firestore.doc('collectionId/doc2'));
        await bulkWriter.close();
        (0, chai_1.expect)((await del).writeTime).to.deep.equal(new src_1.Timestamp(2, 0));
        (0, chai_1.expect)(errorCaught).to.be.true;
    });
    (0, mocha_1.it)('surfaces errors thrown by user-provided error callback', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
        ]);
        let errorCaught = false;
        bulkWriter.onWriteError(() => {
            throw new Error('User provided error callback failed');
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('User provided error callback failed');
            errorCaught = true;
        });
        await bulkWriter.flush();
        (0, chai_1.expect)(errorCaught).to.be.true;
    });
    (0, mocha_1.it)('write fails if user-provided success callback fails', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: successResponse(1),
            },
        ]);
        let errorCaught = false;
        bulkWriter.onWriteResult(() => {
            throw new Error('User provided success callback failed');
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('User provided success callback failed');
            errorCaught = true;
        });
        await bulkWriter.flush();
        (0, chai_1.expect)(errorCaught).to.be.true;
    });
    (0, mocha_1.it)('retries multiple times', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: successResponse(1),
            },
        ]);
        let writeResult = 0;
        bulkWriter.onWriteError(() => {
            return true;
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .then(res => {
            writeResult = res.writeTime.seconds;
        });
        await bulkWriter.close();
        (0, chai_1.expect)(writeResult).to.equal(1);
        (0, chai_1.expect)(timeoutHandlerCounter).to.equal(3);
    });
    (0, mocha_1.it)('retries with smaller batch size', async () => {
        const nLengthArray = (n) => Array.from(Array(n).keys());
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest(nLengthArray(15).map((_, i) => setOp('doc' + i, 'bar'))),
                response: mergeResponses(nLengthArray(15).map(() => failedResponse(google_gax_1.Status.ABORTED))),
            },
            {
                request: createRequest(nLengthArray(bulk_writer_1.RETRY_MAX_BATCH_SIZE).map((_, i) => setOp('doc' + i, 'bar'))),
                response: mergeResponses(nLengthArray(bulk_writer_1.RETRY_MAX_BATCH_SIZE).map(() => successResponse(1))),
            },
            {
                request: createRequest(nLengthArray(15 - bulk_writer_1.RETRY_MAX_BATCH_SIZE).map((_, i) => setOp('doc' + (i + bulk_writer_1.RETRY_MAX_BATCH_SIZE), 'bar'))),
                response: mergeResponses(nLengthArray(15 - bulk_writer_1.RETRY_MAX_BATCH_SIZE).map(() => successResponse(1))),
            },
        ]);
        for (let i = 0; i < 15; i++) {
            bulkWriter
                .set(firestore.doc('collectionId/doc' + i), { foo: 'bar' })
                .then(incrementOpCount);
        }
        await bulkWriter.close();
        (0, chai_1.expect)(opCount).to.equal(15);
    });
    (0, mocha_1.it)('retries maintain correct write resolution ordering', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: successResponse(1),
            },
            {
                request: createRequest([setOp('doc2', 'bar')]),
                response: successResponse(2),
            },
        ]);
        const ops = [];
        bulkWriter.onWriteError(() => {
            return true;
        });
        bulkWriter.set(firestore.doc('collectionId/doc'), { foo: 'bar' }).then(() => {
            ops.push('before_flush');
        });
        await bulkWriter.flush().then(() => {
            ops.push('flush');
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
            .then(() => {
            ops.push('after_flush');
        });
        (0, chai_1.expect)(ops).to.deep.equal(['before_flush', 'flush']);
        return bulkWriter.close().then(() => {
            (0, chai_1.expect)(ops).to.deep.equal(['before_flush', 'flush', 'after_flush']);
        });
    });
    (0, mocha_1.it)('returns the error if no retry is specified', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
            {
                request: createRequest([setOp('doc', 'bar')]),
                response: failedResponse(google_gax_1.Status.INTERNAL),
            },
        ]);
        let code = -1;
        bulkWriter.onWriteError(error => {
            return error.failedAttempts < 3;
        });
        bulkWriter
            .set(firestore.doc('collectionId/doc'), { foo: 'bar' })
            .catch(err => {
            code = err.code;
        });
        await bulkWriter.close();
        (0, chai_1.expect)(code).to.equal(google_gax_1.Status.INTERNAL);
    });
    (0, mocha_1.it)('splits into multiple batches after exceeding maximum batch size', async () => {
        const arrayRange = Array.from(new Array(6), (_, i) => i);
        const requests = arrayRange.map(i => setOp('doc' + i, 'bar'));
        const responses = arrayRange.map(i => successResponse(i));
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([requests[0], requests[1]]),
                response: mergeResponses([responses[0], responses[1]]),
            },
            {
                request: createRequest([requests[2], requests[3]]),
                response: mergeResponses([responses[2], responses[3]]),
            },
            {
                request: createRequest([requests[4], requests[5]]),
                response: mergeResponses([responses[4], responses[5]]),
            },
        ]);
        bulkWriter._setMaxBatchSize(2);
        for (let i = 0; i < 6; i++) {
            bulkWriter
                .set(firestore.doc('collectionId/doc' + i), { foo: 'bar' })
                .then(incrementOpCount);
        }
        return bulkWriter.close().then(async () => {
            verifyOpCount(6);
        });
    });
    (0, mocha_1.it)('sends batches automatically when the batch size limit is reached', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    setOp('doc1', 'bar'),
                    updateOp('doc2', 'bar'),
                    createOp('doc3', 'bar'),
                ]),
                response: mergeResponses([
                    successResponse(1),
                    successResponse(2),
                    successResponse(3),
                ]),
            },
            {
                request: createRequest([deleteOp('doc4')]),
                response: successResponse(3),
            },
        ]);
        bulkWriter._setMaxBatchSize(3);
        const promise1 = bulkWriter
            .set(firestore.doc('collectionId/doc1'), { foo: 'bar' })
            .then(incrementOpCount);
        const promise2 = bulkWriter
            .update(firestore.doc('collectionId/doc2'), { foo: 'bar' })
            .then(incrementOpCount);
        const promise3 = bulkWriter
            .create(firestore.doc('collectionId/doc3'), { foo: 'bar' })
            .then(incrementOpCount);
        // The 4th write should not sent because it should be in a new batch.
        bulkWriter
            .delete(firestore.doc('collectionId/doc4'))
            .then(incrementOpCount);
        await Promise.all([promise1, promise2, promise3]).then(() => {
            verifyOpCount(3);
        });
        return bulkWriter.close().then(async () => {
            verifyOpCount(4);
        });
    });
    (0, mocha_1.it)('supports different type converters', async () => {
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([setOp('doc1', 'boo'), setOp('doc2', 'moo')]),
                response: mergeResponses([successResponse(1), successResponse(2)]),
            },
        ]);
        class Boo {
        }
        const booConverter = {
            toFirestore() {
                return { foo: 'boo' };
            },
            fromFirestore() {
                return new Boo();
            },
        };
        class Moo {
        }
        const mooConverter = {
            toFirestore() {
                return { foo: 'moo' };
            },
            fromFirestore() {
                return new Moo();
            },
        };
        const doc1 = firestore.doc('collectionId/doc1').withConverter(booConverter);
        const doc2 = firestore.doc('collectionId/doc2').withConverter(mooConverter);
        bulkWriter.set(doc1, new Boo()).then(incrementOpCount);
        bulkWriter.set(doc2, new Moo()).then(incrementOpCount);
        return bulkWriter.close().then(() => verifyOpCount(2));
    });
    (0, mocha_1.it)('retries individual writes that fail with ABORTED and UNAVAILABLE errors', async () => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
        // Create mock responses that simulate one successful write followed by
        // failed responses.
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([
                    setOp('doc1', 'bar'),
                    setOp('doc2', 'bar2'),
                    setOp('doc3', 'bar'),
                ]),
                response: mergeResponses([
                    failedResponse(),
                    failedResponse(google_gax_1.Status.UNAVAILABLE),
                    failedResponse(google_gax_1.Status.ABORTED),
                ]),
            },
            {
                request: createRequest([setOp('doc2', 'bar2'), setOp('doc3', 'bar')]),
                response: mergeResponses([
                    successResponse(2),
                    failedResponse(google_gax_1.Status.ABORTED),
                ]),
            },
            {
                request: createRequest([setOp('doc3', 'bar')]),
                response: mergeResponses([successResponse(3)]),
            },
        ]);
        // Test writes to the same document in order to verify that retry logic
        // is unaffected by the document key.
        bulkWriter
            .set(firestore.doc('collectionId/doc1'), {
            foo: 'bar',
        })
            .catch(incrementOpCount);
        const set2 = bulkWriter.set(firestore.doc('collectionId/doc2'), {
            foo: 'bar2',
        });
        const set3 = bulkWriter.set(firestore.doc('collectionId/doc3'), {
            foo: 'bar',
        });
        await bulkWriter.close();
        (0, chai_1.expect)((await set2).writeTime).to.deep.equal(new src_1.Timestamp(2, 0));
        (0, chai_1.expect)((await set3).writeTime).to.deep.equal(new src_1.Timestamp(3, 0));
        // Check that set1 was not retried
        verifyOpCount(1);
    });
    (0, mocha_1.describe)('Timeout handler tests', () => {
        // Return success responses for all requests.
        function instantiateInstance(options) {
            const overrides = {
                batchWrite: request => {
                    var _a;
                    const requestLength = ((_a = request.writes) === null || _a === void 0 ? void 0 : _a.length) || 0;
                    const responses = mergeResponses(Array.from(new Array(requestLength), (_, i) => successResponse(i)));
                    return (0, helpers_1.response)({
                        writeResults: responses.writeResults,
                        status: responses.status,
                    });
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
                firestore = firestoreClient;
                return firestore.bulkWriter(options);
            });
        }
        (0, mocha_1.it)('does not send batches if doing so exceeds the rate limit', done => {
            instantiateInstance({ throttling: { maxOpsPerSecond: 5 } }).then(bulkWriter => {
                let timeoutCalled = false;
                (0, backoff_1.setTimeoutHandler)((_, timeout) => {
                    if (!timeoutCalled && timeout > 0) {
                        timeoutCalled = true;
                        done();
                    }
                });
                for (let i = 0; i < 500; i++) {
                    bulkWriter.set(firestore.doc('collectionId/doc' + i), { foo: 'bar' });
                }
                // The close() promise will never resolve. Since we do not call the
                // callback function in the overridden handler, subsequent requests
                // after the timeout will not be made. The close() call is used to
                // ensure that the final batch is sent.
                bulkWriter.close();
            });
        });
    });
    (0, mocha_1.it)('retries batchWrite when the RPC fails with retryable error', async () => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
        let retryAttempts = 0;
        function instantiateInstance() {
            const overrides = {
                batchWrite: () => {
                    retryAttempts++;
                    if (retryAttempts < 5) {
                        const error = new google_gax_1.GoogleError('Mock batchWrite failed in test');
                        error.code = google_gax_1.Status.ABORTED;
                        throw error;
                    }
                    else {
                        const mockResponse = successResponse(1);
                        return (0, helpers_1.response)({
                            writeResults: mockResponse.writeResults,
                            status: mockResponse.status,
                        });
                    }
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
                firestore = firestoreClient;
                return firestore.bulkWriter();
            });
        }
        const bulkWriter = await instantiateInstance();
        let writeResult;
        bulkWriter
            .create(firestore.doc('collectionId/doc'), {
            foo: 'bar',
        })
            .then(result => {
            incrementOpCount();
            writeResult = result;
        });
        return bulkWriter.close().then(async () => {
            (0, chai_1.expect)(writeResult.writeTime.isEqual(new src_1.Timestamp(1, 0))).to.be.true;
        });
    });
    (0, mocha_1.it)('fails writes after all retry attempts failed', async () => {
        (0, backoff_1.setTimeoutHandler)((fn, timeout) => {
            const expected = backoff_1.DEFAULT_BACKOFF_INITIAL_DELAY_MS * Math.pow(1.5, timeoutHandlerCounter);
            (0, chai_1.expect)(timeout).to.be.within((1 - bulk_writer_1.DEFAULT_JITTER_FACTOR) * expected, (1 + bulk_writer_1.DEFAULT_JITTER_FACTOR) * expected);
            timeoutHandlerCounter++;
            fn();
        });
        function instantiateInstance() {
            const overrides = {
                batchWrite: () => {
                    const error = new google_gax_1.GoogleError('Mock batchWrite failed in test');
                    error.code = google_gax_1.Status.ABORTED;
                    throw error;
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
                firestore = firestoreClient;
                return firestore.bulkWriter();
            });
        }
        const bulkWriter = await instantiateInstance();
        bulkWriter
            .create(firestore.doc('collectionId/doc'), {
            foo: 'bar',
        })
            .catch(err => {
            (0, chai_1.expect)(err instanceof bulk_writer_1.BulkWriterError).to.be.true;
            (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.ABORTED);
            incrementOpCount();
        });
        return bulkWriter.close().then(() => {
            verifyOpCount(1);
            (0, chai_1.expect)(timeoutHandlerCounter).to.equal(backoff_1.MAX_RETRY_ATTEMPTS - 1);
        });
    });
    (0, mocha_1.it)('applies maximum backoff on retries for RESOURCE_EXHAUSTED', async () => {
        (0, backoff_1.setTimeoutHandler)((fn, timeout) => {
            timeoutHandlerCounter++;
            (0, chai_1.expect)(timeout).to.be.within((1 - bulk_writer_1.DEFAULT_JITTER_FACTOR) * backoff_1.DEFAULT_BACKOFF_MAX_DELAY_MS, (1 + bulk_writer_1.DEFAULT_JITTER_FACTOR) * backoff_1.DEFAULT_BACKOFF_MAX_DELAY_MS);
            fn();
        });
        function instantiateInstance() {
            const overrides = {
                batchWrite: () => {
                    const error = new google_gax_1.GoogleError('Mock batchWrite failed in test');
                    error.code = google_gax_1.Status.RESOURCE_EXHAUSTED;
                    throw error;
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
                firestore = firestoreClient;
                return firestore.bulkWriter();
            });
        }
        const bulkWriter = await instantiateInstance();
        bulkWriter.onWriteError(err => err.failedAttempts < 5);
        bulkWriter
            .create(firestore.doc('collectionId/doc'), {
            foo: 'bar',
        })
            .catch(err => {
            (0, chai_1.expect)(err instanceof bulk_writer_1.BulkWriterError).to.be.true;
            (0, chai_1.expect)(err.code).to.equal(google_gax_1.Status.RESOURCE_EXHAUSTED);
            incrementOpCount();
        });
        return bulkWriter.close().then(() => {
            verifyOpCount(1);
            (0, chai_1.expect)(timeoutHandlerCounter).to.equal(4);
        });
    });
    (0, mocha_1.it)('uses the highest backoff found in the batch', async () => {
        const expected = [
            backoff_1.DEFAULT_BACKOFF_MAX_DELAY_MS,
            backoff_1.DEFAULT_BACKOFF_INITIAL_DELAY_MS * backoff_1.DEFAULT_BACKOFF_FACTOR,
        ];
        (0, backoff_1.setTimeoutHandler)((fn, timeout) => {
            // 1st batch should have max backoff. 2nd batch should have 1 round
            // of backoff applied.
            (0, chai_1.expect)(timeout).to.be.within((1 - bulk_writer_1.DEFAULT_JITTER_FACTOR) * expected[timeoutHandlerCounter], (1 + bulk_writer_1.DEFAULT_JITTER_FACTOR) * expected[timeoutHandlerCounter]);
            timeoutHandlerCounter++;
            fn();
        });
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([createOp('doc1', 'bar'), setOp('doc2', 'bar')]),
                response: mergeResponses([
                    failedResponse(google_gax_1.Status.RESOURCE_EXHAUSTED),
                    failedResponse(google_gax_1.Status.UNAVAILABLE),
                ]),
            },
            {
                request: createRequest([createOp('doc1', 'bar'), setOp('doc2', 'bar')]),
                response: mergeResponses([
                    successResponse(1),
                    failedResponse(google_gax_1.Status.UNAVAILABLE),
                ]),
            },
            {
                request: createRequest([setOp('doc2', 'bar')]),
                response: successResponse(2),
            },
        ]);
        bulkWriter.onWriteError(err => err.failedAttempts < 5);
        bulkWriter.create(firestore.doc('collectionId/doc1'), {
            foo: 'bar',
        });
        bulkWriter.set(firestore.doc('collectionId/doc2'), {
            foo: 'bar',
        });
        return bulkWriter.close().then(() => {
            (0, chai_1.expect)(timeoutHandlerCounter).to.equal(2);
        });
    });
    (0, mocha_1.it)('sends backoff batch after other enqueued batches', async () => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
        const bulkWriter = await instantiateInstance([
            {
                request: createRequest([createOp('doc1', 'bar')]),
                response: failedResponse(google_gax_1.Status.RESOURCE_EXHAUSTED),
            },
            {
                request: createRequest([setOp('doc2', 'bar')]),
                response: successResponse(1),
            },
            {
                request: createRequest([createOp('doc1', 'bar')]),
                response: successResponse(2),
            },
        ]);
        bulkWriter.onWriteError(err => err.failedAttempts < 5);
        bulkWriter.create(firestore.doc('collectionId/doc1'), {
            foo: 'bar',
        });
        bulkWriter.flush();
        bulkWriter.set(firestore.doc('collectionId/doc2'), {
            foo: 'bar',
        });
        return bulkWriter.close();
    });
    (0, mocha_1.describe)('if bulkCommit() fails', async () => {
        function instantiateInstance() {
            const overrides = {
                batchWrite: () => {
                    throw new Error('Mock batchWrite failed in test');
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
                firestore = firestoreClient;
                return firestore.bulkWriter();
            });
        }
        (0, mocha_1.it)('flush() should not fail', async () => {
            const bulkWriter = await instantiateInstance();
            bulkWriter
                .create(firestore.doc('collectionId/doc'), { foo: 'bar' })
                .catch(incrementOpCount);
            bulkWriter
                .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
                .catch(incrementOpCount);
            await bulkWriter.flush();
            verifyOpCount(2);
            return bulkWriter.close();
        });
        (0, mocha_1.it)('close() should not fail', async () => {
            const bulkWriter = await instantiateInstance();
            bulkWriter
                .create(firestore.doc('collectionId/doc'), { foo: 'bar' })
                .catch(incrementOpCount);
            bulkWriter
                .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
                .catch(incrementOpCount);
            return bulkWriter.close().then(() => verifyOpCount(2));
        });
        (0, mocha_1.it)('all individual writes are rejected', async () => {
            const bulkWriter = await instantiateInstance();
            bulkWriter
                .create(firestore.doc('collectionId/doc'), { foo: 'bar' })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('Mock batchWrite failed in test');
                incrementOpCount();
            });
            bulkWriter
                .set(firestore.doc('collectionId/doc2'), { foo: 'bar' })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('Mock batchWrite failed in test');
                incrementOpCount();
            });
            return bulkWriter.close().then(() => verifyOpCount(2));
        });
    });
});
//# sourceMappingURL=bulk-writer.js.map
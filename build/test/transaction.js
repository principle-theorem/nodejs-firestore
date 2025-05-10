"use strict";
// Copyright 2017 Google LLC
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
const chaiAsPromised = require("chai-as-promised");
const extend = require("extend");
const google_gax_1 = require("google-gax");
const through2 = require("through2");
const Firestore = require("../src");
const src_1 = require("../src");
const backoff_1 = require("../src/backoff");
const helpers_1 = require("./util/helpers");
(0, chai_1.use)(chaiAsPromised);
const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;
const COLLECTION_ROOT = `${DATABASE_ROOT}/documents/collectionId`;
const DOCUMENT_ID = 'documentId';
const DOCUMENT_NAME = `${COLLECTION_ROOT}/${DOCUMENT_ID}`;
// Change the argument to 'console.log' to enable debug output.
Firestore.setLogFunction(null);
/** Helper to create a transaction ID from either a string or a Uint8Array. */
function transactionId(transaction) {
    if (typeof transaction === 'string') {
        return Buffer.from(transaction);
    }
    else {
        return transaction;
    }
}
function commit(transaction, writes, error) {
    const proto = {
        database: DATABASE_ROOT,
    };
    if (transaction) {
        proto.transaction = transactionId(transaction);
    }
    proto.writes = writes || [];
    const response = {
        commitTime: {
            nanos: 0,
            seconds: 0,
        },
        writeResults: [],
    };
    for (let i = 0; i < proto.writes.length; ++i) {
        response.writeResults.push({
            updateTime: {
                nanos: 0,
                seconds: 0,
            },
        });
    }
    return {
        type: 'commit',
        request: proto,
        error,
        response,
    };
}
function rollback(transaction, error) {
    const proto = {
        database: DATABASE_ROOT,
        transaction: transactionId(transaction),
    };
    return {
        type: 'rollback',
        request: proto,
        error,
        response: {},
    };
}
function getAll(docs, options) {
    var _a, _b, _c, _d;
    const request = {
        database: DATABASE_ROOT,
        documents: [],
    };
    if (options === null || options === void 0 ? void 0 : options.transactionId) {
        request.transaction = transactionId(options.transactionId);
    }
    else if ((_a = options === null || options === void 0 ? void 0 : options.newTransaction) === null || _a === void 0 ? void 0 : _a.readWrite) {
        request.newTransaction = {
            readWrite: options.newTransaction.readWrite.prevTransactionId
                ? {
                    retryTransaction: transactionId(options.newTransaction.readWrite.prevTransactionId),
                }
                : {},
        };
    }
    else if ((_b = options === null || options === void 0 ? void 0 : options.newTransaction) === null || _b === void 0 ? void 0 : _b.readOnly) {
        request.newTransaction = {
            readOnly: options.newTransaction.readOnly.readTime
                ? {
                    readTime: (_c = options === null || options === void 0 ? void 0 : options.newTransaction) === null || _c === void 0 ? void 0 : _c.readOnly.readTime.toProto().timestampValue,
                }
                : {},
        };
    }
    if (options === null || options === void 0 ? void 0 : options.readTime) {
        request.readTime = options.readTime.toProto().timestampValue;
    }
    if (options === null || options === void 0 ? void 0 : options.fieldMask) {
        request.mask = { fieldPaths: options.fieldMask };
    }
    const stream = through2.obj();
    if (options === null || options === void 0 ? void 0 : options.newTransaction) {
        // Increment transaction ID (e.g. foo1 -> foo2)
        // or otherwise send foo1 by default for new transactions
        const transactionId = ((_d = options.newTransaction.readWrite) === null || _d === void 0 ? void 0 : _d.prevTransactionId)
            ? options.newTransaction.readWrite.prevTransactionId.slice(0, -1) +
                String(Number(options.newTransaction.readWrite.prevTransactionId.slice(-1)) +
                    1)
            : 'foo1';
        setImmediate(() => {
            stream.push({
                transaction: Buffer.from(transactionId),
            });
        });
    }
    for (const doc of docs) {
        const name = `${COLLECTION_ROOT}/${doc}`;
        request.documents.push(name);
        setImmediate(() => {
            stream.push({
                found: {
                    name,
                    createTime: { seconds: 1, nanos: 2 },
                    updateTime: { seconds: 3, nanos: 4 },
                },
                readTime: { seconds: 5, nanos: 6 },
            });
        });
    }
    setImmediate(() => {
        if (options === null || options === void 0 ? void 0 : options.error) {
            stream.destroy(options.error);
        }
        else {
            stream.push(null);
        }
    });
    return {
        type: 'getDocument',
        request,
        error: options === null || options === void 0 ? void 0 : options.error,
        stream,
    };
}
function getDocument(options) {
    return getAll([(options === null || options === void 0 ? void 0 : options.document) || DOCUMENT_ID], options);
}
function query(options) {
    var _a, _b, _c;
    const request = {
        parent: `${DATABASE_ROOT}/documents`,
        structuredQuery: {
            from: [
                {
                    collectionId: 'collectionId',
                },
            ],
            where: {
                fieldFilter: {
                    field: {
                        fieldPath: 'foo',
                    },
                    op: 'EQUAL',
                    value: {
                        stringValue: 'bar',
                    },
                },
            },
        },
    };
    if (options === null || options === void 0 ? void 0 : options.transactionId) {
        request.transaction = transactionId(options.transactionId);
    }
    else if ((_a = options === null || options === void 0 ? void 0 : options.newTransaction) === null || _a === void 0 ? void 0 : _a.readOnly) {
        request.newTransaction = {
            readOnly: options.newTransaction.readOnly.readTime
                ? {
                    readTime: options.newTransaction.readOnly.readTime.toProto().timestampValue,
                }
                : {},
        };
    }
    else if ((_b = options === null || options === void 0 ? void 0 : options.newTransaction) === null || _b === void 0 ? void 0 : _b.readWrite) {
        request.newTransaction = {
            readWrite: options.newTransaction.readWrite.prevTransactionId
                ? {
                    retryTransaction: transactionId(options.newTransaction.readWrite.prevTransactionId),
                }
                : {},
        };
    }
    if (options === null || options === void 0 ? void 0 : options.readTime) {
        request.readTime = options.readTime.toProto().timestampValue;
    }
    const stream = through2.obj();
    if (options === null || options === void 0 ? void 0 : options.newTransaction) {
        // Increment transaction ID (e.g. foo1 -> foo2)
        // or otherwise send foo1 by default for new transactions
        const transactionId = ((_c = options.newTransaction.readWrite) === null || _c === void 0 ? void 0 : _c.prevTransactionId)
            ? options.newTransaction.readWrite.prevTransactionId.slice(0, -1) +
                String(Number(options.newTransaction.readWrite.prevTransactionId.slice(-1)) +
                    1)
            : 'foo1';
        setImmediate(() => {
            stream.push({
                transaction: Buffer.from(transactionId),
            });
        });
    }
    setImmediate(() => {
        // Push a single result even for errored queries, as this avoids implicit
        // stream retries.
        stream.push({
            document: {
                name: DOCUMENT_NAME,
                createTime: { seconds: 1, nanos: 2 },
                updateTime: { seconds: 3, nanos: 4 },
            },
            readTime: { seconds: 5, nanos: 6 },
        });
        if (options === null || options === void 0 ? void 0 : options.error) {
            stream.destroy(options.error);
        }
        else {
            stream.push(null);
        }
    });
    return {
        type: 'query',
        request,
        stream,
    };
}
function backoff(maxDelay) {
    return {
        type: 'backoff',
        delay: maxDelay ? 'max' : 'exponential',
    };
}
/**
 * Asserts that the given transaction function issues the expected requests.
 */
function runTransaction(transactionOptions, transactionCallback, ...expectedRequests) {
    const overrides = {
        beginTransaction: () => {
            // Transactions are lazily started upon first read so the beginTransaction
            // API should never be called
            chai_1.expect.fail('beginTransaction was called');
        },
        commit: (actual, options) => {
            // Ensure that we do not specify custom retry behavior for transactional
            // commits.
            (0, chai_1.expect)(options.retry).to.be.undefined;
            const request = expectedRequests.shift();
            (0, chai_1.expect)(request.type).to.equal('commit');
            (0, chai_1.expect)(actual).to.deep.eq(request.request);
            if (request.error) {
                return Promise.reject(request.error);
            }
            else {
                return (0, helpers_1.response)(request.response);
            }
        },
        rollback: actual => {
            const request = expectedRequests.shift();
            (0, chai_1.expect)(request.type).to.equal('rollback');
            (0, chai_1.expect)(actual).to.deep.eq(request.request);
            if (request.error) {
                return Promise.reject(request.error);
            }
            else {
                return (0, helpers_1.response)({});
            }
        },
        batchGetDocuments: actual => {
            const request = expectedRequests.shift();
            (0, chai_1.expect)(request.type).to.equal('getDocument');
            (0, chai_1.expect)(actual).to.deep.eq(request.request);
            return request.stream;
        },
        runQuery: actual => {
            const request = expectedRequests.shift();
            (0, chai_1.expect)(request.type).to.equal('query');
            actual = extend(true, {}, actual); // Remove undefined properties
            (0, chai_1.expect)(actual).to.deep.eq(request.request);
            return request.stream;
        },
    };
    return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
        try {
            (0, backoff_1.setTimeoutHandler)((callback, timeout) => {
                if (timeout > 0) {
                    const request = expectedRequests.shift();
                    (0, chai_1.expect)(request.type).to.equal('backoff');
                    if (request.delay === 'max') {
                        // Make sure that the delay is at least 30 seconds, which is based
                        // on the maximum delay of 60 seconds and a jitter factor of 50%.
                        (0, chai_1.expect)(timeout).to.not.be.lessThan(30 * 1000);
                    }
                }
                callback();
            });
            return await firestore.runTransaction(transaction => {
                const docRef = firestore.doc('collectionId/documentId');
                return transactionCallback(transaction, docRef);
            }, transactionOptions);
        }
        finally {
            (0, backoff_1.setTimeoutHandler)(setTimeout);
            (0, chai_1.expect)(expectedRequests.length).to.equal(0, 'Missing requests: ' + expectedRequests.map(r => r.type).join(', '));
        }
    });
}
(0, mocha_1.describe)('successful transactions', () => {
    (0, mocha_1.it)('empty transaction', () => {
        return runTransaction(/* transactionOptions= */ {}, () => {
            return Promise.resolve();
        });
    });
    (0, mocha_1.it)('returns value', () => {
        return runTransaction(/* transactionOptions= */ {}, () => {
            return Promise.resolve('bar');
        }).then(val => {
            (0, chai_1.expect)(val).to.equal('bar');
        });
    });
});
(0, mocha_1.describe)('failed transactions', () => {
    const retryBehavior = {
        [google_gax_1.Status.CANCELLED]: true,
        [google_gax_1.Status.UNKNOWN]: true,
        [google_gax_1.Status.INVALID_ARGUMENT]: false,
        [google_gax_1.Status.DEADLINE_EXCEEDED]: true,
        [google_gax_1.Status.NOT_FOUND]: false,
        [google_gax_1.Status.ALREADY_EXISTS]: false,
        [google_gax_1.Status.RESOURCE_EXHAUSTED]: true,
        [google_gax_1.Status.FAILED_PRECONDITION]: false,
        [google_gax_1.Status.ABORTED]: true,
        [google_gax_1.Status.OUT_OF_RANGE]: false,
        [google_gax_1.Status.UNIMPLEMENTED]: false,
        [google_gax_1.Status.INTERNAL]: true,
        [google_gax_1.Status.UNAVAILABLE]: true,
        [google_gax_1.Status.DATA_LOSS]: false,
        [google_gax_1.Status.UNAUTHENTICATED]: true,
    };
    (0, mocha_1.it)('retries commit based on error code', async () => {
        // The transaction needs to perform a read or write otherwise it will be
        // a no-op and will not retry
        const transactionFunction = async (trans, ref) => {
            await trans.get(ref);
        };
        for (const [errorCode, retry] of Object.entries(retryBehavior)) {
            const serverError = new google_gax_1.GoogleError('Test Error');
            serverError.code = Number(errorCode);
            if (retry) {
                await runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', undefined, serverError), rollback('foo1'), backoff(), getDocument({
                    newTransaction: { readWrite: { prevTransactionId: 'foo1' } },
                }), commit('foo2'));
            }
            else {
                await (0, chai_1.expect)(runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', undefined, serverError), rollback('foo1'))).to.eventually.be.rejected;
            }
        }
    });
    (0, mocha_1.it)('retries commit for expired transaction', async () => {
        // The transaction needs to perform a read or write otherwise it will be
        // a no-op and will not retry
        const transactionFunction = async (trans, ref) => {
            await trans.get(ref);
        };
        const serverError = new google_gax_1.GoogleError('The referenced transaction has expired or is no longer valid.');
        serverError.code = google_gax_1.Status.INVALID_ARGUMENT;
        await runTransaction(
        /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', undefined, serverError), rollback('foo1'), backoff(), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo1' } } }), commit('foo2'));
    });
    (0, mocha_1.it)('retries runQuery based on error code', async () => {
        const transactionFunction = (transaction, docRef) => {
            const query = docRef.parent.where('foo', '==', 'bar');
            return transaction.get(query);
        };
        for (const [errorCode, retry] of Object.entries(retryBehavior)) {
            const serverError = new google_gax_1.GoogleError('Test Error');
            serverError.code = Number(errorCode);
            if (retry) {
                await runTransaction(
                /* transactionOptions= */ {}, transactionFunction, query({ newTransaction: { readWrite: {} }, error: serverError }), 
                // No rollback because the lazy-start operation failed
                backoff(), query({ newTransaction: { readWrite: {} } }), commit('foo1'));
            }
            else {
                await (0, chai_1.expect)(runTransaction(
                /* transactionOptions= */ {}, transactionFunction, query({ newTransaction: { readWrite: {} }, error: serverError })
                // No rollback because the lazy-start operation failed
                )).to.eventually.be.rejected;
            }
        }
    });
    (0, mocha_1.it)('retries batchGetDocuments based on error code', async () => {
        const transactionFunction = (transaction, docRef) => {
            return transaction.get(docRef);
        };
        for (const [errorCode, retry] of Object.entries(retryBehavior)) {
            const serverError = new google_gax_1.GoogleError('Test Error');
            serverError.code = Number(errorCode);
            if (retry) {
                await runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} }, error: serverError }), 
                // No rollback because the lazy-start operation failed
                backoff(), getDocument({ newTransaction: { readWrite: {} } }), commit('foo1'));
            }
            else {
                await (0, chai_1.expect)(runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} }, error: serverError })
                // No rollback because the lazy-start operation failed
                )).to.eventually.be.rejected;
            }
        }
    });
    (0, mocha_1.it)('retries rollback based on error code', async () => {
        const transactionFunction = async (trans, doc) => {
            await trans.get(doc);
        };
        for (const [errorCode, retry] of Object.entries(retryBehavior)) {
            const serverError = new google_gax_1.GoogleError('Test Error');
            serverError.code = Number(errorCode);
            if (retry) {
                await runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', /* writes=*/ undefined, serverError), rollback('foo1', serverError), backoff(), getDocument({
                    newTransaction: { readWrite: { prevTransactionId: 'foo1' } },
                }), commit('foo2'));
            }
            else {
                await (0, chai_1.expect)(runTransaction(
                /* transactionOptions= */ {}, transactionFunction, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', /* writes=*/ undefined, serverError), rollback('foo1', serverError))).to.eventually.be.rejected;
            }
        }
    });
    (0, mocha_1.it)('requires update function', () => {
        const overrides = {
            beginTransaction: () => Promise.reject(),
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            (0, chai_1.expect)(() => firestore.runTransaction()).to.throw('Value for argument "updateFunction" is not a valid function.');
        });
    });
    (0, mocha_1.it)('requires valid retry number', () => {
        const overrides = {
            beginTransaction: () => Promise.reject(),
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            (0, chai_1.expect)(() => firestore.runTransaction(() => Promise.resolve(), {
                maxAttempts: 'foo',
            })).to.throw('Value for argument "transactionOptions.maxAttempts" is not a valid integer.');
            (0, chai_1.expect)(() => firestore.runTransaction(() => Promise.resolve(), { maxAttempts: 0 })).to.throw('Value for argument "transactionOptions.maxAttempts" must be within [1, Infinity] inclusive, but was: 0');
        });
    });
    (0, mocha_1.it)('requires a promise', () => {
        return (0, chai_1.expect)(runTransaction(
        /* transactionOptions= */ {}, (() => { }))).to.eventually.be.rejectedWith('You must return a Promise in your transaction()-callback.');
    });
    (0, mocha_1.it)('handles exception', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            firestore.requestStream = () => {
                return Promise.reject(new Error('Expected exception'));
            };
            return (0, chai_1.expect)(firestore.runTransaction(async (trans) => {
                // Need to perform a read or write otherwise transaction is a no-op
                // with zero requests
                await trans.get(firestore.doc('collectionId/documentId'));
            })).to.eventually.be.rejectedWith('Expected exception');
        });
    });
    (0, mocha_1.it)("doesn't retry custom user exceptions in callback", () => {
        return (0, chai_1.expect)(runTransaction(/* transactionOptions= */ {}, () => {
            return Promise.reject('request exception');
        })).to.eventually.be.rejectedWith('request exception');
    });
    (0, mocha_1.it)('limits the retry attempts', () => {
        const err = new google_gax_1.GoogleError('Server disconnect');
        err.code = google_gax_1.Status.UNAVAILABLE;
        return (0, chai_1.expect)(runTransaction(
        /* transactionOptions= */ {}, (trans, doc) => trans.get(doc), getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', [], err), rollback('foo1'), backoff(), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo1' } } }), commit('foo2', [], err), rollback('foo2'), backoff(), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo2' } } }), commit('foo3', [], err), rollback('foo3'), backoff(), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo3' } } }), commit('foo4', [], err), rollback('foo4'), backoff(), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo4' } } }), commit('foo5', [], new Error('Final exception')), rollback('foo5'))).to.eventually.be.rejectedWith('Final exception');
    });
    (0, mocha_1.it)('uses maximum backoff for RESOURCE_EXHAUSTED', () => {
        const err = new google_gax_1.GoogleError('Server disconnect');
        err.code = google_gax_1.Status.RESOURCE_EXHAUSTED;
        return runTransaction(
        /* transactionOptions= */ {}, (trans, doc) => trans.get(doc), getDocument({ newTransaction: { readWrite: {} } }), commit('foo1', [], err), rollback('foo1'), backoff(/* maxDelay= */ true), getDocument({ newTransaction: { readWrite: { prevTransactionId: 'foo1' } } }), commit('foo2'));
    });
});
(0, mocha_1.describe)('transaction operations', () => {
    (0, mocha_1.it)('support get with document ref', () => {
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            return transaction.get(docRef).then(doc => {
                (0, chai_1.expect)(doc.id).to.equal('documentId');
            });
        }, getDocument({ newTransaction: { readWrite: {} } }), commit('foo1'));
    });
    (0, mocha_1.it)('requires a query or document for get', () => {
        return runTransaction(
        /* transactionOptions= */ {}, (transaction) => {
            (0, chai_1.expect)(() => transaction.get()).to.throw('Value for argument "refOrQuery" must be a DocumentReference, Query, or AggregateQuery.');
            (0, chai_1.expect)(() => transaction.get('foo')).to.throw('Value for argument "refOrQuery" must be a DocumentReference, Query, or AggregateQuery.');
            return Promise.resolve();
        });
    });
    (0, mocha_1.it)('enforce that gets come before writes', () => {
        return (0, chai_1.expect)(runTransaction(/* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.set(docRef, { foo: 'bar' });
            return transaction.get(docRef);
        })).to.eventually.be.rejectedWith('Firestore transactions require all reads to be executed before all writes.');
    });
    (0, mocha_1.it)('enforce read-only cannot write', () => {
        return (0, chai_1.expect)(runTransaction(
        /* transactionOptions= */ { readOnly: true }, async (transaction, docRef) => {
            transaction.set(docRef, { foo: 'bar' });
        })).to.eventually.be.rejectedWith('Firestore read-only transactions cannot execute writes.');
    });
    (0, mocha_1.it)('enforce read-only with readTime cannot write', () => {
        return (0, chai_1.expect)(runTransaction(
        /* transactionOptions= */ {
            readOnly: true,
            readTime: src_1.Timestamp.fromMillis(3),
        }, async (transaction, docRef) => {
            transaction.set(docRef, { foo: 'bar' });
        })).to.eventually.be.rejectedWith('Firestore read-only transactions cannot execute writes.');
    });
    (0, mocha_1.it)('support get with query', () => {
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            const query = docRef.parent.where('foo', '==', 'bar');
            return transaction.get(query).then(results => {
                (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
            });
        }, query({ newTransaction: { readWrite: {} } }), commit('foo1'));
    });
    (0, mocha_1.it)('supports read-only transactions', () => {
        return runTransaction({ readOnly: true }, (transaction, docRef) => transaction.get(docRef), getDocument({ newTransaction: { readOnly: {} } }));
    });
    (0, mocha_1.it)('supports get read-only transactions with read time', () => {
        return runTransaction({
            readOnly: true,
            readTime: src_1.Timestamp.fromMillis(1),
        }, (transaction, docRef) => transaction.get(docRef), getDocument({ readTime: src_1.Timestamp.fromMillis(1) }));
    });
    (0, mocha_1.it)('support query read-only transactions with read time', () => {
        return runTransaction({
            readOnly: true,
            readTime: src_1.Timestamp.fromMillis(2),
        }, (transaction, docRef) => {
            const query = docRef.parent.where('foo', '==', 'bar');
            return transaction.get(query).then(results => {
                (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
            });
        }, query({ readTime: src_1.Timestamp.fromMillis(2) }));
    });
    (0, mocha_1.it)('support getAll', () => {
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            const firstDoc = docRef.parent.doc('firstDocument');
            const secondDoc = docRef.parent.doc('secondDocument');
            return transaction.getAll(firstDoc, secondDoc).then(docs => {
                (0, chai_1.expect)(docs.length).to.equal(2);
                (0, chai_1.expect)(docs[0].id).to.equal('firstDocument');
                (0, chai_1.expect)(docs[1].id).to.equal('secondDocument');
            });
        }, getAll(['firstDocument', 'secondDocument'], {
            newTransaction: { readWrite: {} },
        }), commit('foo1'));
    });
    (0, mocha_1.it)('support getAll with field mask', () => {
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            const doc = docRef.parent.doc('doc');
            return transaction.getAll(doc, {
                fieldMask: ['a.b', new src_1.FieldPath('a.b')],
            });
        }, getAll(['doc'], {
            newTransaction: { readWrite: {} },
            fieldMask: ['a.b', '`a.b`'],
        }), commit('foo1'));
    });
    (0, mocha_1.it)('enforce that getAll come before writes', () => {
        return (0, chai_1.expect)(runTransaction(/* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.set(docRef, { foo: 'bar' });
            return transaction.getAll(docRef);
        })).to.eventually.be.rejectedWith('Firestore transactions require all reads to be executed before all writes.');
    });
    (0, mocha_1.it)('subsequent reads use transaction ID from initial read for read-write transaction', () => {
        return runTransaction(
        /* transactionOptions= */ {}, async (transaction, docRef) => {
            const firstDoc = docRef.parent.doc('firstDocument');
            const secondDoc = docRef.parent.doc('secondDocument');
            const query = docRef.parent.where('foo', '==', 'bar');
            // Reads in parallel
            await Promise.all([
                transaction.get(firstDoc).then(doc => {
                    (0, chai_1.expect)(doc.id).to.equal('firstDocument');
                }),
                transaction.get(secondDoc).then(doc => {
                    (0, chai_1.expect)(doc.id).to.equal('secondDocument');
                }),
                transaction.get(query).then(results => {
                    (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
                }),
            ]);
            // Sequential reads
            const thirdDoc = docRef.parent.doc('thirdDocument');
            const doc = await transaction.get(thirdDoc);
            (0, chai_1.expect)(doc.id).to.equal('thirdDocument');
            await transaction.get(query).then(results => {
                (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
            });
        }, getDocument({ newTransaction: { readWrite: {} }, document: 'firstDocument' }), getDocument({ transactionId: 'foo1', document: 'secondDocument' }), query({ transactionId: 'foo1' }), getDocument({ transactionId: 'foo1', document: 'thirdDocument' }), query({ transactionId: 'foo1' }), commit('foo1'));
    });
    (0, mocha_1.it)('subsequent reads use transaction ID from initial read for read-only transaction', () => {
        return runTransaction(
        /* transactionOptions= */ { readOnly: true }, async (transaction, docRef) => {
            const firstDoc = docRef.parent.doc('firstDocument');
            const secondDoc = docRef.parent.doc('secondDocument');
            const query = docRef.parent.where('foo', '==', 'bar');
            // Reads in parallel
            await Promise.all([
                transaction.get(firstDoc).then(doc => {
                    (0, chai_1.expect)(doc.id).to.equal('firstDocument');
                }),
                transaction.get(secondDoc).then(doc => {
                    (0, chai_1.expect)(doc.id).to.equal('secondDocument');
                }),
                transaction.get(query).then(results => {
                    (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
                }),
            ]);
            // Sequential reads
            const thirdDoc = docRef.parent.doc('thirdDocument');
            const doc = await transaction.get(thirdDoc);
            (0, chai_1.expect)(doc.id).to.equal('thirdDocument');
            await transaction.get(query).then(results => {
                (0, chai_1.expect)(results.docs[0].id).to.equal('documentId');
            });
        }, getDocument({ newTransaction: { readOnly: {} }, document: 'firstDocument' }), getDocument({ transactionId: 'foo1', document: 'secondDocument' }), query({ transactionId: 'foo1' }), getDocument({ transactionId: 'foo1', document: 'thirdDocument' }), query({ transactionId: 'foo1' }));
    });
    (0, mocha_1.it)('support create', () => {
        const create = {
            currentDocument: {
                exists: false,
            },
            update: {
                fields: {},
                name: DOCUMENT_NAME,
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.create(docRef, {});
            return Promise.resolve();
        }, commit(undefined, [create]));
    });
    (0, mocha_1.it)('support update', () => {
        const update = {
            currentDocument: {
                exists: true,
            },
            update: {
                fields: {
                    a: {
                        mapValue: {
                            fields: {
                                b: {
                                    stringValue: 'c',
                                },
                            },
                        },
                    },
                },
                name: DOCUMENT_NAME,
            },
            updateMask: {
                fieldPaths: ['a.b'],
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.update(docRef, { 'a.b': 'c' });
            transaction.update(docRef, 'a.b', 'c');
            transaction.update(docRef, new Firestore.FieldPath('a', 'b'), 'c');
            return Promise.resolve();
        }, commit(undefined, [update, update, update]));
    });
    (0, mocha_1.it)('support set', () => {
        const set = {
            update: {
                fields: {
                    'a.b': {
                        stringValue: 'c',
                    },
                },
                name: DOCUMENT_NAME,
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.set(docRef, { 'a.b': 'c' });
            return Promise.resolve();
        }, commit(undefined, [set]));
    });
    (0, mocha_1.it)('support set with merge', () => {
        const set = {
            update: {
                fields: {
                    'a.b': {
                        stringValue: 'c',
                    },
                },
                name: DOCUMENT_NAME,
            },
            updateMask: {
                fieldPaths: ['`a.b`'],
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.set(docRef, { 'a.b': 'c' }, { merge: true });
            return Promise.resolve();
        }, commit(undefined, [set]));
    });
    (0, mocha_1.it)('support set with partials and merge', () => {
        const set = {
            update: {
                fields: {
                    title: {
                        stringValue: 'story',
                    },
                },
                name: DOCUMENT_NAME,
            },
            updateMask: {
                fieldPaths: ['title'],
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            const postRef = docRef.withConverter(helpers_1.postConverterMerge);
            transaction.set(postRef, { title: 'story' }, {
                merge: true,
            });
            return Promise.resolve();
        }, commit(undefined, [set]));
    });
    (0, mocha_1.it)('support set with partials and mergeFields', () => {
        const set = {
            update: {
                fields: {
                    title: {
                        stringValue: 'story',
                    },
                },
                name: DOCUMENT_NAME,
            },
            updateMask: {
                fieldPaths: ['title'],
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            const postRef = docRef.withConverter(helpers_1.postConverter);
            transaction.set(postRef, { title: 'story', author: 'person' }, {
                mergeFields: ['title'],
            });
            return Promise.resolve();
        }, commit(undefined, [set]));
    });
    (0, mocha_1.it)('support delete', () => {
        const remove = {
            delete: DOCUMENT_NAME,
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.delete(docRef);
            return Promise.resolve();
        }, commit(undefined, [remove]));
    });
    (0, mocha_1.it)('support multiple writes', () => {
        const remove = {
            delete: DOCUMENT_NAME,
        };
        const set = {
            update: {
                fields: {},
                name: DOCUMENT_NAME,
            },
        };
        return runTransaction(
        /* transactionOptions= */ {}, (transaction, docRef) => {
            transaction.delete(docRef).set(docRef, {});
            return Promise.resolve();
        }, commit(undefined, [remove, set]));
    });
});
//# sourceMappingURL=transaction.js.map
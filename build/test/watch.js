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
const duplexify = require("duplexify");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const extend = require("extend");
const google_gax_1 = require("google-gax");
const through2 = require("through2");
const src_1 = require("../src");
const backoff_1 = require("../src/backoff");
const document_1 = require("../src/document");
const serializer_1 = require("../src/serializer");
const watch_1 = require("../src/watch");
const helpers_1 = require("./util/helpers");
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
let PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
    PROJECT_ID = 'test-project';
}
/**
 * Asserts that the given list of docs match.
 * @param actual The computed docs array.
 * @param expected The expected docs array.
 */
function docsEqual(actual, expected) {
    (0, chai_1.expect)(actual.length).to.equal(expected.length);
    for (let i = 0; i < actual.length; i++) {
        (0, chai_1.expect)(actual[i].ref.id).to.equal(expected[i].ref.id);
        (0, chai_1.expect)(actual[i].data()).to.deep.eq(expected[i].data());
        (0, chai_1.expect)(expected[i].createTime).to.be.an.instanceOf(src_1.Timestamp);
        (0, chai_1.expect)(expected[i].updateTime).to.be.an.instanceOf(src_1.Timestamp);
    }
}
/**
 * Asserts that the given query snapshot matches the expected results.
 * @param lastSnapshot The previous snapshot that this snapshot is based upon.
 * @param version The current snapshot version to use for the comparison.
 * @param actual A QuerySnapshot with results.
 * @param expected Array of DocumentSnapshot.
 */
function snapshotsEqual(lastSnapshot, version, actual, expected) {
    const localDocs = [].concat(lastSnapshot.docs);
    (0, chai_1.expect)(actual).to.be.an.instanceof(src_1.QuerySnapshot);
    const actualSnapshot = actual;
    const actualDocChanges = actualSnapshot.docChanges();
    (0, chai_1.expect)(actualDocChanges.length).to.equal(expected.docChanges.length);
    for (let i = 0; i < expected.docChanges.length; i++) {
        (0, chai_1.expect)(actualDocChanges[i].type).to.equal(expected.docChanges[i].type);
        (0, chai_1.expect)(actualDocChanges[i].doc.ref.id).to.equal(expected.docChanges[i].doc.ref.id);
        (0, chai_1.expect)(actualDocChanges[i].doc.data()).to.deep.eq(expected.docChanges[i].doc.data());
        const readVersion = actualDocChanges[i].type === 'removed' ? version - 1 : version;
        (0, chai_1.expect)(actualDocChanges[i].doc.readTime.isEqual(new src_1.Timestamp(0, readVersion))).to.be.true;
        if (actualDocChanges[i].oldIndex !== -1) {
            localDocs.splice(actualDocChanges[i].oldIndex, 1);
        }
        if (actualDocChanges[i].newIndex !== -1) {
            localDocs.splice(actualDocChanges[i].newIndex, 0, actualDocChanges[i].doc);
        }
    }
    docsEqual(actualSnapshot.docs, expected.docs);
    docsEqual(localDocs, expected.docs);
    (0, chai_1.expect)(actualSnapshot.readTime.isEqual(new src_1.Timestamp(0, version))).to.be.true;
    (0, chai_1.expect)(actualSnapshot.size).to.equal(expected.docs.length);
    return { docs: actualSnapshot.docs, docChanges: actualDocChanges };
}
/*
 * Helper for constructing a snapshot.
 */
function snapshot(ref, data) {
    const snapshot = new document_1.DocumentSnapshotBuilder(ref);
    snapshot.fieldsProto = ref.firestore._serializer.encodeFields(data);
    snapshot.readTime = new src_1.Timestamp(0, 0);
    snapshot.createTime = new src_1.Timestamp(0, 0);
    snapshot.updateTime = new src_1.Timestamp(0, 0);
    return snapshot.build();
}
/*
 * Helpers for constructing document changes.
 */
function docChange(type, ref, data) {
    return { type, doc: snapshot(ref, data) };
}
const added = (ref, data) => docChange('added', ref, data);
const modified = (ref, data) => docChange('modified', ref, data);
const removed = (ref, data) => docChange('removed', ref, data);
function verifyRequest(actual, expected) {
    // Remove undefined value, as these are ignored by the backend.
    actual = extend(true, {}, actual);
    (0, chai_1.expect)(actual).to.deep.equal(expected);
}
const EMPTY = {
    docs: [],
    docChanges: [],
};
/** Captures stream data and makes it available via deferred Promises. */
class DeferredListener {
    constructor() {
        this.pendingData = [];
        this.pendingListeners = [];
    }
    /**
     * Makes stream data available via the Promises set in the 'await' call. If no
     * Promise has been set, the data will be cached.
     */
    on(type, data) {
        const listener = this.pendingListeners.shift();
        if (listener) {
            (0, chai_1.expect)(type).to.equal(listener.type, `Expected message of type '${listener.type}' but got '${type}' ` +
                `with '${JSON.stringify(data)}'.`);
            listener.resolve(data);
        }
        else {
            this.pendingData.push({
                type,
                data,
            });
        }
    }
    /**
     * Returns a Promise with the next result from the underlying stream. The
     * Promise resolves immediately if pending data is available, otherwise it
     * resolves when the next chunk arrives.
     */
    await(expectedType) {
        const data = this.pendingData.shift();
        if (data) {
            (0, chai_1.expect)(data.type).to.equal(expectedType, `Expected message of type '${expectedType}' but got '${data.type}' ` +
                `with '${JSON.stringify(data.data)}'.`);
            return Promise.resolve(data.data);
        }
        return new Promise(resolve => this.pendingListeners.push({
            type: expectedType,
            resolve,
        }));
    }
}
/**
 * Handles stream operations for the Firestore Listen API. StreamHelper
 * supports one stream at a time, but multiple streams can be processed through
 * sequential invocations of the Listen API.
 */
class StreamHelper {
    constructor() {
        this.deferredListener = new DeferredListener();
        this.backendStream = null;
        this.streamCount = 0; // The number of streams that the client has requested
        this.readStream = null;
        this.writeStream = null;
    }
    /** Returns the GAPIC callback to use with this stream helper. */
    getListenCallback() {
        return () => {
            // Create a mock backend whose stream we can return.
            ++this.streamCount;
            this.readStream = through2.obj();
            this.writeStream = through2.obj();
            this.readStream.once('data', result => this.deferredListener.on('data', result));
            this.readStream.on('error', error => this.deferredListener.on('error', error));
            this.readStream.on('end', () => this.deferredListener.on('end'));
            this.readStream.on('close', () => this.deferredListener.on('close'));
            this.deferredListener.on('open', {});
            this.backendStream = duplexify.obj(this.readStream, this.writeStream);
            return this.backendStream;
        };
    }
    /**
     * Returns a Promise with the next results from the underlying stream.
     */
    await(type) {
        return this.deferredListener.await(type);
    }
    /** Waits for a destroyed stream to be re-opened. */
    awaitReopen() {
        return this.await('error')
            .then(() => this.await('close'))
            .then(() => this.awaitOpen());
    }
    /**
     * Waits for the stream to open and to receive its first message (the
     * AddTarget message).
     */
    awaitOpen() {
        return this.await('open').then(() => {
            return this.await('data');
        });
    }
    /**
     * Sends a message to the currently active stream.
     */
    write(data) {
        // The stream returned by the Gapic library accepts Protobuf
        // messages, but the type information does not expose this.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.writeStream.write(data);
    }
    /**
     * Closes the currently active stream.
     */
    close() {
        this.backendStream.emit('end');
    }
    /**
     * Destroys the currently active stream with the optionally provided error.
     * If omitted, the stream is closed with a GRPC Status of UNAVAILABLE.
     */
    destroyStream(err) {
        if (!err) {
            err = new google_gax_1.GoogleError('Server disconnect');
            err.code = google_gax_1.Status.UNAVAILABLE;
        }
        this.readStream.destroy(err);
    }
}
/**
 * Encapsulates the stream logic for the Watch API.
 */
class WatchHelper {
    /**
     * @param streamHelper The StreamHelper base class for this Watch operation.
     * @param reference The CollectionReference or DocumentReference that is being
     * watched.
     * @param targetId The target ID of the watch stream.
     */
    constructor(streamHelper, reference, targetId) {
        this.reference = reference;
        this.targetId = targetId;
        this.deferredListener = new DeferredListener();
        this.unsubscribe = null;
        this.snapshotVersion = 0;
        this.serializer = new serializer_1.Serializer(reference.firestore);
        this.streamHelper = streamHelper;
        this.snapshotVersion = 0;
        this.deferredListener = new DeferredListener();
    }
    await(type) {
        return this.deferredListener.await(type);
    }
    /**
     * Creates a watch, starts a listen, and asserts that the request got
     * processed.
     *
     * @return The unsubscribe handler for the listener.
     */
    startWatch() {
        this.unsubscribe = this.reference.onSnapshot((snapshot) => {
            this.deferredListener.on('snapshot', snapshot);
        }, (error) => {
            this.deferredListener.on('error', error);
        });
        return this.unsubscribe;
    }
    /**
     * Ends the listen stream.
     *
     * @return A Promise that will be fulfilled when the backend saw the end.
     */
    async endWatch() {
        this.unsubscribe();
        await this.streamHelper.await('end');
    }
    /**
     * Sends a target change from the backend simulating adding the query target.
     *
     * @param targetId The target ID to send. If omitted, uses the
     * default target ID.
     */
    sendAddTarget(targetId) {
        this.streamHelper.write({
            targetChange: {
                targetChangeType: 'ADD',
                targetIds: [targetId !== undefined ? targetId : this.targetId],
            },
        });
    }
    /**
     * Sends a target change from the backend simulating removing a query target.
     *
     * @param cause The optional code indicating why the target was removed.
     */
    sendRemoveTarget(cause) {
        const proto = {
            targetChange: {
                targetChangeType: 'REMOVE',
                targetIds: [this.targetId],
            },
        };
        if (cause) {
            proto.targetChange.cause = {
                code: cause,
                message: 'test remove',
            };
        }
        this.streamHelper.write(proto);
    }
    /**
     * Sends a target change from the backend of type 'NO_CHANGE'. If specified,
     * includes a resume token.
     */
    sendSnapshot(version, resumeToken) {
        this.snapshotVersion = version;
        const proto = {
            targetChange: {
                targetChangeType: 'NO_CHANGE',
                targetIds: [],
                readTime: { seconds: 0, nanos: version },
            },
        };
        if (resumeToken) {
            proto.targetChange.resumeToken = resumeToken;
        }
        this.streamHelper.write(proto);
    }
    /**
     * Sends a target change from the backend of type 'CURRENT'.
     */
    sendCurrent(resumeToken) {
        const proto = {
            targetChange: {
                targetChangeType: 'CURRENT',
                targetIds: [this.targetId],
            },
        };
        if (resumeToken) {
            proto.targetChange.resumeToken = resumeToken;
        }
        this.streamHelper.write(proto);
    }
    /**
     * Sends a doc change from the backend to the client.
     *
     * @param ref The document reference.
     * @param data The data for the doc in proto JSON format.
     */
    sendDoc(ref, data) {
        this.streamHelper.write({
            documentChange: {
                document: {
                    name: ref.formattedName,
                    fields: this.serializer.encodeFields(data),
                    createTime: { seconds: 1, nanos: 2 },
                    updateTime: { seconds: 3, nanos: this.snapshotVersion },
                },
                targetIds: [this.targetId],
            },
        });
    }
    /**
     * Sends a doc removal from the backend to the client.
     *
     * @param ref The document reference.
     * @param data The data for the doc in proto JSON format.
     */
    sendDocRemove(ref, data) {
        this.streamHelper.write({
            documentChange: {
                document: {
                    name: ref.formattedName,
                    fields: this.serializer.encodeFields(data),
                },
                removedTargetIds: [this.targetId],
            },
        });
    }
    /**
     * Sends a doc delete from the backend to the client.
     *
     * @param ref The document reference.
     */
    sendDocDelete(ref) {
        this.streamHelper.write({
            documentDelete: {
                document: ref.formattedName,
                removedTargetIds: [this.targetId],
            },
        });
    }
    /**
     * A wrapper for writing tests that successfully run a watch.
     */
    runTest(expectedRequest, func) {
        this.startWatch();
        return this.streamHelper
            .awaitOpen()
            .then(request => {
            verifyRequest(request, expectedRequest);
            return func();
        })
            .then(() => this.endWatch());
    }
    /**
     * A wrapper for writing tests that fail to run a watch.
     */
    runFailedTest(expectedRequest, func, expectedError) {
        this.startWatch();
        return this.streamHelper
            .awaitOpen()
            .then(request => {
            verifyRequest(request, expectedRequest);
            return func();
        })
            .then(() => {
            return this.await('error');
        })
            .then(err => {
            if (!(err instanceof Error)) {
                throw new Error('Expected error from Watch');
            }
            (0, chai_1.expect)(err.message).to.equal(expectedError);
        });
    }
}
(0, mocha_1.describe)('Query watch', () => {
    // The collection to query.
    let colRef;
    // The documents used in this query.
    let doc1;
    let doc2;
    let doc3;
    let doc4;
    let firestore;
    let targetId;
    let watchHelper;
    let streamHelper;
    let lastSnapshot = EMPTY;
    // The proto JSON that should be sent for the query.
    const collQueryJSON = () => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                query: {
                    parent: `projects/${PROJECT_ID}/databases/(default)/documents`,
                    structuredQuery: {
                        from: [{ collectionId: 'col' }],
                    },
                },
                targetId,
            },
        };
    };
    const includeQuery = () => {
        return colRef.where('included', '==', 'yes');
    };
    // The proto JSON that should be sent for the query.
    const includeQueryJSON = () => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                query: {
                    parent: `projects/${PROJECT_ID}/databases/(default)/documents`,
                    structuredQuery: {
                        from: [{ collectionId: 'col' }],
                        where: {
                            fieldFilter: {
                                field: {
                                    fieldPath: 'included',
                                },
                                op: 'EQUAL',
                                value: {
                                    stringValue: 'yes',
                                },
                            },
                        },
                    },
                },
                targetId,
            },
        };
    };
    // The proto JSON that should be sent for a resumed query.
    const resumeTokenQuery = (resumeToken) => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                query: {
                    parent: `projects/${PROJECT_ID}/databases/(default)/documents`,
                    structuredQuery: {
                        from: [{ collectionId: 'col' }],
                    },
                },
                targetId,
                resumeToken,
            },
        };
    };
    const sortedQuery = () => {
        return colRef.orderBy('foo', 'desc');
    };
    // The proto JSON that should be sent for the query.
    const sortedQueryJSON = () => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                query: {
                    parent: `projects/${PROJECT_ID}/databases/(default)/documents`,
                    structuredQuery: {
                        from: [{ collectionId: 'col' }],
                        orderBy: [{ direction: 'DESCENDING', field: { fieldPath: 'foo' } }],
                    },
                },
                targetId,
            },
        };
    };
    /** The GAPIC callback that executes the listen. */
    let listenCallback;
    (0, mocha_1.beforeEach)(() => {
        // We are intentionally skipping the delays to ensure fast test execution.
        // The retry semantics are unaffected by this, as we maintain their
        // asynchronous behavior.
        (0, backoff_1.setTimeoutHandler)((op, timeout) => {
            if (timeout !== watch_1.WATCH_IDLE_TIMEOUT_MS) {
                setImmediate(op);
            }
        });
        targetId = 0x1;
        streamHelper = new StreamHelper();
        listenCallback = streamHelper.getListenCallback();
        return (0, helpers_1.createInstance)({ listen: () => listenCallback() }).then(firestoreClient => {
            firestore = firestoreClient;
            watchHelper = new WatchHelper(streamHelper, firestore.collection('col'), targetId);
            colRef = firestore.collection('col');
            doc1 = firestore.doc('col/doc1');
            doc2 = firestore.doc('col/doc2');
            doc3 = firestore.doc('col/doc3');
            doc4 = firestore.doc('col/doc4');
            lastSnapshot = EMPTY;
        });
    });
    (0, mocha_1.afterEach)(() => {
        (0, backoff_1.setTimeoutHandler)(setTimeout);
        return (0, helpers_1.verifyInstance)(firestore);
    });
    (0, mocha_1.it)('with invalid callbacks', () => {
        (0, chai_1.expect)(() => colRef.onSnapshot('foo')).to.throw('Value for argument "onNext" is not a valid function.');
        (0, chai_1.expect)(() => colRef.onSnapshot(() => { }, 'foo')).to.throw('Value for argument "onError" is not a valid function.');
    });
    (0, mocha_1.it)('without error callback', done => {
        const unsubscribe = colRef.onSnapshot(() => {
            unsubscribe();
            done();
        });
        streamHelper.awaitOpen().then(() => {
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
        });
    });
    (0, mocha_1.it)('handles invalid listen protos', () => {
        return watchHelper.runFailedTest(collQueryJSON(), () => {
            // Mock the server responding to the query with an invalid proto.
            streamHelper.write({ invalid: true });
        }, 'Unknown listen response type: {"invalid":true}');
    });
    (0, mocha_1.it)('handles invalid target change protos', () => {
        return watchHelper.runFailedTest(collQueryJSON(), () => {
            // Mock the server responding to the query with an invalid proto.
            streamHelper.write({
                targetChange: {
                    targetChangeType: 'INVALID',
                    targetIds: [0xfeed],
                },
            });
        }, 'Unknown target change type: {"targetChangeType":"INVALID",' +
            '"targetIds":[65261]}');
    });
    (0, mocha_1.it)('handles remove target change protos', () => {
        return watchHelper.runFailedTest(collQueryJSON(), () => {
            watchHelper.sendRemoveTarget();
        }, 'Error 13: internal error');
    });
    (0, mocha_1.it)('handles remove target change with code', () => {
        return watchHelper.runFailedTest(collQueryJSON(), () => {
            watchHelper.sendRemoveTarget(7);
        }, 'Error 7: test remove');
    });
    (0, mocha_1.it)('rejects an unknown target', () => {
        return watchHelper.runFailedTest(collQueryJSON(), () => {
            watchHelper.sendAddTarget(2);
        }, 'Unexpected target ID sent by server');
    });
    (0, mocha_1.it)('re-opens on unexpected stream end', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1, Buffer.from([0xabcd]));
            return watchHelper.await('snapshot').then(async () => {
                streamHelper.close();
                await streamHelper.await('end');
                await streamHelper.awaitOpen();
                streamHelper.close();
                await streamHelper.await('end');
                await streamHelper.awaitOpen();
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(3);
            });
        });
    });
    (0, mocha_1.it)('stops attempts after maximum retry attempts', () => {
        const err = new google_gax_1.GoogleError('GRPC Error');
        err.code = google_gax_1.Status.ABORTED;
        return watchHelper.runFailedTest(collQueryJSON(), async () => {
            // Retry for the maximum of retry attempts.
            for (let i = 0; i < backoff_1.MAX_RETRY_ATTEMPTS; i++) {
                streamHelper.destroyStream(err);
                await streamHelper.awaitReopen();
            }
            // The next retry should fail with an error.
            streamHelper.destroyStream(err);
            await streamHelper.await('error');
            await streamHelper.await('close');
        }, 'Exceeded maximum number of retries allowed.');
    });
    (0, mocha_1.it)("doesn't re-open inactive stream", () => {
        // This test uses the normal timeout handler since it relies on the actual
        // backoff window during the the stream recovery. We then use this window to
        // unsubscribe from the Watch stream and make sure that we don't
        // re-open the stream once the backoff expires.
        (0, backoff_1.setTimeoutHandler)(setTimeout);
        const unsubscribe = watchHelper.startWatch();
        return streamHelper
            .awaitOpen()
            .then(request => {
            verifyRequest(request, collQueryJSON());
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1, Buffer.from([0xabcd]));
            return watchHelper.await('snapshot');
        })
            .then(() => {
            streamHelper.close();
            unsubscribe();
            (0, chai_1.expect)(streamHelper.streamCount).to.equal(1);
        });
    });
    (0, mocha_1.it)('retries based on error code', async () => {
        const testCases = new Map();
        testCases.set(google_gax_1.Status.CANCELLED, true);
        testCases.set(google_gax_1.Status.UNKNOWN, true);
        testCases.set(google_gax_1.Status.INVALID_ARGUMENT, false);
        testCases.set(google_gax_1.Status.DEADLINE_EXCEEDED, true);
        testCases.set(google_gax_1.Status.NOT_FOUND, false);
        testCases.set(google_gax_1.Status.ALREADY_EXISTS, false);
        testCases.set(google_gax_1.Status.PERMISSION_DENIED, false);
        testCases.set(google_gax_1.Status.RESOURCE_EXHAUSTED, true);
        testCases.set(google_gax_1.Status.FAILED_PRECONDITION, false);
        testCases.set(google_gax_1.Status.ABORTED, true);
        testCases.set(google_gax_1.Status.OUT_OF_RANGE, false);
        testCases.set(google_gax_1.Status.UNIMPLEMENTED, false);
        testCases.set(google_gax_1.Status.INTERNAL, true);
        testCases.set(google_gax_1.Status.UNAVAILABLE, true);
        testCases.set(google_gax_1.Status.DATA_LOSS, false);
        testCases.set(google_gax_1.Status.UNAUTHENTICATED, true);
        for (const [statusCode, expectRetry] of testCases) {
            const err = new google_gax_1.GoogleError('GRPC Error');
            err.code = statusCode;
            if (expectRetry) {
                await watchHelper.runTest(collQueryJSON(), () => {
                    watchHelper.sendAddTarget();
                    watchHelper.sendCurrent();
                    watchHelper.sendSnapshot(1, Buffer.from([0xabcd]));
                    return watchHelper.await('snapshot').then(() => {
                        streamHelper.destroyStream(err);
                        return streamHelper.awaitReopen();
                    });
                });
            }
            else {
                await watchHelper.runFailedTest(collQueryJSON(), () => {
                    watchHelper.sendAddTarget();
                    watchHelper.sendCurrent();
                    watchHelper.sendSnapshot(1, Buffer.from([0xabcd]));
                    return watchHelper
                        .await('snapshot')
                        .then(() => {
                        streamHelper.destroyStream(err);
                    })
                        .then(() => {
                        return streamHelper.await('error');
                    })
                        .then(() => {
                        return streamHelper.await('close');
                    });
                }, 'GRPC Error');
            }
        }
    }).timeout(5000);
    (0, mocha_1.it)('retries with unknown code', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1, Buffer.from([0xabcd]));
            return watchHelper.await('snapshot').then(() => {
                streamHelper.destroyStream(new Error('Unknown'));
                return streamHelper.awaitReopen();
            });
        });
    });
    (0, mocha_1.it)('handles changing a doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Add another result.
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
                // Change a result.
                watchHelper.sendDoc(doc2, { bar: 'c' });
                watchHelper.sendSnapshot(4);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 4, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { bar: 'c' })],
                    docChanges: [modified(doc2, { bar: 'c' })],
                });
            });
        });
    });
    (0, mocha_1.it)('reconnects after error', () => {
        let resumeToken = Buffer.from([0xabcd]);
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent(resumeToken);
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2, resumeToken);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(1);
                streamHelper.destroyStream();
                return streamHelper.awaitReopen();
            })
                .then(request => {
                verifyRequest(request, resumeTokenQuery(resumeToken));
                watchHelper.sendAddTarget();
                watchHelper.sendDoc(doc2, { foo: 'b' });
                resumeToken = Buffer.from([0xbcde]);
                watchHelper.sendSnapshot(3, resumeToken);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
                streamHelper.destroyStream();
                return streamHelper.awaitReopen();
            })
                .then(request => {
                verifyRequest(request, resumeTokenQuery(resumeToken));
                watchHelper.sendAddTarget();
                watchHelper.sendDoc(doc3, { foo: 'c' });
                watchHelper.sendSnapshot(4, resumeToken);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(3);
                snapshotsEqual(lastSnapshot, 4, results, {
                    docs: [
                        snapshot(doc1, { foo: 'a' }),
                        snapshot(doc2, { foo: 'b' }),
                        snapshot(doc3, { foo: 'c' }),
                    ],
                    docChanges: [added(doc3, { foo: 'c' })],
                });
            });
        });
    });
    (0, mocha_1.it)('ignores changes sent after the last snapshot', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent(Buffer.from([0x0]));
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(2, Buffer.from([0x1]));
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc1, { foo: 'a' }), added(doc2, { foo: 'b' })],
                });
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(1);
                // This document delete will be ignored.
                watchHelper.sendDocDelete(doc1);
                streamHelper.destroyStream();
                return streamHelper.awaitReopen();
            })
                .then(() => {
                watchHelper.sendDocDelete(doc2);
                watchHelper.sendSnapshot(3, Buffer.from([0x2]));
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [removed(doc2, { foo: 'b' })],
                });
            });
        });
    });
    (0, mocha_1.it)('ignores non-matching tokens', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            let resumeToken = Buffer.from([0x1]);
            watchHelper.sendSnapshot(1, resumeToken);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                // Send snapshot with non-matching target id. No snapshot will be
                // send.
                streamHelper.write({
                    targetChange: {
                        targetChangeType: 'NO_CHANGE',
                        targetIds: [0xfeed],
                        readTime: { seconds: 0, nanos: 0 },
                        resumeToken: Buffer.from([0x2]),
                    },
                });
                resumeToken = Buffer.from([0x3]);
                // Send snapshot with matching target id but no resume token.
                // The old token continues to be used.
                streamHelper.write({
                    targetChange: {
                        targetChangeType: 'NO_CHANGE',
                        targetIds: [],
                        readTime: { seconds: 0, nanos: 0 },
                        resumeToken,
                    },
                });
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 0, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                streamHelper.destroyStream();
                return streamHelper.awaitReopen();
            })
                .then(request => {
                verifyRequest(request, resumeTokenQuery(resumeToken));
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(2);
            });
        });
    });
    (0, mocha_1.it)('reconnects with multiple attempts', () => {
        return watchHelper
            .runFailedTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            const resumeToken = Buffer.from([0xabcd]);
            watchHelper.sendSnapshot(1, resumeToken);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                listenCallback = () => {
                    // Return a stream that always errors on write
                    ++streamHelper.streamCount;
                    return through2.obj((chunk, enc, callback) => {
                        callback(new Error(`Stream Error (${streamHelper.streamCount})`));
                    });
                };
                streamHelper.destroyStream();
                return streamHelper.await('error');
            })
                .then(() => {
                return streamHelper.await('close');
            })
                .then(() => {
                streamHelper.writeStream.destroy();
            });
        }, 'Stream Error (6)')
            .then(() => {
            (0, chai_1.expect)(streamHelper.streamCount).to.equal(6, 'Expected stream to be opened once and retried five times');
        });
    });
    (0, mocha_1.it)('sorts docs', () => {
        watchHelper = new WatchHelper(streamHelper, sortedQuery(), targetId);
        return watchHelper.runTest(sortedQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add two result.
                watchHelper.sendDoc(doc1, { foo: 'b' });
                watchHelper.sendDoc(doc2, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'b' }), snapshot(doc2, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'b' }), added(doc2, { foo: 'a' })],
                });
                // Change the results so they sort in a different order.
                watchHelper.sendDoc(doc1, { foo: 'c' });
                watchHelper.sendDoc(doc2, { foo: 'd' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc2, { foo: 'd' }), snapshot(doc1, { foo: 'c' })],
                    docChanges: [
                        modified(doc2, { foo: 'd' }),
                        modified(doc1, { foo: 'c' }),
                    ],
                });
            });
        });
    });
    (0, mocha_1.it)('combines multiple change events for the same doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            // Add a result.
            watchHelper.sendDoc(doc1, { foo: 'a' });
            // Modify it.
            watchHelper.sendDoc(doc1, { foo: 'b' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [snapshot(doc1, { foo: 'b' })],
                    docChanges: [added(doc1, { foo: 'b' })],
                });
                // Modify it two more times.
                watchHelper.sendDoc(doc1, { foo: 'c' });
                watchHelper.sendDoc(doc1, { foo: 'd' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'd' })],
                    docChanges: [modified(doc1, { foo: 'd' })],
                });
                // Remove it, delete it, and then add it again.
                watchHelper.sendDocRemove(doc1, { foo: 'e' });
                watchHelper.sendDocDelete(doc1);
                watchHelper.sendDoc(doc1, { foo: 'f' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'f' })],
                    docChanges: [modified(doc1, { foo: 'f' })],
                });
            });
        });
    });
    (0, mocha_1.it)('can sort by FieldPath.documentId()', () => {
        let query = sortedQuery();
        const expectedJson = sortedQueryJSON();
        // Add FieldPath.documentId() sorting
        query = query.orderBy(src_1.FieldPath.documentId(), 'desc');
        expectedJson.addTarget.query.structuredQuery.orderBy.push({
            direction: 'DESCENDING',
            field: { fieldPath: '__name__' },
        });
        watchHelper = new WatchHelper(streamHelper, query, targetId);
        return watchHelper.runTest(expectedJson, () => {
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(() => {
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc2, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc2, { foo: 'a' }), snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc2, { foo: 'a' }), added(doc1, { foo: 'a' })],
                });
            });
        });
    });
    (0, mocha_1.it)('sorts document changes in the right order', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendDoc(doc1, { foo: 'a' });
            watchHelper.sendDoc(doc2, { foo: 'a' });
            watchHelper.sendDoc(doc4, { foo: 'a' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [
                        snapshot(doc1, { foo: 'a' }),
                        snapshot(doc2, { foo: 'a' }),
                        snapshot(doc4, { foo: 'a' }),
                    ],
                    docChanges: [
                        added(doc1, { foo: 'a' }),
                        added(doc2, { foo: 'a' }),
                        added(doc4, { foo: 'a' }),
                    ],
                });
                watchHelper.sendDocDelete(doc1);
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendDoc(doc3, { foo: 'b' });
                watchHelper.sendDocDelete(doc4);
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc2, { foo: 'b' }), snapshot(doc3, { foo: 'b' })],
                    docChanges: [
                        removed(doc1, { foo: 'a' }),
                        removed(doc4, { foo: 'a' }),
                        added(doc3, { foo: 'b' }),
                        modified(doc2, { foo: 'b' }),
                    ],
                });
            });
        });
    });
    (0, mocha_1.it)("handles changing a doc so it doesn't match", () => {
        watchHelper = new WatchHelper(streamHelper, includeQuery(), targetId);
        return watchHelper.runTest(includeQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { included: 'yes' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { included: 'yes' })],
                    docChanges: [added(doc1, { included: 'yes' })],
                });
                // Add another result.
                watchHelper.sendDoc(doc2, { included: 'yes' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [
                        snapshot(doc1, { included: 'yes' }),
                        snapshot(doc2, { included: 'yes' }),
                    ],
                    docChanges: [added(doc2, { included: 'yes' })],
                });
                // Change a result.
                watchHelper.sendDocRemove(doc2, { included: 'no' });
                watchHelper.sendSnapshot(4);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 4, results, {
                    docs: [snapshot(doc1, { included: 'yes' })],
                    docChanges: [removed(doc2, { included: 'yes' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles deleting a doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Add another result.
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
                // Delete a result.
                watchHelper.sendDocDelete(doc2);
                watchHelper.sendSnapshot(4);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 4, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [removed(doc2, { foo: 'b' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles removing a doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Add another result.
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
                // Delete a result.
                watchHelper.sendDocRemove(doc2, { foo: 'c' });
                watchHelper.sendSnapshot(4);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 4, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [removed(doc2, { foo: 'b' })],
                });
            });
        });
    });
    mocha_1.it.skip('handles deleting a non-existent doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Delete a different doc.
                watchHelper.sendDocDelete(doc2);
                watchHelper.sendSnapshot(3);
            });
        });
    });
    (0, mocha_1.it)('handles reset', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add three results.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendDoc(doc3, { foo: 'c' });
                // Send the snapshot. Note that we do not increment the snapshot
                // version to keep the update time the same.
                watchHelper.sendSnapshot(1);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [
                        snapshot(doc1, { foo: 'a' }),
                        snapshot(doc2, { foo: 'b' }),
                        snapshot(doc3, { foo: 'c' }),
                    ],
                    docChanges: [
                        added(doc1, { foo: 'a' }),
                        added(doc2, { foo: 'b' }),
                        added(doc3, { foo: 'c' }),
                    ],
                });
                // Send a RESET.
                streamHelper.write({
                    targetChange: {
                        targetChangeType: 'RESET',
                        targetIds: [],
                    },
                });
                // Send the same doc1, a modified doc2, no doc3, and a new doc4.
                // Send a different result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.snapshotVersion = 2;
                watchHelper.sendDoc(doc2, { foo: 'bb' });
                watchHelper.sendDoc(doc4, { foo: 'd' });
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [
                        snapshot(doc1, { foo: 'a' }),
                        snapshot(doc2, { foo: 'bb' }),
                        snapshot(doc4, { foo: 'd' }),
                    ],
                    docChanges: [
                        removed(doc3, { foo: 'c' }),
                        added(doc4, { foo: 'd' }),
                        modified(doc2, { foo: 'bb' }),
                    ],
                });
            });
        });
    });
    (0, mocha_1.it)('reset after idle timeout', async () => {
        let idleTimeout = () => { };
        (0, backoff_1.setTimeoutHandler)((op, timeout) => {
            if (timeout === watch_1.WATCH_IDLE_TIMEOUT_MS) {
                idleTimeout = op;
            }
            else {
                setTimeout(op, timeout);
            }
        });
        await watchHelper.runTest(collQueryJSON(), async () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendDoc(doc1, { foo: 'a' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1, /* resumeToken= */ Buffer.from([0xabcd]));
            let currentSnapshot = await watchHelper.await('snapshot');
            lastSnapshot = snapshotsEqual(lastSnapshot, 1, currentSnapshot, {
                docs: [snapshot(doc1, { foo: 'a' })],
                docChanges: [added(doc1, { foo: 'a' })],
            });
            // Invoke the idle timeout
            idleTimeout();
            await streamHelper.await('end');
            // Restart the stream and send one additional document
            await streamHelper.awaitOpen();
            watchHelper.sendAddTarget();
            watchHelper.snapshotVersion = 2;
            watchHelper.sendDoc(doc2, { foo: 'b' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(2);
            currentSnapshot = await watchHelper.await('snapshot');
            // The snapshot now includes both `doc1` and `doc2`.
            snapshotsEqual(lastSnapshot, 2, currentSnapshot, {
                docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                docChanges: [added(doc2, { foo: 'b' })],
            });
        });
    });
    (0, mocha_1.it)('handles reset with phantom doc', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Change the first doc.
                watchHelper.sendDoc(doc1, { foo: 'b' });
                // Send a doc change that should be ignored after reset.
                watchHelper.sendDoc(doc2, { foo: 'c' });
                // Send a RESET.
                streamHelper.write({
                    targetChange: {
                        targetChangeType: 'RESET',
                        targetIds: [],
                    },
                });
                // Change the first doc again.
                watchHelper.sendDoc(doc1, { foo: 'd' });
                // Take a snapshot.
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'd' })],
                    docChanges: [modified(doc1, { foo: 'd' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles sending the snapshot version multiple times', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                watchHelper.sendSnapshot(3);
                watchHelper.sendSnapshot(4);
                watchHelper.sendSnapshot(5);
                watchHelper.sendSnapshot(6);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles filter mismatch', () => {
        let oldRequestStream;
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Send a filter that doesn't match. Make sure the stream gets
                // reopened.
                oldRequestStream = streamHelper.writeStream;
                streamHelper.write({ filter: { count: 0 } });
                return streamHelper.await('end');
            })
                .then(() => streamHelper.awaitOpen())
                .then(request => {
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(2);
                (0, chai_1.expect)(oldRequestStream).to.not.equal(streamHelper.writeStream);
                verifyRequest(request, collQueryJSON());
                watchHelper.sendAddTarget();
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [],
                    docChanges: [removed(doc1, { foo: 'a' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles filter match', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            watchHelper.sendAddTarget();
            // Add a result.
            watchHelper.sendDoc(doc1, { foo: 'a' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Send the filter count for the previously added documents.
                streamHelper.write({ filter: { count: 1 } });
                // Even sending a new snapshot version should be a no-op.
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(2);
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(1);
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles resets with pending updates', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            watchHelper.sendAddTarget();
            // Add a result.
            watchHelper.sendDoc(doc1, { foo: 'a' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                watchHelper.sendDoc(doc1, { foo: 'b' });
                watchHelper.sendDoc(doc2, { foo: 'c' });
                watchHelper.sendDoc(doc3, { foo: 'd' });
                streamHelper.write({ filter: { count: 3 } });
                watchHelper.sendDoc(doc1, { foo: 'd' });
                watchHelper.sendDoc(doc2, { foo: 'e' });
                watchHelper.sendDocDelete(doc3);
                streamHelper.write({ filter: { count: 2 } });
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(1);
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'd' }), snapshot(doc2, { foo: 'e' })],
                    docChanges: [added(doc2, { foo: 'e' }), modified(doc1, { foo: 'd' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles add and delete in same snapshot', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDocDelete(doc1);
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles non-changing modify', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                // Send the snapshot. Note that we do not increment the snapshot
                // version to keep the update time the same.
                watchHelper.sendSnapshot(1);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc1, { foo: 'b' });
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc2, { foo: 'c' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'c' })],
                    docChanges: [added(doc2, { foo: 'c' })],
                });
            });
        });
    });
    (0, mocha_1.it)('handles update time change', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Send the same document but with a different update time
                streamHelper.write({
                    documentChange: {
                        document: {
                            name: doc1.formattedName,
                            fields: watchHelper.serializer.encodeFields({ foo: 'a' }),
                            createTime: { seconds: 1, nanos: 2 },
                            updateTime: { seconds: 3, nanos: 5 },
                        },
                        targetIds: [targetId],
                    },
                });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 3, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [modified(doc1, { foo: 'a' })],
                });
            });
        });
    });
    (0, mocha_1.describe)('supports isEqual', () => {
        let snapshotVersion;
        (0, mocha_1.beforeEach)(() => {
            snapshotVersion = 0;
        });
        function initialSnapshot(watchTest) {
            return watchHelper.runTest(collQueryJSON(), () => {
                watchHelper.sendAddTarget();
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(++snapshotVersion);
                return watchHelper
                    .await('snapshot')
                    .then(snapshot => watchTest(snapshot));
            });
        }
        function nextSnapshot(baseSnapshot, watchStep) {
            watchStep(baseSnapshot);
            watchHelper.sendSnapshot(++snapshotVersion);
            return watchHelper.await('snapshot');
        }
        (0, mocha_1.it)('for equal snapshots', () => {
            let firstSnapshot;
            let secondSnapshot;
            let thirdSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, snapshot => {
                    firstSnapshot = snapshot;
                    (0, chai_1.expect)(firstSnapshot.isEqual(firstSnapshot)).to.be.true;
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                    watchHelper.sendDoc(doc3, { foo: 'c' });
                })
                    .then(snapshot => nextSnapshot(snapshot, snapshot => {
                    secondSnapshot = snapshot;
                    (0, chai_1.expect)(secondSnapshot.isEqual(secondSnapshot)).to.be.true;
                    watchHelper.sendDocDelete(doc1);
                    watchHelper.sendDoc(doc2, { foo: 'bar' });
                    watchHelper.sendDoc(doc4, { foo: 'd' });
                }))
                    .then(snapshot => {
                    thirdSnapshot = snapshot;
                    (0, chai_1.expect)(thirdSnapshot.isEqual(thirdSnapshot)).to.be.true;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.true;
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                    watchHelper.sendDoc(doc3, { foo: 'c' });
                })
                    .then(snapshot => nextSnapshot(snapshot, snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(secondSnapshot)).to.be.true;
                    watchHelper.sendDocDelete(doc1);
                    watchHelper.sendDoc(doc2, { foo: 'bar' });
                    watchHelper.sendDoc(doc4, { foo: 'd' });
                }))
                    .then(snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(thirdSnapshot)).to.be.true;
                });
            }));
        });
        (0, mocha_1.it)('for equal snapshots with materialized changes', () => {
            let firstSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                    watchHelper.sendDoc(doc3, { foo: 'c' });
                }).then(snapshot => {
                    firstSnapshot = snapshot;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                    watchHelper.sendDoc(doc3, { foo: 'c' });
                }).then(snapshot => {
                    const materializedDocs = snapshot.docs;
                    (0, chai_1.expect)(materializedDocs.length).to.equal(3);
                    (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.true;
                });
            }));
        });
        (0, mocha_1.it)('for snapshots of different size', () => {
            let firstSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                }).then(snapshot => {
                    firstSnapshot = snapshot;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                }).then(snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.false;
                });
            }));
        });
        (0, mocha_1.it)('for snapshots with different kind of changes', () => {
            let firstSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'a' });
                }).then(snapshot => {
                    firstSnapshot = snapshot;
                    (0, chai_1.expect)(snapshot.docChanges()[0].isEqual(firstSnapshot.docChanges()[0])).to.be.true;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => {
                    watchHelper.sendDoc(doc1, { foo: 'b' });
                }).then(snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.false;
                    (0, chai_1.expect)(snapshot.docChanges()[0].isEqual(firstSnapshot.docChanges()[0])).to.be.false;
                });
            }));
        });
        (0, mocha_1.it)('for snapshots with different number of changes', () => {
            let firstSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => watchHelper.sendDoc(doc1, { foo: 'a' }))
                    .then(snapshot => nextSnapshot(snapshot, () => watchHelper.sendDoc(doc2, { foo: 'b' })))
                    .then(snapshot => {
                    firstSnapshot = snapshot;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => watchHelper.sendDoc(doc1, { foo: 'a' }))
                    .then(snapshot => nextSnapshot(snapshot, () => {
                    watchHelper.sendDocDelete(doc1);
                    watchHelper.sendDoc(doc2, { foo: 'b' });
                    watchHelper.sendDoc(doc3, { foo: 'c' });
                }))
                    .then(snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.false;
                });
            }));
        });
        (0, mocha_1.it)('for snapshots with different data types', () => {
            let originalSnapshot;
            return initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => watchHelper.sendDoc(doc1, { foo: '1' })).then(snapshot => {
                    originalSnapshot = snapshot;
                });
            }).then(() => initialSnapshot(snapshot => {
                return nextSnapshot(snapshot, () => watchHelper.sendDoc(doc1, { foo: 1 })).then(snapshot => {
                    (0, chai_1.expect)(snapshot.isEqual(originalSnapshot)).to.be.false;
                });
            }));
        });
        (0, mocha_1.it)('for snapshots with different queries', () => {
            let firstSnapshot;
            return initialSnapshot(snapshot => {
                firstSnapshot = snapshot;
            }).then(() => {
                watchHelper = new WatchHelper(streamHelper, includeQuery(), targetId);
                return watchHelper.runTest(includeQueryJSON(), () => {
                    watchHelper.sendAddTarget();
                    watchHelper.sendCurrent();
                    watchHelper.sendSnapshot(1);
                    return watchHelper.await('snapshot').then(snapshot => {
                        (0, chai_1.expect)(snapshot.isEqual(firstSnapshot)).to.be.false;
                    });
                });
            });
        });
        (0, mocha_1.it)('for objects with different type', () => {
            return initialSnapshot(snapshot => {
                (0, chai_1.expect)(snapshot.isEqual('foo')).to.be.false;
                (0, chai_1.expect)(snapshot.isEqual({})).to.be.false;
                (0, chai_1.expect)(snapshot.isEqual(new src_1.GeoPoint(0, 0))).to.be
                    .false;
            });
        });
    });
    (0, mocha_1.it)('handles delete and re-add in same snapshot', () => {
        return watchHelper.runTest(collQueryJSON(), () => {
            // Mock the server responding to the query.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, EMPTY);
                // Add a result.
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendSnapshot(1);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                lastSnapshot = snapshotsEqual(lastSnapshot, 1, results, {
                    docs: [snapshot(doc1, { foo: 'a' })],
                    docChanges: [added(doc1, { foo: 'a' })],
                });
                // Delete a doc and send the same doc again. Note that we did not
                // increment the snapshot version to keep the update time the same.
                watchHelper.sendDocDelete(doc1);
                watchHelper.sendDoc(doc1, { foo: 'a' });
                watchHelper.sendDoc(doc2, { foo: 'b' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(results => {
                snapshotsEqual(lastSnapshot, 2, results, {
                    docs: [snapshot(doc1, { foo: 'a' }), snapshot(doc2, { foo: 'b' })],
                    docChanges: [added(doc2, { foo: 'b' })],
                });
            });
        });
    });
});
(0, mocha_1.describe)('DocumentReference watch', () => {
    // The document to query.
    let doc;
    let firestore;
    let targetId;
    let watchHelper;
    let streamHelper;
    // The proto JSON that should be sent for the watch.
    const watchJSON = () => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                documents: {
                    documents: [doc.formattedName],
                },
                targetId,
            },
        };
    };
    // The proto JSON that should be sent for a resumed query.
    const resumeTokenJSON = (resumeToken) => {
        return {
            database: `projects/${PROJECT_ID}/databases/(default)`,
            addTarget: {
                documents: {
                    documents: [doc.formattedName],
                },
                targetId,
                resumeToken,
            },
        };
    };
    (0, mocha_1.beforeEach)(() => {
        // We are intentionally skipping the delays to ensure fast test execution.
        // The retry semantics are unaffected by this, as we maintain their
        // asynchronous behavior.
        (0, backoff_1.setTimeoutHandler)((op, timeout) => {
            if (timeout !== watch_1.WATCH_IDLE_TIMEOUT_MS) {
                setImmediate(op);
            }
        });
        targetId = 0x1;
        streamHelper = new StreamHelper();
        const overrides = { listen: streamHelper.getListenCallback() };
        return (0, helpers_1.createInstance)(overrides).then(firestoreClient => {
            firestore = firestoreClient;
            doc = firestore.doc('col/doc');
            watchHelper = new WatchHelper(streamHelper, doc, targetId);
        });
    });
    (0, mocha_1.afterEach)(() => {
        (0, backoff_1.setTimeoutHandler)(setTimeout);
        return (0, helpers_1.verifyInstance)(firestore);
    });
    (0, mocha_1.it)('with invalid callbacks', () => {
        (0, chai_1.expect)(() => doc.onSnapshot('foo')).to.throw('Value for argument "onNext" is not a valid function.');
        (0, chai_1.expect)(() => doc.onSnapshot(() => { }, 'foo')).to.throw('Value for argument "onError" is not a valid function.');
    });
    (0, mocha_1.it)('without error callback', done => {
        const unsubscribe = doc.onSnapshot(() => {
            unsubscribe();
            done();
        });
        streamHelper.awaitOpen().then(() => {
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
        });
    });
    (0, mocha_1.it)('handles invalid listen protos', () => {
        return watchHelper.runFailedTest(watchJSON(), () => {
            // Mock the server responding to the watch with an invalid proto.
            streamHelper.write({ invalid: true });
        }, 'Unknown listen response type: {"invalid":true}');
    });
    (0, mocha_1.it)('handles invalid target change protos', () => {
        return watchHelper.runFailedTest(watchJSON(), () => {
            // Mock the server responding to the watch with an invalid proto.
            streamHelper.write({
                targetChange: {
                    targetChangeType: 'INVALID',
                    targetIds: [0xfeed],
                },
            });
        }, 'Unknown target change type: {"targetChangeType":"INVALID",' +
            '"targetIds":[65261]}');
    });
    (0, mocha_1.it)('handles remove target change protos', () => {
        return watchHelper.runFailedTest(watchJSON(), () => {
            watchHelper.sendRemoveTarget();
        }, 'Error 13: internal error');
    });
    (0, mocha_1.it)('handles remove target change with code', () => {
        return watchHelper.runFailedTest(watchJSON(), () => {
            watchHelper.sendRemoveTarget(7);
        }, 'Error 7: test remove');
    });
    (0, mocha_1.it)('handles changing a doc', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add a result.
                watchHelper.sendDoc(doc, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.createTime.isEqual(new src_1.Timestamp(1, 2))).to.be.true;
                (0, chai_1.expect)(snapshot.updateTime.isEqual(new src_1.Timestamp(3, 1))).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('a');
                // Change the document.
                watchHelper.sendDoc(doc, { foo: 'b' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('b');
            });
        });
    });
    (0, mocha_1.it)('ignores non-matching doc', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                streamHelper.write({
                    documentChange: {
                        document: {
                            name: `projects/${PROJECT_ID}/databases/(default)/col/wrong`,
                            fields: {},
                            createTime: { seconds: 1, nanos: 2 },
                            updateTime: { seconds: 3, nanos: 4 },
                        },
                        targetIds: [targetId],
                    },
                });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
            });
        });
    });
    (0, mocha_1.it)('reconnects after error', () => {
        const resumeToken = Buffer.from([0xabcd]);
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add a result.
                watchHelper.sendDoc(doc, { foo: 'a' });
                watchHelper.sendSnapshot(2, resumeToken);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('a');
                streamHelper.destroyStream();
                return streamHelper.awaitReopen();
            })
                .then(request => {
                verifyRequest(request, resumeTokenJSON(resumeToken));
                // Change the document.
                watchHelper.sendDoc(doc, { foo: 'b' });
                watchHelper.sendSnapshot(3, resumeToken);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('b');
                // Remove the document.
                watchHelper.sendDocDelete(doc);
                watchHelper.sendSnapshot(4);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                (0, chai_1.expect)(streamHelper.streamCount).to.equal(2);
            });
        });
    });
    (0, mocha_1.it)('combines multiple change events for the same doc', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            // Add a result.
            watchHelper.sendDoc(doc, { foo: 'a' });
            // Modify it.
            watchHelper.sendDoc(doc, { foo: 'b' });
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('b');
                // Modify it two more times.
                watchHelper.sendDoc(doc, { foo: 'c' });
                watchHelper.sendDoc(doc, { foo: 'd' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('d');
                // Remove it, delete it, and then add it again.
                watchHelper.sendDocRemove(doc, { foo: 'e' });
                watchHelper.sendDocDelete(doc);
                watchHelper.sendDoc(doc, { foo: 'f' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('f');
            });
        });
    });
    (0, mocha_1.it)('handles deleting a doc', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add a result.
                watchHelper.sendDoc(doc, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                // Delete the document.
                watchHelper.sendDocDelete(doc);
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
            });
        });
    });
    (0, mocha_1.it)('handles removing a doc', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add a result.
                watchHelper.sendDoc(doc, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                // Remove the document.
                watchHelper.sendDocRemove(doc, { foo: 'c' });
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
            });
        });
    });
    (0, mocha_1.it)('handles reset', () => {
        return watchHelper.runTest(watchJSON(), () => {
            // Mock the server responding to the watch.
            watchHelper.sendAddTarget();
            watchHelper.sendCurrent();
            watchHelper.sendSnapshot(1);
            return watchHelper
                .await('snapshot')
                .then(() => {
                // Add three results.
                watchHelper.sendDoc(doc, { foo: 'a' });
                watchHelper.sendSnapshot(2);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('a');
                // Send a RESET.
                streamHelper.write({
                    targetChange: {
                        targetChangeType: 'RESET',
                        targetIds: [],
                    },
                });
                // Send the modified doc.
                watchHelper.sendDoc(doc, { foo: 'b' });
                watchHelper.sendCurrent();
                watchHelper.sendSnapshot(3);
                return watchHelper.await('snapshot');
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('b');
            });
        });
    });
});
(0, mocha_1.describe)('Query comparator', () => {
    let firestore;
    let colRef;
    let doc1;
    let doc2;
    let doc3;
    let doc4;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
            colRef = firestore.collection('col');
            doc1 = firestore.doc('col/doc1');
            doc2 = firestore.doc('col/doc2');
            doc3 = firestore.doc('col/doc3');
            doc4 = firestore.doc('col/doc4');
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    function testSort(query, input, expected) {
        const comparator = query.comparator();
        input.sort(comparator);
        docsEqual(input, expected);
    }
    (0, mocha_1.it)('handles basic case', () => {
        const query = colRef.orderBy('foo');
        const input = [
            snapshot(doc3, { foo: 2 }),
            snapshot(doc4, { foo: 1 }),
            snapshot(doc2, { foo: 2 }),
        ];
        const expected = [
            snapshot(doc4, { foo: 1 }),
            snapshot(doc2, { foo: 2 }),
            snapshot(doc3, { foo: 2 }),
        ];
        testSort(query, input, expected);
    });
    (0, mocha_1.it)('handles descending case', () => {
        const query = colRef.orderBy('foo', 'desc');
        const input = [
            snapshot(doc3, { foo: 2 }),
            snapshot(doc4, { foo: 1 }),
            snapshot(doc2, { foo: 2 }),
        ];
        const expected = [
            snapshot(doc3, { foo: 2 }),
            snapshot(doc2, { foo: 2 }),
            snapshot(doc4, { foo: 1 }),
        ];
        testSort(query, input, expected);
    });
    (0, mocha_1.it)('handles nested fields', () => {
        const query = colRef.orderBy('foo.bar');
        const input = [
            snapshot(doc1, { foo: { bar: 1 } }),
            snapshot(doc2, { foo: { bar: 2 } }),
            snapshot(doc3, { foo: { bar: 2 } }),
        ];
        const expected = [
            snapshot(doc1, { foo: { bar: 1 } }),
            snapshot(doc2, { foo: { bar: 2 } }),
            snapshot(doc3, { foo: { bar: 2 } }),
        ];
        testSort(query, input, expected);
    });
    (0, mocha_1.it)('fails on missing fields', () => {
        const query = colRef.orderBy('bar');
        const input = [
            snapshot(doc3, { foo: 2 }),
            snapshot(doc1, { foo: 1 }),
            snapshot(doc2, { foo: 2 }),
        ];
        const comparator = query.comparator();
        (0, chai_1.expect)(() => input.sort(comparator)).to.throw("Trying to compare documents on fields that don't exist");
    });
});
//# sourceMappingURL=watch.js.map
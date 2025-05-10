"use strict";
// Copyright 2018 Google LLC
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
exports.postConverterMerge = exports.postConverter = exports.Post = exports.DOCUMENT_NAME = exports.COLLECTION_ROOT = exports.DATABASE_ROOT = exports.PROJECT_ID = void 0;
exports.createInstance = createInstance;
exports.verifyInstance = verifyInstance;
exports.updateMask = updateMask;
exports.set = set;
exports.update = update;
exports.create = create;
exports.retrieve = retrieve;
exports.remove = remove;
exports.found = found;
exports.missing = missing;
exports.document = document;
exports.serverTimestamp = serverTimestamp;
exports.incrementTransform = incrementTransform;
exports.arrayTransform = arrayTransform;
exports.writeResult = writeResult;
exports.requestEquals = requestEquals;
exports.stream = stream;
exports.emptyQueryStream = emptyQueryStream;
exports.streamWithoutEnd = streamWithoutEnd;
exports.response = response;
exports.bundleToElementArray = bundleToElementArray;
exports.collect = collect;
exports.isPreferRest = isPreferRest;
const chai_1 = require("chai");
const extend = require("extend");
const length_prefixed_json_stream_1 = require("length-prefixed-json-stream");
const stream_1 = require("stream");
const through2 = require("through2");
const v1 = require("../../src/v1");
const src_1 = require("../../src");
const pool_1 = require("../../src/pool");
let SSL_CREDENTIALS = null;
if (!isPreferRest()) {
    const grpc = require('google-gax').grpc;
    SSL_CREDENTIALS = grpc.credentials.createInsecure();
}
exports.PROJECT_ID = 'test-project';
exports.DATABASE_ROOT = `projects/${exports.PROJECT_ID}/databases/(default)`;
exports.COLLECTION_ROOT = `${exports.DATABASE_ROOT}/documents/collectionId`;
exports.DOCUMENT_NAME = `${exports.COLLECTION_ROOT}/documentId`;
/**
 * Creates a new Firestore instance for testing. Request handlers can be
 * overridden by providing `apiOverrides`.
 *
 * @param apiOverrides An object with request handlers to override.
 * @param firestoreSettings Firestore Settings to configure the client.
 * @return A Promise that resolves with the new Firestore client.
 */
function createInstance(apiOverrides, firestoreSettings) {
    const initializationOptions = {
        ...{ projectId: exports.PROJECT_ID, sslCreds: SSL_CREDENTIALS },
        ...firestoreSettings,
    };
    const firestore = new src_1.Firestore();
    firestore.settings(initializationOptions);
    firestore['_clientPool'] = new pool_1.ClientPool(
    /* concurrentRequestLimit= */ 1, 
    /* maxIdleClients= */ 0, () => ({
        ...new v1.FirestoreClient(initializationOptions),
        ...apiOverrides,
    }) // eslint-disable-line @typescript-eslint/no-explicit-any
    );
    return Promise.resolve(firestore);
}
/**
 * Verifies that all streams have been properly shutdown at the end of a test
 * run.
 */
function verifyInstance(firestore) {
    // Allow the setTimeout() call in _initializeStream to run before
    // verifying that all operations have finished executing.
    return new Promise((resolve, reject) => {
        if (firestore['_clientPool'].opCount === 0) {
            resolve();
        }
        else {
            setTimeout(() => {
                const opCount = firestore['_clientPool'].opCount;
                if (opCount === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Firestore has ${opCount} unfinished operations executing.`));
                }
            }, 10);
        }
    });
}
function write(document, mask, transforms, precondition) {
    const writes = [];
    const update = Object.assign({}, document);
    delete update.updateTime;
    delete update.createTime;
    writes.push({ update });
    if (mask) {
        writes[0].updateMask = mask;
    }
    if (transforms) {
        writes[0].updateTransforms = transforms;
    }
    if (precondition) {
        writes[0].currentDocument = precondition;
    }
    return { writes };
}
function updateMask(...fieldPaths) {
    return fieldPaths.length === 0 ? {} : { fieldPaths };
}
function set(opts) {
    return write(opts.document, opts.mask || null, opts.transforms || null, 
    /* precondition= */ null);
}
function update(opts) {
    const precondition = opts.precondition || { exists: true };
    const mask = opts.mask || updateMask();
    return write(opts.document, mask, opts.transforms || null, precondition);
}
function create(opts) {
    return write(opts.document, /* updateMask= */ null, opts.transforms || null, {
        exists: false,
    });
}
function value(value) {
    if (typeof value === 'string') {
        return {
            stringValue: value,
        };
    }
    else {
        return value;
    }
}
function retrieve(id) {
    return { documents: [`${exports.DATABASE_ROOT}/documents/collectionId/${id}`] };
}
function remove(id, precondition) {
    const writes = [
        { delete: `${exports.DATABASE_ROOT}/documents/collectionId/${id}` },
    ];
    if (precondition) {
        writes[0].currentDocument = precondition;
    }
    return { writes };
}
function found(dataOrId) {
    return {
        found: typeof dataOrId === 'string' ? document(dataOrId) : dataOrId,
        readTime: { seconds: 5, nanos: 6 },
    };
}
function missing(id) {
    return {
        missing: `${exports.DATABASE_ROOT}/documents/collectionId/${id}`,
        readTime: { seconds: 5, nanos: 6 },
    };
}
function document(id, field, value, ...fieldOrValues) {
    const document = {
        name: `${exports.DATABASE_ROOT}/documents/collectionId/${id}`,
        fields: {},
        createTime: { seconds: 1, nanos: 2 },
        updateTime: { seconds: 3, nanos: 4 },
    };
    if (field !== undefined) {
        fieldOrValues = [field, value].concat(fieldOrValues);
        for (let i = 0; i < fieldOrValues.length; i += 2) {
            const field = fieldOrValues[i];
            const value = fieldOrValues[i + 1];
            if (typeof value === 'string') {
                document.fields[field] = {
                    stringValue: value,
                };
            }
            else {
                document.fields[field] = value;
            }
        }
    }
    return document;
}
function serverTimestamp(field) {
    return { fieldPath: field, setToServerValue: 'REQUEST_TIME' };
}
function incrementTransform(field, n) {
    return {
        fieldPath: field,
        increment: Number.isInteger(n) ? { integerValue: n } : { doubleValue: n },
    };
}
function arrayTransform(field, transform, ...values) {
    const fieldTransform = {
        fieldPath: field,
    };
    fieldTransform[transform] = { values: values.map(val => value(val)) };
    return fieldTransform;
}
function writeResult(count) {
    const response = {
        commitTime: {
            nanos: 0,
            seconds: 1,
        },
    };
    if (count > 0) {
        response.writeResults = [];
        for (let i = 1; i <= count; ++i) {
            response.writeResults.push({
                updateTime: {
                    nanos: i * 2,
                    seconds: i * 2 + 1,
                },
            });
        }
    }
    return response;
}
function requestEquals(actual, expected) {
    (0, chai_1.expect)(actual).to.not.be.undefined;
    // 'extend' removes undefined fields in the request object. The backend
    // ignores these fields, but we need to manually strip them before we compare
    // the expected and the actual request.
    actual = extend(true, {}, actual);
    const proto = Object.assign({ database: exports.DATABASE_ROOT }, expected);
    (0, chai_1.expect)(actual).to.deep.eq(proto);
}
function stream(...elements) {
    const stream = through2.obj();
    setImmediate(() => {
        for (const el of elements) {
            if (el instanceof Error) {
                stream.destroy(el);
                return;
            }
            stream.push(el);
        }
        stream.push(null);
    });
    return stream;
}
/**
 * Query streams with no results always at least emit a read time.
 */
function emptyQueryStream(readTime = { seconds: 5, nanos: 6 }) {
    return stream({ readTime });
}
function streamWithoutEnd(...elements) {
    const stream = through2.obj();
    setImmediate(() => {
        for (const el of elements) {
            if (el instanceof Error) {
                stream.destroy(el);
                return;
            }
            stream.push(el);
        }
    });
    return stream;
}
/** Creates a response as formatted by the GAPIC request methods.  */
function response(result) {
    return Promise.resolve([result, undefined, undefined]);
}
/** Sample user object class used in tests. */
class Post {
    constructor(title, author) {
        this.title = title;
        this.author = author;
    }
    toString() {
        return this.title + ', by ' + this.author;
    }
}
exports.Post = Post;
/** Converts Post objects to and from Firestore in tests. */
exports.postConverter = {
    toFirestore(post) {
        return { title: post.title, author: post.author };
    },
    fromFirestore(snapshot) {
        const data = snapshot.data();
        return new Post(data.title, data.author);
    },
};
exports.postConverterMerge = {
    toFirestore(post, options) {
        if (options) {
            (0, chai_1.expect)(post).to.not.be.an.instanceOf(Post);
        }
        else {
            (0, chai_1.expect)(post).to.be.an.instanceof(Post);
        }
        const result = {};
        if (post.title)
            result.title = post.title;
        if (post.author)
            result.author = post.author;
        return result;
    },
    fromFirestore(snapshot) {
        const data = snapshot.data();
        return new Post(data.title, data.author);
    },
};
async function bundleToElementArray(bundle) {
    const result = [];
    const readable = new stream_1.PassThrough();
    readable.end(bundle);
    const streamIterator = new length_prefixed_json_stream_1.JSONStreamIterator(readable);
    for await (const value of streamIterator) {
        result.push(value);
    }
    return result;
}
/**
 * Reads the elements of an AsyncIterator.
 *
 * Example:
 *
 * const query = firestore.collection('collectionId');
 * const iterator = query.stream()[Symbol.asyncIterator]()
 *   as AsyncIterator<QueryDocumentSnapshot>;
 * return collect(iterator).then(snapshots => {
 *   expect(snapshots).to.have.length(2);
 * });
 *
 * @param iterator the iterator whose elements over which to iterate.
 * @return a Promise that is fulfilled with the elements that were produced, or
 * is rejected with the cause of the first failed iteration.
 */
async function collect(iterator) {
    const values = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { done, value } = await iterator.next();
        if (done) {
            break;
        }
        values.push(value);
    }
    return values;
}
/**
 * Returns a value indicating whether preferRest is enabled
 * via the environment variable `FIRESTORE_PREFER_REST`.
 *
 * @return `true` if preferRest is enabled via the environment variable `FIRESTORE_PREFER_REST`.
 */
function isPreferRest() {
    return (process.env.FIRESTORE_PREFER_REST === '1' ||
        process.env.FIRESTORE_PREFER_REST === 'true');
}
//# sourceMappingURL=helpers.js.map
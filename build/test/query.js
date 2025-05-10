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
exports.fieldFiltersQuery = fieldFiltersQuery;
exports.fieldFilters = fieldFilters;
exports.fieldFilter = fieldFilter;
exports.compositeFilter = compositeFilter;
exports.orFilter = orFilter;
exports.andFilter = andFilter;
exports.orderBy = orderBy;
exports.limit = limit;
exports.allDescendants = allDescendants;
exports.select = select;
exports.startAt = startAt;
exports.readTime = readTime;
exports.queryEqualsWithParent = queryEqualsWithParent;
exports.queryEquals = queryEquals;
exports.result = result;
exports.heartbeat = heartbeat;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const extend = require("extend");
const assert = require("assert");
const src_1 = require("../src");
const backoff_1 = require("../src/backoff");
const document_1 = require("../src/document");
const path_1 = require("../src/path");
const helpers_1 = require("./util/helpers");
const google_gax_1 = require("google-gax");
const filter_1 = require("../src/filter");
const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
(0, chai_1.use)(chaiAsPromised);
function snapshot(relativePath, data) {
    return (0, helpers_1.createInstance)().then(firestore => {
        const path = path_1.QualifiedResourcePath.fromSlashSeparatedString(`${DATABASE_ROOT}/documents/${relativePath}`);
        const ref = new src_1.DocumentReference(firestore, path);
        const snapshot = new document_1.DocumentSnapshotBuilder(ref);
        snapshot.fieldsProto = firestore['_serializer'].encodeFields(data);
        snapshot.readTime = src_1.Timestamp.fromMillis(0);
        snapshot.createTime = src_1.Timestamp.fromMillis(0);
        snapshot.updateTime = src_1.Timestamp.fromMillis(0);
        return snapshot.build();
    });
}
function where(filter) {
    return {
        where: filter,
    };
}
function fieldFiltersQuery(fieldPath, op, value, ...fieldPathOpAndValues) {
    return {
        where: fieldFilters(fieldPath, op, value, ...fieldPathOpAndValues),
    };
}
function fieldFilters(fieldPath, op, value, ...fieldPathOpAndValues) {
    const filters = [];
    fieldPathOpAndValues = [fieldPath, op, value, ...fieldPathOpAndValues];
    for (let i = 0; i < fieldPathOpAndValues.length; i += 3) {
        fieldPath = fieldPathOpAndValues[i];
        op = fieldPathOpAndValues[i + 1];
        value = fieldPathOpAndValues[i + 2];
        const filter = {
            field: {
                fieldPath,
            },
            op,
        };
        if (typeof value === 'string') {
            filter.value = { stringValue: value };
        }
        else {
            filter.value = value;
        }
        filters.push({ fieldFilter: filter });
    }
    if (filters.length === 1) {
        return {
            fieldFilter: filters[0].fieldFilter,
        };
    }
    else {
        return {
            compositeFilter: {
                op: 'AND',
                filters,
            },
        };
    }
}
function fieldFilter(fieldPath, op, value) {
    return fieldFilters(fieldPath, op, value);
}
function compositeFilter(op, ...filters) {
    return {
        compositeFilter: {
            op: op,
            filters,
        },
    };
}
function orFilter(op, ...filters) {
    return compositeFilter('OR', ...filters);
}
function andFilter(op, ...filters) {
    return compositeFilter('AND', ...filters);
}
function unaryFiltersQuery(fieldPath, equals, ...fieldPathsAndEquals) {
    return {
        where: unaryFilters(fieldPath, equals, ...fieldPathsAndEquals),
    };
}
function unaryFilters(fieldPath, equals, ...fieldPathsAndEquals) {
    const filters = [];
    fieldPathsAndEquals.unshift(fieldPath, equals);
    for (let i = 0; i < fieldPathsAndEquals.length; i += 2) {
        const fieldPath = fieldPathsAndEquals[i];
        const equals = fieldPathsAndEquals[i + 1];
        (0, chai_1.expect)(equals).to.be.oneOf([
            'IS_NAN',
            'IS_NULL',
            'IS_NOT_NAN',
            'IS_NOT_NULL',
        ]);
        filters.push({
            unaryFilter: {
                field: {
                    fieldPath,
                },
                op: equals,
            },
        });
    }
    if (filters.length === 1) {
        return {
            unaryFilter: filters[0].unaryFilter,
        };
    }
    else {
        return {
            compositeFilter: {
                op: 'AND',
                filters,
            },
        };
    }
}
function orderBy(fieldPath, direction, ...fieldPathAndOrderBys) {
    const orderBy = [];
    fieldPathAndOrderBys.unshift(fieldPath, direction);
    for (let i = 0; i < fieldPathAndOrderBys.length; i += 2) {
        const fieldPath = fieldPathAndOrderBys[i];
        const direction = fieldPathAndOrderBys[i + 1];
        orderBy.push({
            field: {
                fieldPath,
            },
            direction,
        });
    }
    return { orderBy };
}
function limit(n) {
    return {
        limit: {
            value: n,
        },
    };
}
function offset(n) {
    return {
        offset: n,
    };
}
function allDescendants(kindless = false) {
    if (kindless) {
        return { from: [{ allDescendants: true }] };
    }
    return { from: [{ collectionId: 'collectionId', allDescendants: true }] };
}
function select(...fields) {
    const select = {
        fields: [],
    };
    for (const field of fields) {
        select.fields.push({ fieldPath: field });
    }
    return { select };
}
function startAt(before, ...values) {
    const cursor = {
        values: [],
    };
    if (before) {
        cursor.before = true;
    }
    for (const value of values) {
        if (typeof value === 'string') {
            cursor.values.push({
                stringValue: value,
            });
        }
        else {
            cursor.values.push(value);
        }
    }
    return { startAt: cursor };
}
function endAt(before, ...values) {
    const cursor = {
        values: [],
    };
    if (before) {
        cursor.before = true;
    }
    for (const value of values) {
        if (typeof value === 'string') {
            cursor.values.push({
                stringValue: value,
            });
        }
        else {
            cursor.values.push(value);
        }
    }
    return { endAt: cursor };
}
/**
 * Returns the timestamp value for the provided readTimes, or the default
 * readTime value used in tests if no values are provided.
 */
function readTime(seconds, nanos) {
    if (seconds === undefined && nanos === undefined) {
        return { seconds: '5', nanos: 6 };
    }
    return { seconds: String(seconds), nanos: nanos };
}
function queryEqualsWithParent(actual, parent, ...protoComponents) {
    (0, chai_1.expect)(actual).to.not.be.undefined;
    if (parent !== '') {
        parent = '/' + parent;
    }
    const query = {
        parent: DATABASE_ROOT + '/documents' + parent,
        structuredQuery: {},
    };
    for (const protoComponent of protoComponents) {
        extend(true, query.structuredQuery, protoComponent);
    }
    // We add the `from` selector here in order to avoid setting collectionId on
    // kindless queries.
    if (query.structuredQuery.from === undefined) {
        query.structuredQuery.from = [
            {
                collectionId: 'collectionId',
            },
        ];
    }
    // 'extend' removes undefined fields in the request object. The backend
    // ignores these fields, but we need to manually strip them before we compare
    // the expected and the actual request.
    actual = extend(true, {}, actual);
    (0, chai_1.expect)(actual).to.deep.eq(query);
}
function queryEquals(actual, ...protoComponents) {
    queryEqualsWithParent(actual, /* parent= */ '', ...protoComponents);
}
function bundledQueryEquals(actual, limitType, ...protoComponents) {
    (0, chai_1.expect)(actual).to.not.be.undefined;
    const query = {
        parent: DATABASE_ROOT + '/documents',
        structuredQuery: {
            from: [
                {
                    collectionId: 'collectionId',
                },
            ],
        },
        limitType,
    };
    for (const protoComponent of protoComponents) {
        extend(true, query.structuredQuery, protoComponent);
    }
    // 'extend' removes undefined fields in the request object. The backend
    // ignores these fields, but we need to manually strip them before we compare
    // the expected and the actual request.
    actual = extend(true, {}, actual);
    (0, chai_1.expect)(actual).to.deep.eq(query);
}
function result(documentId, setDone) {
    if (setDone) {
        return {
            document: (0, helpers_1.document)(documentId),
            readTime: { seconds: 5, nanos: 6 },
            done: setDone,
        };
    }
    else {
        return { document: (0, helpers_1.document)(documentId), readTime: { seconds: 5, nanos: 6 } };
    }
}
function heartbeat(count) {
    return {
        document: null,
        readTime: { seconds: 5, nanos: 6 },
        skippedResults: count,
    };
}
(0, mocha_1.describe)('query interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(async () => {
        await (0, helpers_1.verifyInstance)(firestore);
        (0, backoff_1.setTimeoutHandler)(setTimeout);
    });
    (0, mocha_1.it)('has isEqual() method', () => {
        const queryA = firestore.collection('collectionId');
        const queryB = firestore.collection('collectionId');
        const queryEquals = (equals, notEquals) => {
            for (let i = 0; i < equals.length; ++i) {
                for (const equal of equals) {
                    (0, chai_1.expect)(equals[i].isEqual(equal)).to.be.true;
                    (0, chai_1.expect)(equal.isEqual(equals[i])).to.be.true;
                }
                for (const notEqual of notEquals) {
                    (0, chai_1.expect)(equals[i].isEqual(notEqual)).to.be.false;
                    (0, chai_1.expect)(notEqual.isEqual(equals[i])).to.be.false;
                }
            }
        };
        queryEquals([queryA.where('a', '==', '1'), queryB.where('a', '==', '1')], [queryA.where('a', '=', 1)]);
        queryEquals([
            queryA.where('a', '==', '1').where('b', '==', 2),
            queryB.where('a', '==', '1').where('b', '==', 2),
        ], []);
        queryEquals([
            queryA.orderBy('__name__'),
            queryA.orderBy('__name__', 'asc'),
            queryB.orderBy('__name__', 'ASC'),
            queryB.orderBy(src_1.FieldPath.documentId()),
        ], [queryA.orderBy('foo'), queryB.orderBy(src_1.FieldPath.documentId(), 'desc')]);
        queryEquals([queryA.limit(0), queryB.limit(0).limit(0)], [queryA, queryB.limit(10)]);
        queryEquals([queryA.offset(0), queryB.offset(0).offset(0)], [queryA, queryB.offset(10)]);
        queryEquals([queryA.orderBy('foo').startAt('a'), queryB.orderBy('foo').startAt('a')], [
            queryA.orderBy('foo').startAfter('a'),
            queryB.orderBy('foo').endAt('a'),
            queryA.orderBy('foo').endBefore('a'),
            queryB.orderBy('foo').startAt('b'),
            queryA.orderBy('bar').startAt('a'),
        ]);
        queryEquals([
            queryA.orderBy('foo').startAfter('a'),
            queryB.orderBy('foo').startAfter('a'),
        ], [
            queryA.orderBy('foo').startAfter('b'),
            queryB.orderBy('bar').startAfter('a'),
        ]);
        queryEquals([
            queryA.orderBy('foo').endBefore('a'),
            queryB.orderBy('foo').endBefore('a'),
        ], [
            queryA.orderBy('foo').endBefore('b'),
            queryB.orderBy('bar').endBefore('a'),
        ]);
        queryEquals([queryA.orderBy('foo').endAt('a'), queryB.orderBy('foo').endAt('a')], [queryA.orderBy('foo').endAt('b'), queryB.orderBy('bar').endAt('a')]);
        queryEquals([
            queryA.orderBy('foo').orderBy('__name__').startAt('b', 'c'),
            queryB.orderBy('foo').orderBy('__name__').startAt('b', 'c'),
        ], []);
    });
    (0, mocha_1.it)('accepts all variations', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('foo', 'EQUAL', 'bar'), orderBy('foo', 'ASCENDING'), limit(10));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', 'bar');
            query = query.orderBy('foo');
            query = query.limit(10);
            return query.get().then(results => {
                (0, chai_1.expect)(results.query).to.equal(query);
                (0, chai_1.expect)(results.size).to.equal(0);
                (0, chai_1.expect)(results.empty).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('supports empty gets', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.stream)({ readTime: { seconds: 5, nanos: 6 } });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            return query.get().then(results => {
                (0, chai_1.expect)(results.size).to.equal(0);
                (0, chai_1.expect)(results.empty).to.be.true;
                (0, chai_1.expect)(results.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('retries on stream failure', () => {
        let attempts = 0;
        const overrides = {
            runQuery: () => {
                ++attempts;
                throw new Error('Expected error');
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            return query
                .get()
                .then(() => {
                throw new Error('Unexpected success');
            })
                .catch(() => {
                (0, chai_1.expect)(attempts).to.equal(5);
            });
        });
    });
    (0, mocha_1.it)('supports empty streams', callback => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.stream)({ readTime: { seconds: 5, nanos: 6 } });
            },
        };
        (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            query
                .stream()
                .on('data', () => {
                callback(Error('Unexpected document'));
            })
                .on('end', () => {
                callback();
            });
        });
    });
    (0, mocha_1.it)('returns results', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.stream)(result('first'), result('second'));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            return query.get().then(results => {
                (0, chai_1.expect)(results.size).to.equal(2);
                (0, chai_1.expect)(results.empty).to.be.false;
                (0, chai_1.expect)(results.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                (0, chai_1.expect)(results.docs[0].id).to.equal('first');
                (0, chai_1.expect)(results.docs[1].id).to.equal('second');
                (0, chai_1.expect)(results.docChanges()).to.have.length(2);
                let count = 0;
                results.forEach(doc => {
                    (0, chai_1.expect)(doc instanceof document_1.DocumentSnapshot).to.be.true;
                    (0, chai_1.expect)(doc.createTime.isEqual(new src_1.Timestamp(1, 2))).to.be.true;
                    (0, chai_1.expect)(doc.updateTime.isEqual(new src_1.Timestamp(3, 4))).to.be.true;
                    (0, chai_1.expect)(doc.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                    ++count;
                });
                (0, chai_1.expect)(2).to.equal(count);
            });
        });
    });
    // Test Logical Termination on get()
    (0, mocha_1.it)('successful return without ending the stream on get()', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.streamWithoutEnd)(result('first'), result('second', true));
            },
        };
        let counter = 0;
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            return query.get().then(results => {
                (0, chai_1.expect)(++counter).to.equal(1);
                (0, chai_1.expect)(results.size).to.equal(2);
                (0, chai_1.expect)(results.empty).to.be.false;
                (0, chai_1.expect)(results.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                (0, chai_1.expect)(results.docs[0].id).to.equal('first');
                (0, chai_1.expect)(results.docs[1].id).to.equal('second');
                (0, chai_1.expect)(results.docChanges()).to.have.length(2);
            });
        });
    });
    (0, mocha_1.it)('handles stream exception at initialization', () => {
        let attempts = 0;
        const query = firestore.collection('collectionId');
        query._queryUtil._stream = () => {
            ++attempts;
            throw new Error('Expected error');
        };
        return query
            .get()
            .then(() => {
            throw new Error('Unexpected success in Promise');
        })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('Expected error');
            (0, chai_1.expect)(attempts).to.equal(1);
        });
    });
    (0, mocha_1.it)('handles stream exception during initialization', () => {
        let attempts = 0;
        const overrides = {
            runQuery: () => {
                ++attempts;
                return (0, helpers_1.stream)(new Error('Expected error'));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return firestore
                .collection('collectionId')
                .get()
                .then(() => {
                throw new Error('Unexpected success in Promise');
            })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('Expected error');
                (0, chai_1.expect)(attempts).to.equal(5);
            });
        });
    });
    (0, mocha_1.it)('handles stream exception after initialization (with get())', () => {
        const responses = [
            () => (0, helpers_1.stream)(result('first'), new Error('Expected error')),
            () => (0, helpers_1.stream)(result('second')),
        ];
        const overrides = {
            runQuery: () => responses.shift()(),
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return firestore
                .collection('collectionId')
                .get()
                .then(snap => {
                (0, chai_1.expect)(snap.size).to.equal(2);
                (0, chai_1.expect)(snap.docs[0].id).to.equal('first');
                (0, chai_1.expect)(snap.docs[1].id).to.equal('second');
            });
        });
    });
    (0, mocha_1.it)('handles stream exception after initialization and heartbeat', () => {
        const deadlineExceededErr = new google_gax_1.GoogleError();
        deadlineExceededErr.code = google_gax_1.Status.DEADLINE_EXCEEDED;
        deadlineExceededErr.message = 'DEADLINE_EXCEEDED error message';
        let attempts = 0;
        const overrides = {
            runQuery: () => {
                ++attempts;
                // A heartbeat message will initialize the stream, but it is not
                // a document, so it does not represent progress made on the stream.
                return (0, helpers_1.stream)(heartbeat(1000), deadlineExceededErr);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return firestore
                .collection('collectionId')
                .get()
                .then(() => {
                throw new Error('Unexpected success in Promise');
            })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('DEADLINE_EXCEEDED error message');
                // The heartbeat initialized the stream before there was a stream
                // exception, so we only expect a single attempt at streaming.
                (0, chai_1.expect)(attempts).to.equal(1);
            });
        });
    });
    function handlesRetryableExceptionUntilProgressStops(withHeartbeat) {
        let attempts = 0;
        // count of stream initializations that are successful
        // and make progress (a document is received before error)
        const initializationsWithProgress = 10;
        // Receiving these error codes on a stream after the stream has received document data
        // should result in the stream retrying indefinitely.
        const retryableErrorCodes = [
            google_gax_1.Status.DEADLINE_EXCEEDED,
            google_gax_1.Status.UNAVAILABLE,
            google_gax_1.Status.INTERNAL,
            google_gax_1.Status.UNAVAILABLE,
        ];
        const overrides = {
            runQuery: x => {
                var _b, _c, _d, _e, _f, _g, _h, _j;
                ++attempts;
                // Validate that runQuery is called with cursor of the lastReceivedDocument
                // for all attempts except but the first.
                if (attempts > 1) {
                    const docPath = ((_d = (_c = (_b = x === null || x === void 0 ? void 0 : x.structuredQuery) === null || _b === void 0 ? void 0 : _b.startAt) === null || _c === void 0 ? void 0 : _c.values) === null || _d === void 0 ? void 0 : _d[0].referenceValue) || '';
                    const docId = docPath.substring(docPath.lastIndexOf('/'));
                    (0, chai_1.expect)(docId).to.equal(`/id-${Math.min(initializationsWithProgress, attempts - 1)}`);
                    (0, chai_1.expect)((_f = (_e = x === null || x === void 0 ? void 0 : x.structuredQuery) === null || _e === void 0 ? void 0 : _e.orderBy) === null || _f === void 0 ? void 0 : _f.length).to.equal(1);
                    (0, chai_1.expect)((_j = (_h = (_g = x === null || x === void 0 ? void 0 : x.structuredQuery) === null || _g === void 0 ? void 0 : _g.orderBy) === null || _h === void 0 ? void 0 : _h[0].field) === null || _j === void 0 ? void 0 : _j.fieldPath).to.equal('__name__');
                }
                const streamElements = [];
                // A heartbeat is a message that may be received on a stream while
                // a query is running. If the test is configured `withHeartbeat = true`
                // then the fake stream will include a heartbeat before the first
                // document. This heartbeat message has the side effect of initializing
                // the stream, but it does not represent progress of streaming the results.
                // Testing with and without heartbeats allows us to evaluate different
                // retry logic in the SDK.
                if (withHeartbeat) {
                    streamElements.push(heartbeat(1000));
                }
                // For the first X initializations, the stream will make progress
                // receiving documents in the result set.
                // For the X+1 attempt, the stream will not make progress before
                // the error. If a stream gets an error without progress, the
                // retry policy will close the stream.
                if (attempts <= initializationsWithProgress) {
                    streamElements.push(result(`id-${attempts}`));
                }
                // Create an error with one of the retryable error codes
                const googleError = new google_gax_1.GoogleError();
                googleError.code =
                    retryableErrorCodes[attempts % retryableErrorCodes.length];
                googleError.message = 'test error message';
                streamElements.push(googleError);
                return (0, helpers_1.stream)(...streamElements);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            query._queryUtil._hasRetryTimedOut = () => false;
            return query
                .get()
                .then(() => {
                throw new Error('Unexpected success in Promise');
            })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('test error message');
                // Assert that runQuery was retried the expected number
                // of times based on the test configuration.
                //
                // If the test is running with heartbeat messages, then
                // the test will always validate retry logic for an
                // initialized stream.
                //
                // If the test is running without heartbeat messages,
                // then the test will validate retry logic for both
                // initialized and uninitialized streams. Specifically,
                // the last retry will fail with an uninitialized stream.
                const initilizationRetries = withHeartbeat ? 1 : 5;
                (0, chai_1.expect)(attempts).to.equal(initializationsWithProgress + initilizationRetries);
            });
        });
    }
    (0, mocha_1.it)('handles retryable exception until progress stops with heartbeat', async () => {
        await handlesRetryableExceptionUntilProgressStops(true);
    });
    (0, mocha_1.it)('handles retryable exception until progress stops without heartbeat', async () => {
        await handlesRetryableExceptionUntilProgressStops(false);
    });
    (0, mocha_1.it)('handles retryable exception with progress until timeout', async () => {
        let attempts = 0;
        const overrides = {
            runQuery: () => {
                ++attempts;
                const streamElements = [];
                streamElements.push(result(`id-${attempts}`));
                // Create an error with a retryable error code
                const googleError = new google_gax_1.GoogleError();
                googleError.code = google_gax_1.Status.DEADLINE_EXCEEDED;
                googleError.message = 'test error message';
                streamElements.push(googleError);
                return (0, helpers_1.stream)(...streamElements);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            // Fake our timeout check to fail after 10 retry attempts
            query._queryUtil._hasRetryTimedOut = (methodName, startTime) => {
                (0, chai_1.expect)(methodName).to.equal('runQuery');
                (0, chai_1.expect)(startTime).to.be.lessThanOrEqual(Date.now());
                return attempts >= 10;
            };
            return query
                .get()
                .then(() => {
                throw new Error('Unexpected success in Promise');
            })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('test error message');
                (0, chai_1.expect)(attempts).to.equal(10);
            });
        });
    });
    (0, mocha_1.it)('handles non-retryable after recieving data (with get())', () => {
        let attempts = 0;
        const overrides = {
            runQuery: () => {
                ++attempts;
                const streamElements = [];
                streamElements.push(result(`id-${attempts}`));
                // Create an error with one of the retryable error codes
                const googleError = new google_gax_1.GoogleError();
                googleError.code = google_gax_1.Status.UNKNOWN;
                googleError.message = 'test error message';
                streamElements.push(googleError);
                return (0, helpers_1.stream)(...streamElements);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return firestore
                .collection('collectionId')
                .get()
                .then(() => {
                throw new Error('Unexpected success in Promise');
            })
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('test error message');
                (0, chai_1.expect)(attempts).to.equal(1);
            });
        });
    });
    (0, mocha_1.it)('handles stream exception after initialization (with stream())', done => {
        const responses = [
            () => (0, helpers_1.stream)(result('first'), new Error('Expected error')),
            () => (0, helpers_1.stream)(result('second')),
        ];
        const overrides = {
            runQuery: () => responses.shift()(),
        };
        (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const result = firestore.collection('collectionId').stream();
            let resultCount = 0;
            result.on('data', doc => {
                (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
                ++resultCount;
            });
            result.on('end', () => {
                (0, chai_1.expect)(resultCount).to.equal(2);
                done();
            });
        });
    });
    (0, mocha_1.it)('streams results', callback => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.stream)(result('first'), result('second'));
            },
        };
        (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            let received = 0;
            query
                .stream()
                .on('data', doc => {
                (0, chai_1.expect)(doc).to.be.an.instanceOf(document_1.DocumentSnapshot);
                ++received;
            })
                .on('end', () => {
                (0, chai_1.expect)(received).to.equal(2);
                callback();
            });
        });
    });
    // Test Logical Termination on stream()
    (0, mocha_1.it)('successful return without ending the stream on stream()', callback => {
        const overrides = {
            runQuery: request => {
                queryEquals(request);
                return (0, helpers_1.streamWithoutEnd)(result('first'), result('second', true));
            },
        };
        let endCounter = 0;
        (0, helpers_1.createInstance)(overrides).then(firestore => {
            const query = firestore.collection('collectionId');
            let received = 0;
            query
                .stream()
                .on('data', doc => {
                (0, chai_1.expect)(doc).to.be.an.instanceOf(document_1.DocumentSnapshot);
                ++received;
            })
                .on('end', () => {
                (0, chai_1.expect)(received).to.equal(2);
                ++endCounter;
                setImmediate(() => {
                    (0, chai_1.expect)(endCounter).to.equal(1);
                    callback();
                });
            });
        });
    });
    (0, mocha_1.it)('for Query.withConverter()', async () => {
        const doc = (0, helpers_1.document)('documentId', 'author', 'author', 'title', 'post');
        const overrides = {
            commit: request => {
                const expectedRequest = (0, helpers_1.set)({
                    document: doc,
                });
                (0, helpers_1.requestEquals)(request, expectedRequest);
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('title', 'EQUAL', 'post'));
                return (0, helpers_1.stream)({ document: doc, readTime: { seconds: 5, nanos: 6 } });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestoreInstance) => {
            firestore = firestoreInstance;
            await firestore
                .collection('collectionId')
                .doc('documentId')
                .set({ title: 'post', author: 'author' });
            const posts = await firestore
                .collection('collectionId')
                .where('title', '==', 'post')
                .withConverter(helpers_1.postConverter)
                .get();
            (0, chai_1.expect)(posts.size).to.equal(1);
            (0, chai_1.expect)(posts.docs[0].data().toString()).to.equal('post, by author');
        });
    });
    (0, mocha_1.it)('propagates withConverter() through QueryOptions', async () => {
        const doc = (0, helpers_1.document)('documentId', 'author', 'author', 'title', 'post');
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('title', 'EQUAL', 'post'));
                return (0, helpers_1.stream)({ document: doc, readTime: { seconds: 5, nanos: 6 } });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestoreInstance) => {
            firestore = firestoreInstance;
            const coll = firestore
                .collection('collectionId')
                .withConverter(helpers_1.postConverter);
            // Verify that the converter is carried through.
            const posts = await coll.where('title', '==', 'post').get();
            (0, chai_1.expect)(posts.size).to.equal(1);
            (0, chai_1.expect)(posts.docs[0].data().toString()).to.equal('post, by author');
        });
    });
    (0, mocha_1.it)('withConverter(null) applies the default converter', async () => {
        const doc = (0, helpers_1.document)('documentId', 'author', 'author', 'title', 'post');
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('title', 'EQUAL', 'post'));
                return (0, helpers_1.stream)({ document: doc, readTime: { seconds: 5, nanos: 6 } });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestoreInstance) => {
            firestore = firestoreInstance;
            const coll = await firestore
                .collection('collectionId')
                .withConverter(helpers_1.postConverter)
                .withConverter(null);
            const posts = await coll.where('title', '==', 'post').get();
            (0, chai_1.expect)(posts.size).to.equal(1);
            (0, chai_1.expect)(posts.docs[0].data()).to.not.be.instanceOf(helpers_1.Post);
        });
    });
    (0, mocha_1.it)('supports OR query with cursor', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, where(compositeFilter('OR', fieldFilter('a', 'GREATER_THAN', { integerValue: 10 }), unaryFilters('b', 'IS_NOT_NULL'))), limit(3), orderBy('a', 'ASCENDING'), startAt(true, { integerValue: 1 }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query
                .where(filter_1.Filter.or(filter_1.Filter.where('a', '>', 10), filter_1.Filter.where('b', '!=', null)))
                .orderBy('a')
                .startAt(1)
                .limit(3);
            return query.get();
        });
    });
});
(0, mocha_1.describe)('where() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('foo', 'EQUAL', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('concatenates all accepted filters', () => {
        const arrValue = {
            arrayValue: {
                values: [
                    {
                        stringValue: 'barArray',
                    },
                ],
            },
        };
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('fooSmaller', 'LESS_THAN', 'barSmaller', 'fooSmallerOrEquals', 'LESS_THAN_OR_EQUAL', 'barSmallerOrEquals', 'fooEquals', 'EQUAL', 'barEquals', 'fooEqualsLong', 'EQUAL', 'barEqualsLong', 'fooGreaterOrEquals', 'GREATER_THAN_OR_EQUAL', 'barGreaterOrEquals', 'fooGreater', 'GREATER_THAN', 'barGreater', 'fooContains', 'ARRAY_CONTAINS', 'barContains', 'fooIn', 'IN', arrValue, 'fooContainsAny', 'ARRAY_CONTAINS_ANY', arrValue, 'fooNotEqual', 'NOT_EQUAL', 'barEqualsLong', 'fooNotIn', 'NOT_IN', arrValue));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('fooSmaller', '<', 'barSmaller');
            query = query.where('fooSmallerOrEquals', '<=', 'barSmallerOrEquals');
            query = query.where('fooEquals', '=', 'barEquals');
            query = query.where('fooEqualsLong', '==', 'barEqualsLong');
            query = query.where('fooGreaterOrEquals', '>=', 'barGreaterOrEquals');
            query = query.where('fooGreater', '>', 'barGreater');
            query = query.where('fooContains', 'array-contains', 'barContains');
            query = query.where('fooIn', 'in', ['barArray']);
            query = query.where('fooContainsAny', 'array-contains-any', ['barArray']);
            query = query.where('fooNotEqual', '!=', 'barEqualsLong');
            query = query.where('fooNotIn', 'not-in', ['barArray']);
            return query.get();
        });
    });
    (0, mocha_1.it)('accepts object', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('foo', 'EQUAL', {
                    mapValue: {
                        fields: {
                            foo: { stringValue: 'bar' },
                        },
                    },
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', { foo: 'bar' });
            return query.get();
        });
    });
    (0, mocha_1.it)('supports field path objects for field paths', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('foo.bar', 'EQUAL', 'foobar', 'bar.foo', 'EQUAL', 'foobar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo.bar', '==', 'foobar');
            query = query.where(new src_1.FieldPath('bar', 'foo'), '==', 'foobar');
            return query.get();
        });
    });
    (0, mocha_1.it)('supports strings for FieldPath.documentId()', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('__name__', 'EQUAL', {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/foo',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where(src_1.FieldPath.documentId(), '==', 'foo');
            return query.get();
        });
    });
    (0, mocha_1.it)('supports reference array for IN queries', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('__name__', 'IN', {
                    arrayValue: {
                        values: [
                            {
                                referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/collectionId/foo`,
                            },
                            {
                                referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/collectionId/bar`,
                            },
                        ],
                    },
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const collection = firestore.collection('collectionId');
            const query = collection.where(src_1.FieldPath.documentId(), 'in', [
                'foo',
                collection.doc('bar'),
            ]);
            return query.get();
        });
    });
    (0, mocha_1.it)('Fields of IN queries are not used in implicit order by', async () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, fieldFiltersQuery('foo', 'IN', {
                    arrayValue: {
                        values: [
                            {
                                stringValue: 'bar',
                            },
                        ],
                    },
                }), orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc1',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestoreInstance) => {
            firestore = firestoreInstance;
            const collection = firestore.collection('collectionId');
            const query = collection
                .where('foo', 'in', ['bar'])
                .startAt(await snapshot('collectionId/doc1', {}));
            return query.get();
        });
    });
    (0, mocha_1.it)('validates references for in/not-in queries', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'in', ['foo', 42]);
        }).to.throw('The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".');
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'in', 42);
        }).to.throw("Invalid Query. A non-empty array is required for 'in' filters.");
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'in', []);
        }).to.throw("Invalid Query. A non-empty array is required for 'in' filters.");
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'not-in', ['foo', 42]);
        }).to.throw('The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".');
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'not-in', 42);
        }).to.throw("Invalid Query. A non-empty array is required for 'not-in' filters.");
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'not-in', []);
        }).to.throw("Invalid Query. A non-empty array is required for 'not-in' filters.");
    });
    (0, mocha_1.it)('validates query operator for FieldPath.document()', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'array-contains', query.doc());
        }).to.throw("Invalid Query. You can't perform 'array-contains' queries on FieldPath.documentId().");
        (0, chai_1.expect)(() => {
            query.where(src_1.FieldPath.documentId(), 'array-contains-any', query.doc());
        }).to.throw("Invalid Query. You can't perform 'array-contains-any' queries on FieldPath.documentId().");
    });
    (0, mocha_1.it)('rejects custom objects for field paths', () => {
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where({}, '==', 'bar');
            return query.get();
        }).to.throw('Value for argument "fieldPath" is not a valid field path. Paths can only be specified as strings or via a FieldPath object.');
        class FieldPath {
        }
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where(new FieldPath(), '==', 'bar');
            return query.get();
        }).to.throw('Detected an object of type "FieldPath" that doesn\'t match the expected instance.');
    });
    (0, mocha_1.it)('rejects field paths as value', () => {
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', new src_1.FieldPath('bar'));
            return query.get();
        }).to.throw('Value for argument "value" is not a valid query constraint. Cannot use object of type "FieldPath" as a Firestore value.');
    });
    (0, mocha_1.it)('rejects field delete as value', () => {
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', src_1.FieldValue.delete());
            return query.get();
        }).to.throw('FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true}.');
    });
    (0, mocha_1.it)('rejects custom classes as value', () => {
        class Foo {
        }
        class FieldPath {
        }
        class FieldValue {
        }
        class GeoPoint {
        }
        class DocumentReference {
        }
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query.where('foo', '==', new Foo()).get();
        }).to.throw('Value for argument "value" is not a valid Firestore document. Couldn\'t serialize object of type "Foo". Firestore doesn\'t support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).');
        (0, chai_1.expect)(() => {
            query.where('foo', '==', new FieldPath()).get();
        }).to.throw('Detected an object of type "FieldPath" that doesn\'t match the expected instance.');
        (0, chai_1.expect)(() => {
            query.where('foo', '==', new FieldValue()).get();
        }).to.throw('Detected an object of type "FieldValue" that doesn\'t match the expected instance.');
        (0, chai_1.expect)(() => {
            query.where('foo', '==', new DocumentReference()).get();
        }).to.throw('Detected an object of type "DocumentReference" that doesn\'t match the expected instance.');
        (0, chai_1.expect)(() => {
            query.where('foo', '==', new GeoPoint()).get();
        }).to.throw('Detected an object of type "GeoPoint" that doesn\'t match the expected instance.');
    });
    (0, mocha_1.it)('supports unary filters', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, unaryFiltersQuery('foo', 'IS_NAN', 'bar', 'IS_NULL'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo', '==', NaN);
            query = query.where('bar', '==', null);
            return query.get();
        });
    });
    (0, mocha_1.it)('supports unary filters', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, unaryFiltersQuery('foo', 'IS_NOT_NAN', 'bar', 'IS_NOT_NULL'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where('foo', '!=', NaN);
            query = query.where('bar', '!=', null);
            return query.get();
        });
    });
    (0, mocha_1.it)('rejects invalid NaN filter', () => {
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where('foo', '>', NaN);
            return query.get();
        }).to.throw("Invalid query. You can only perform '==' and '!=' comparisons on NaN.");
    });
    (0, mocha_1.it)('rejects invalid Null filter', () => {
        (0, chai_1.expect)(() => {
            let query = firestore.collection('collectionId');
            query = query.where('foo', '>', null);
            return query.get();
        }).to.throw("Invalid query. You can only perform '==' and '!=' comparisons on Null.");
    });
    (0, mocha_1.it)('verifies field path', () => {
        let query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query = query.where('foo.', '==', 'foobar');
        }).to.throw('Value for argument "fieldPath" is not a valid field path. Paths must not start or end with ".".');
    });
    (0, mocha_1.it)('verifies operator', () => {
        let query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query = query.where('foo', '@', 'foobar');
        }).to.throw('Value for argument "opStr" is invalid. Acceptable values are: <, <=, ==, !=, >, >=, array-contains, in, not-in, array-contains-any');
    });
    (0, mocha_1.it)('supports composite filters - outer OR', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, where(compositeFilter('OR', fieldFilter('a', 'EQUAL', { integerValue: 10 }), compositeFilter('AND', fieldFilter('b', 'EQUAL', { integerValue: 20 }), fieldFilter('c', 'EQUAL', { integerValue: 30 }), compositeFilter('OR', fieldFilter('d', 'EQUAL', { integerValue: 40 }), fieldFilter('e', 'GREATER_THAN', { integerValue: 50 })), unaryFilters('f', 'IS_NAN')))));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 10), filter_1.Filter.and(filter_1.Filter.where('b', '==', 20), filter_1.Filter.where('c', '==', 30), filter_1.Filter.or(filter_1.Filter.where('d', '==', 40), filter_1.Filter.where('e', '>', 50)), filter_1.Filter.or(filter_1.Filter.where('f', '==', NaN)), filter_1.Filter.and(filter_1.Filter.or()))));
            return query.get();
        });
    });
    (0, mocha_1.it)('supports composite filters - outer AND', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, where(compositeFilter('AND', fieldFilter('a', 'EQUAL', { integerValue: 10 }), compositeFilter('OR', fieldFilter('b', 'EQUAL', { integerValue: 20 }), fieldFilter('c', 'EQUAL', { integerValue: 30 }), compositeFilter('AND', fieldFilter('d', 'EQUAL', { integerValue: 40 }), fieldFilter('e', 'GREATER_THAN', { integerValue: 50 })), unaryFilters('f', 'IS_NAN')))));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where(filter_1.Filter.and(filter_1.Filter.where('a', '==', 10), filter_1.Filter.or(filter_1.Filter.where('b', '==', 20), filter_1.Filter.where('c', '==', 30), filter_1.Filter.and(filter_1.Filter.where('d', '==', 40), filter_1.Filter.where('e', '>', 50)), filter_1.Filter.and(filter_1.Filter.where('f', '==', NaN)), filter_1.Filter.or(filter_1.Filter.and()))));
            return query.get();
        });
    });
    (0, mocha_1.it)('supports implicit AND filters', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, where(compositeFilter('AND', fieldFilter('a', 'EQUAL', { integerValue: 10 }), fieldFilter('b', 'EQUAL', { integerValue: 20 }), fieldFilter('c', 'EQUAL', { integerValue: 30 }), fieldFilter('d', 'EQUAL', { integerValue: 40 }), fieldFilter('e', 'GREATER_THAN', { integerValue: 50 }), unaryFilters('f', 'IS_NAN'))));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query
                .where('a', '==', 10)
                .where('b', '==', 20)
                .where('c', '==', 30)
                .where('d', '==', 40)
                .where('e', '>', 50)
                .where('f', '==', NaN);
            return query.get();
        });
    });
    (0, mocha_1.it)('supports single filter composite filters', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, where(fieldFilter('a', 'GREATER_THAN', { integerValue: 10 })));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        const filters = [
            filter_1.Filter.and(filter_1.Filter.where('a', '>', 10)),
            filter_1.Filter.or(filter_1.Filter.where('a', '>', 10)),
            filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('a', '>', 10))))),
        ];
        return Promise.all(filters.map(filter => (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.where(filter);
            return query.get();
        })));
    });
});
(0, mocha_1.describe)('orderBy() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('accepts empty string', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo');
            return query.get();
        });
    });
    (0, mocha_1.it)('accepts asc', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo', 'asc');
            return query.get();
        });
    });
    (0, mocha_1.it)('accepts desc', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo', 'desc');
            return query.get();
        });
    });
    (0, mocha_1.it)('verifies order', () => {
        let query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query = query.orderBy('foo', 'foo');
        }).to.throw('Value for argument "directionStr" is invalid. Acceptable values are: asc, desc');
    });
    (0, mocha_1.it)('accepts field path', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo.bar', 'ASCENDING', 'bar.foo', 'ASCENDING'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo.bar');
            query = query.orderBy(new src_1.FieldPath('bar', 'foo'));
            return query.get();
        });
    });
    (0, mocha_1.it)('verifies field path', () => {
        let query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query = query.orderBy('foo.');
        }).to.throw('Value for argument "fieldPath" is not a valid field path. Paths must not start or end with ".".');
    });
    (0, mocha_1.it)('rejects call after cursor', () => {
        let query = firestore.collection('collectionId');
        return snapshot('collectionId/doc', { foo: 'bar' }).then(snapshot => {
            (0, chai_1.expect)(() => {
                query = query.orderBy('foo').startAt('foo').orderBy('foo');
            }).to.throw('Cannot specify an orderBy() constraint after calling startAt(), startAfter(), endBefore() or endAt().');
            (0, chai_1.expect)(() => {
                query = query
                    .where('foo', '>', 'bar')
                    .startAt(snapshot)
                    .where('foo', '>', 'bar');
            }).to.throw('Cannot specify a where() filter after calling startAt(), startAfter(), endBefore() or endAt().');
            (0, chai_1.expect)(() => {
                query = query.orderBy('foo').endAt('foo').orderBy('foo');
            }).to.throw('Cannot specify an orderBy() constraint after calling startAt(), startAfter(), endBefore() or endAt().');
            (0, chai_1.expect)(() => {
                query = query
                    .where('foo', '>', 'bar')
                    .endAt(snapshot)
                    .where('foo', '>', 'bar');
            }).to.throw('Cannot specify a where() filter after calling startAt(), startAfter(), endBefore() or endAt().');
        });
    });
    (0, mocha_1.it)('concatenates orders', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'DESCENDING', 'foobar', 'ASCENDING'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query
                .orderBy('foo', 'asc')
                .orderBy('bar', 'desc')
                .orderBy('foobar');
            return query.get();
        });
    });
});
(0, mocha_1.describe)('limit() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, limit(10));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.limit(10);
            return query.get();
        });
    });
    (0, mocha_1.it)('expects number', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.limit(Infinity)).to.throw('Value for argument "limit" is not a valid integer.');
    });
    (0, mocha_1.it)('uses latest limit', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, limit(3));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.limit(1).limit(2).limit(3);
            return query.get();
        });
    });
});
(0, mocha_1.describe)('limitToLast() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('reverses order constraints', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING'), limit(10));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').limitToLast(10);
            return query.get();
        });
    });
    (0, mocha_1.it)('reverses cursors', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING'), startAt(true, 'end'), endAt(false, 'start'), limit(10));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query
                .orderBy('foo')
                .startAt('start')
                .endAt('end')
                .limitToLast(10);
            return query.get();
        });
    });
    (0, mocha_1.it)('reverses results', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING'), limit(2));
                return (0, helpers_1.stream)(result('second'), result('first'));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestoreInstance) => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').limitToLast(2);
            const result = await query.get();
            (0, chai_1.expect)(result.docs[0].id).to.equal('first');
            (0, chai_1.expect)(result.docs[1].id).to.equal('second');
        });
    });
    (0, mocha_1.it)('expects number', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.limitToLast(Infinity)).to.throw('Value for argument "limitToLast" is not a valid integer.');
    });
    (0, mocha_1.it)('requires at least one ordering constraints', () => {
        const query = firestore.collection('collectionId');
        const result = query.limitToLast(1).get();
        return (0, chai_1.expect)(result).to.eventually.be.rejectedWith('limitToLast() queries require specifying at least one orderBy() clause.');
    });
    (0, mocha_1.it)('rejects Query.stream()', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.limitToLast(1).stream()).to.throw('Query results for queries that include limitToLast() constraints cannot be streamed. Use Query.get() instead.');
    });
    (0, mocha_1.it)('uses latest limitToLast', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING'), limit(3));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').limitToLast(1).limitToLast(2).limitToLast(3);
            return query.get();
        });
    });
    (0, mocha_1.it)('converts to bundled query without order reversing', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').limitToLast(10);
            const bundledQuery = query._toBundledQuery();
            bundledQueryEquals(bundledQuery, 'LAST', orderBy('foo', 'ASCENDING'), limit(10));
        });
    });
    (0, mocha_1.it)('converts to bundled query without cursor flipping', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            let query = firestore.collection('collectionId');
            query = query
                .orderBy('foo')
                .startAt('start')
                .endAt('end')
                .limitToLast(10);
            const bundledQuery = query._toBundledQuery();
            bundledQueryEquals(bundledQuery, 'LAST', orderBy('foo', 'ASCENDING'), limit(10), startAt(true, 'start'), endAt(false, 'end'));
        });
    });
    (0, mocha_1.it)('converts to bundled query without order reversing', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').limitToLast(10);
            const bundledQuery = query._toBundledQuery();
            bundledQueryEquals(bundledQuery, 'LAST', orderBy('foo', 'ASCENDING'), limit(10));
        });
    });
    (0, mocha_1.it)('converts to bundled query without cursor flipping', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            let query = firestore.collection('collectionId');
            query = query
                .orderBy('foo')
                .startAt('start')
                .endAt('end')
                .limitToLast(10);
            const bundledQuery = query._toBundledQuery();
            bundledQueryEquals(bundledQuery, 'LAST', orderBy('foo', 'ASCENDING'), limit(10), startAt(true, 'start'), endAt(false, 'end'));
        });
    });
});
(0, mocha_1.describe)('offset() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, offset(10));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.offset(10);
            return query.get();
        });
    });
    (0, mocha_1.it)('expects number', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.offset(Infinity)).to.throw('Value for argument "offset" is not a valid integer.');
    });
    (0, mocha_1.it)('uses latest offset', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, offset(3));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.offset(1).offset(2).offset(3);
            return query.get();
        });
    });
});
(0, mocha_1.describe)('select() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, select('a', 'b.c'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const collection = firestore.collection('collectionId');
            const query = collection.select('a', new src_1.FieldPath('b', 'c'));
            return query.get().then(() => {
                return collection.select('a', 'b.c').get();
            });
        });
    });
    (0, mocha_1.it)('validates field path', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.select(1)).to.throw('Element at index 0 is not a valid field path. Paths can only be specified as strings or via a FieldPath object.');
        (0, chai_1.expect)(() => query.select('.')).to.throw('Element at index 0 is not a valid field path. Paths must not start or end with ".".');
    });
    (0, mocha_1.it)('uses latest field mask', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, select('bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.select('foo').select('bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('implicitly adds FieldPath.documentId()', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, select('__name__'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.select();
            return query.get();
        });
    });
});
(0, mocha_1.describe)('startAt() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('accepts fields', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'), startAt(true, 'foo', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').orderBy('bar').startAt('foo', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('accepts FieldPath.documentId()', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { foo: 'bar' }).then(doc => {
                const query = firestore.collection('collectionId');
                return Promise.all([
                    query.orderBy(src_1.FieldPath.documentId()).startAt(doc.id).get(),
                    query.orderBy(src_1.FieldPath.documentId()).startAt(doc.ref).get(),
                ]);
            });
        });
    });
    (0, mocha_1.it)('validates value for FieldPath.documentId()', () => {
        const query = firestore.collection('coll/doc/coll');
        (0, chai_1.expect)(() => {
            query.orderBy(src_1.FieldPath.documentId()).startAt(42);
        }).to.throw('The corresponding value for FieldPath.documentId() must be a string or a DocumentReference, but was "42".');
        (0, chai_1.expect)(() => {
            query
                .orderBy(src_1.FieldPath.documentId())
                .startAt(firestore.doc('coll/doc/other/doc'));
        }).to.throw('"coll/doc/other/doc" is not part of the query result set and cannot be used as a query boundary.');
        (0, chai_1.expect)(() => {
            query
                .orderBy(src_1.FieldPath.documentId())
                .startAt(firestore.doc('coll/doc/coll_suffix/doc'));
        }).to.throw('"coll/doc/coll_suffix/doc" is not part of the query result set and cannot be used as a query boundary.');
        (0, chai_1.expect)(() => {
            query.orderBy(src_1.FieldPath.documentId()).startAt(firestore.doc('coll/doc'));
        }).to.throw('"coll/doc" is not part of the query result set and cannot be used as a query boundary.');
        (0, chai_1.expect)(() => {
            query
                .orderBy(src_1.FieldPath.documentId())
                .startAt(firestore.doc('coll/doc/coll/doc/coll/doc'));
        }).to.throw('Only a direct child can be used as a query boundary. Found: "coll/doc/coll/doc/coll/doc".');
        // Validate that we can't pass a reference to a collection.
        (0, chai_1.expect)(() => {
            query.orderBy(src_1.FieldPath.documentId()).startAt('doc/coll');
        }).to.throw('When querying a collection and ordering by FieldPath.documentId(), ' +
            'the corresponding value must be a plain document ID, but ' +
            "'doc/coll' contains a slash.");
    });
    (0, mocha_1.it)('requires at least one value', () => {
        const query = firestore.collection('coll/doc/coll');
        (0, chai_1.expect)(() => {
            query.startAt();
        }).to.throw('Function "Query.startAt()" requires at least 1 argument.');
    });
    (0, mocha_1.it)('can specify document snapshot', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', {}).then(doc => {
                const query = firestore.collection('collectionId').startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)("doesn't append documentId() twice", () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', {}).then(doc => {
                const query = firestore
                    .collection('collectionId')
                    .orderBy(src_1.FieldPath.documentId())
                    .startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)('appends orderBy for DocumentReference cursors', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { foo: 'bar' }).then(doc => {
                let query = firestore.collection('collectionId');
                query = query.startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)('can extract implicit direction for document snapshot', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'bar', {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { foo: 'bar' }).then(doc => {
                let query = firestore.collection('collectionId').orderBy('foo');
                query = query.startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)('can extract explicit direction for document snapshot', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'DESCENDING', '__name__', 'DESCENDING'), startAt(true, 'bar', {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { foo: 'bar' }).then(doc => {
                let query = firestore
                    .collection('collectionId')
                    .orderBy('foo', 'desc');
                query = query.startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)('can specify document snapshot with inequality filter', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('c', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'c', {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }), fieldFiltersQuery('a', 'EQUAL', 'a', 'b', 'ARRAY_CONTAINS', 'b', 'c', 'GREATER_THAN_OR_EQUAL', 'c', 'd', 'EQUAL', 'd'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { c: 'c' }).then(doc => {
                const query = firestore
                    .collection('collectionId')
                    .where('a', '==', 'a')
                    .where('b', 'array-contains', 'b')
                    .where('c', '>=', 'c')
                    .where('d', '==', 'd')
                    .startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.it)('ignores equality filter with document snapshot cursor', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('__name__', 'ASCENDING'), startAt(true, {
                    referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                        'documents/collectionId/doc',
                }), fieldFiltersQuery('foo', 'EQUAL', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            return snapshot('collectionId/doc', { foo: 'bar' }).then(doc => {
                const query = firestore
                    .collection('collectionId')
                    .where('foo', '==', 'bar')
                    .startAt(doc);
                return query.get();
            });
        });
    });
    (0, mocha_1.describe)('inequality fields are implicitly ordered lexicographically for cursors', () => {
        (0, mocha_1.it)('upper and lower case characters', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('A', 'ASCENDING', 'a', 'ASCENDING', 'aa', 'ASCENDING', 'b', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'A', 'a', 'aa', 'b', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('a', 'LESS_THAN', 'value', 'a', 'GREATER_THAN_OR_EQUAL', 'value', 'aa', 'GREATER_THAN', 'value', 'b', 'GREATER_THAN', 'value', 'A', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    aa: 'aa',
                    b: 'b',
                    A: 'A',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'value')
                        .where('a', '>=', 'value')
                        .where('aa', '>', 'value')
                        .where('b', '>', 'value')
                        .where('A', '>', 'value')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('characters and numbers', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('`1`', 'ASCENDING', '`19`', 'ASCENDING', '`2`', 'ASCENDING', 'a', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, '1', '19', '2', 'a', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('a', 'LESS_THAN', 'value', '`1`', 'GREATER_THAN', 'value', '`19`', 'GREATER_THAN', 'value', '`2`', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    1: '1',
                    19: '19',
                    2: '2',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'value')
                        .where('1', '>', 'value')
                        .where('19', '>', 'value')
                        .where('2', '>', 'value')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('nested fields', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('a', 'ASCENDING', 'a.a', 'ASCENDING', 'aa', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, {
                        mapValue: {
                            fields: {
                                a: {
                                    stringValue: 'a.a',
                                },
                            },
                        },
                    }, 'a.a', 'aa', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('a', 'LESS_THAN', 'value', 'a.a', 'GREATER_THAN', 'value', 'aa', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', { a: { a: 'a.a' }, aa: 'aa' }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'value')
                        .where('a.a', '>', 'value')
                        .where('aa', '>', 'value')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('special characters', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('_a', 'ASCENDING', 'a', 'ASCENDING', 'a.a', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, '_a', {
                        mapValue: {
                            fields: {
                                a: {
                                    stringValue: 'a.a',
                                },
                            },
                        },
                    }, 'a.a', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('a', 'LESS_THAN', 'a', '_a', 'GREATER_THAN', '_a', 'a.a', 'GREATER_THAN', 'a.a'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', { a: { a: 'a.a' }, _a: '_a' }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'a')
                        .where('_a', '>', '_a')
                        .where('a.a', '>', 'a.a')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('field name with dot', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('a', 'ASCENDING', 'a.z', 'ASCENDING', '`a.a`', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, {
                        mapValue: {
                            fields: {
                                z: {
                                    stringValue: 'a.z',
                                },
                            },
                        },
                    }, 'a.z', 'a.a', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('a', 'LESS_THAN', 'value', '`a.a`', 'GREATER_THAN', 'value', 'a.z', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', { a: { z: 'a.z' }, 'a.a': 'a.a' }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'value')
                        .where(new src_1.FieldPath('a.a'), '>', 'value') // field name with dot
                        .where('a.z', '>', 'value') // nested field
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('composite filter', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('a', 'ASCENDING', 'b', 'ASCENDING', 'c', 'ASCENDING', 'd', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'a', 'b', 'c', 'd', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), where(compositeFilter('AND', fieldFilter('a', 'LESS_THAN', 'value'), compositeFilter('AND', compositeFilter('OR', fieldFilter('b', 'GREATER_THAN_OR_EQUAL', 'value'), fieldFilter('c', 'LESS_THAN_OR_EQUAL', 'value')), compositeFilter('OR', fieldFilter('d', 'GREATER_THAN', 'value'), fieldFilter('e', 'EQUAL', 'value'))))));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    b: 'b',
                    c: 'c',
                    d: 'd',
                    e: 'e',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('a', '<', 'value')
                        .where(filter_1.Filter.and(filter_1.Filter.or(filter_1.Filter.where('b', '>=', 'value'), filter_1.Filter.where('c', '<=', 'value')), filter_1.Filter.or(filter_1.Filter.where('d', '>', 'value'), filter_1.Filter.where('e', '==', 'value'))))
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('explicit orderby', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('z', 'ASCENDING', 'a', 'ASCENDING', 'b', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'z', 'a', 'b', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('b', 'LESS_THAN', 'value', 'a', 'GREATER_THAN', 'value', 'z', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    b: 'b',
                    z: 'z',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('b', '<', 'value')
                        .where('a', '>', 'value')
                        .where('z', '>', 'value')
                        .orderBy('z')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('explicit order by direction', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('z', 'DESCENDING', 'a', 'DESCENDING', 'b', 'DESCENDING', '__name__', 'DESCENDING'), startAt(true, 'z', 'a', 'b', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('b', 'LESS_THAN', 'value', 'a', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    b: 'b',
                    z: 'z',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('b', '<', 'value')
                        .where('a', '>', 'value')
                        .orderBy('z', 'desc')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
        (0, mocha_1.it)('last explicit order by direction', () => {
            const overrides = {
                runQuery: request => {
                    queryEquals(request, orderBy('z', 'DESCENDING', 'c', 'ASCENDING', 'a', 'ASCENDING', 'b', 'ASCENDING', '__name__', 'ASCENDING'), startAt(true, 'z', 'c', 'a', 'b', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/` +
                            'documents/collectionId/doc',
                    }), fieldFiltersQuery('b', 'LESS_THAN', 'value', 'a', 'GREATER_THAN', 'value'));
                    return (0, helpers_1.emptyQueryStream)();
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                return snapshot('collectionId/doc', {
                    a: 'a',
                    b: 'b',
                    c: 'c',
                    z: 'z',
                }).then(doc => {
                    const query = firestore
                        .collection('collectionId')
                        .where('b', '<', 'value')
                        .where('a', '>', 'value')
                        .orderBy('z', 'desc')
                        .orderBy('c')
                        .startAt(doc);
                    return query.get();
                });
            });
        });
    });
    (0, mocha_1.it)('validates field exists in document snapshot', () => {
        const query = firestore.collection('collectionId').orderBy('foo', 'desc');
        return snapshot('collectionId/doc', {}).then(doc => {
            (0, chai_1.expect)(() => query.startAt(doc)).to.throw('Field "foo" is missing in the provided DocumentSnapshot. Please provide a document that contains values for all specified orderBy() and where() constraints.');
        });
    });
    (0, mocha_1.it)('does not accept field deletes', () => {
        const query = firestore.collection('collectionId').orderBy('foo');
        (0, chai_1.expect)(() => {
            query.orderBy('foo').startAt('foo', src_1.FieldValue.delete());
        }).to.throw('Element at index 1 is not a valid query constraint. FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true}.');
    });
    (0, mocha_1.it)('requires order by', () => {
        let query = firestore.collection('collectionId');
        query = query.orderBy('foo');
        (0, chai_1.expect)(() => query.startAt('foo', 'bar')).to.throw('Too many cursor values specified. The specified values must match the orderBy() constraints of the query.');
    });
    (0, mocha_1.it)('can overspecify order by', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'), startAt(true, 'foo'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').orderBy('bar').startAt('foo');
            return query.get();
        });
    });
    (0, mocha_1.it)('validates input', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.startAt(123)).to.throw('Too many cursor values specified. The specified values must match the orderBy() constraints of the query.');
    });
    (0, mocha_1.it)('uses latest value', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'), startAt(true, 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').startAt('foo').startAt('bar');
            return query.get();
        });
    });
});
(0, mocha_1.describe)('startAfter() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('accepts fields', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'), startAt(false, 'foo', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').orderBy('bar').startAfter('foo', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('validates input', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.startAfter(123)).to.throw('Too many cursor values specified. The specified values must match the orderBy() constraints of the query.');
    });
    (0, mocha_1.it)('uses latest value', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'), startAt(false, 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').startAfter('foo').startAfter('bar');
            return query.get();
        });
    });
});
(0, mocha_1.describe)('endAt() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('accepts fields', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'), endAt(false, 'foo', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').orderBy('bar').endAt('foo', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('validates input', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.endAt(123)).to.throw('Too many cursor values specified. The specified values must match the orderBy() constraints of the query.');
    });
    (0, mocha_1.it)('uses latest value', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'), endAt(false, 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').endAt('foo').endAt('bar');
            return query.get();
        });
    });
});
(0, mocha_1.describe)('endBefore() interface', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('accepts fields', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING', 'bar', 'ASCENDING'), endAt(true, 'foo', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').orderBy('bar').endBefore('foo', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('validates input', () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => query.endBefore(123)).to.throw('Too many cursor values specified. The specified values must match the orderBy() constraints of the query.');
    });
    (0, mocha_1.it)('uses latest value', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, orderBy('foo', 'ASCENDING'), endAt(true, 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            let query = firestore.collection('collectionId');
            query = query.orderBy('foo').endBefore('foo').endBefore('bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('is immutable', () => {
        let expectedComponents = [limit(10)];
        const overrides = {
            runQuery: request => {
                queryEquals(request, ...expectedComponents);
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId').limit(10);
            const adjustedQuery = query.orderBy('foo').endBefore('foo');
            return query.get().then(() => {
                expectedComponents = [
                    limit(10),
                    orderBy('foo', 'ASCENDING'),
                    endAt(true, 'foo'),
                ];
                return adjustedQuery.get();
            });
        });
    });
});
(0, mocha_1.describe)('collectionGroup queries', () => {
    (0, mocha_1.it)('serialize correctly', () => {
        const overrides = {
            runQuery: request => {
                queryEquals(request, allDescendants(), fieldFiltersQuery('foo', 'EQUAL', 'bar'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            const query = firestore
                .collectionGroup('collectionId')
                .where('foo', '==', 'bar');
            return query.get();
        });
    });
    (0, mocha_1.it)('rejects slashes', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            (0, chai_1.expect)(() => firestore.collectionGroup('foo/bar')).to.throw("Invalid collectionId 'foo/bar'. Collection IDs must not contain '/'.");
        });
    });
    (0, mocha_1.it)('rejects slashes', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            const query = firestore.collectionGroup('collectionId');
            (0, chai_1.expect)(() => {
                query.orderBy(src_1.FieldPath.documentId()).startAt('coll');
            }).to.throw('When querying a collection group and ordering by ' +
                'FieldPath.documentId(), the corresponding value must result in a ' +
                "valid document path, but 'coll' is not because it contains an odd " +
                'number of segments.');
        });
    });
});
(0, mocha_1.describe)('query resumption', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        (0, backoff_1.setTimeoutHandler)(setImmediate);
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(async () => {
        await (0, helpers_1.verifyInstance)(firestore);
        (0, backoff_1.setTimeoutHandler)(setTimeout);
    });
    // Return `numDocs` document responses, followed by an error response.
    function* getDocResponsesFollowedByError(documentIds, numDocs, error, startAtEnd) {
        assert(numDocs <= documentIds.length);
        const sliced = startAtEnd
            ? documentIds.slice(-1 * numDocs)
            : documentIds.slice(0, numDocs);
        let runQueryResponses = sliced.map(documentId => result(documentId));
        if (startAtEnd) {
            runQueryResponses = runQueryResponses.reverse();
        }
        for (const runQueryResponse of runQueryResponses) {
            yield runQueryResponse;
        }
        yield error;
    }
    // Returns the documents from the given `documentIds` starting at the cursor
    // determined by `startAt` (or `endAt`) in the request. It will continue to
    // return documents until either the request `limit` is reached or `numDocs`
    // (if provided) is reached. If an `error` is provided, it will return the
    // given error after the docs are returned.
    function* getDocResponsesForRequest(request, documentIds, options) {
        var _b, _c, _d, _e;
        let begin;
        let end;
        let reverseOrder;
        if ((_b = request.structuredQuery) === null || _b === void 0 ? void 0 : _b.startAt) {
            begin = getStartAtDocumentIndex(request, documentIds);
            if (begin === null) {
                throw new Error('the request should specify a valid startAt');
            }
            if ((_c = request.structuredQuery.limit) === null || _c === void 0 ? void 0 : _c.value) {
                end = begin + request.structuredQuery.limit.value;
            }
            else {
                end = undefined;
            }
            reverseOrder = false;
        }
        else if ((_d = request.structuredQuery) === null || _d === void 0 ? void 0 : _d.endAt) {
            end = getEndAtDocumentIndex(request, documentIds);
            if (end === null) {
                throw new Error('the request should specify a valid endAt');
            }
            if ((_e = request.structuredQuery.limit) === null || _e === void 0 ? void 0 : _e.value) {
                begin = end - request.structuredQuery.limit.value;
            }
            else {
                begin = undefined;
            }
            reverseOrder = true;
        }
        else {
            throw new Error('the request does not specify a valid startAt or endAt');
        }
        const runQueryResponses = documentIds
            .slice(begin, end)
            .map(documentId => result(documentId));
        let numDocsReturned = 0;
        for (const runQueryResponse of reverseOrder
            ? runQueryResponses.reverse()
            : runQueryResponses) {
            // If `numDocs` is provided, stop iterating when it is reached.
            if ((options === null || options === void 0 ? void 0 : options.numDocs) && numDocsReturned === options.numDocs) {
                break;
            }
            numDocsReturned++;
            yield runQueryResponse;
        }
        // If `error` is provided, emit it after all the docs.
        if (options === null || options === void 0 ? void 0 : options.error) {
            yield options.error;
        }
    }
    // Finds the index in `documentIds` of the document referred to in the
    // "startAt" of the given request. Returns `null` if it cannot find one.
    function getStartAtDocumentIndex(request, documentIds) {
        var _b, _c, _d;
        const startAt = (_b = request.structuredQuery) === null || _b === void 0 ? void 0 : _b.startAt;
        const startAtValue = (_d = (_c = startAt === null || startAt === void 0 ? void 0 : startAt.values) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.referenceValue;
        const startAtBefore = startAt === null || startAt === void 0 ? void 0 : startAt.before;
        if (typeof startAtValue !== 'string') {
            return null;
        }
        const docId = startAtValue.split('/').pop();
        const docIdIndex = documentIds.indexOf(docId);
        if (docIdIndex < 0) {
            return null;
        }
        return startAtBefore ? docIdIndex : docIdIndex + 1;
    }
    // Finds the index in `documentIds` of the document referred to in the
    // "endAt" of the given request. Returns `null` if it cannot find one.
    function getEndAtDocumentIndex(request, documentIds) {
        var _b, _c, _d;
        const endAt = (_b = request.structuredQuery) === null || _b === void 0 ? void 0 : _b.endAt;
        const endAtValue = (_d = (_c = endAt === null || endAt === void 0 ? void 0 : endAt.values) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.referenceValue;
        const endAtBefore = endAt === null || endAt === void 0 ? void 0 : endAt.before;
        if (typeof endAtValue !== 'string') {
            return null;
        }
        const docId = endAtValue.split('/').pop();
        const docIdIndex = documentIds.indexOf(docId);
        if (docIdIndex < 0) {
            return null;
        }
        return endAtBefore ? docIdIndex : docIdIndex - 1;
    }
    // Prevent regression of
    // https://github.com/googleapis/nodejs-firestore/issues/1790
    (0, mocha_1.it)('results should not be double produced on retryable error with back pressure', async () => {
        // Generate the IDs of the documents that will match the query.
        const documentIds = Array.from(new Array(500), (_, index) => `doc${index}`);
        // Set up the mocked responses from Watch.
        let requestNum = 0;
        const overrides = {
            runQuery: request => {
                requestNum++;
                switch (requestNum) {
                    case 1:
                        // Return the first half of the documents, followed by a retryable error.
                        return (0, helpers_1.stream)(...getDocResponsesFollowedByError(documentIds, documentIds.length / 2, new google_gax_1.GoogleError('simulated retryable error')));
                    case 2:
                        // Return the remaining documents.
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds));
                    default:
                        throw new Error(`should never get here (requestNum=${requestNum})`);
                }
            },
        };
        // Create an async iterator to get the result set.
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId');
        query._queryUtil._isPermanentRpcError = () => false;
        const iterator = query
            .stream()[Symbol.asyncIterator]();
        const snapshots = await (0, helpers_1.collect)(iterator);
        // Verify that the async iterator returned the correct documents and,
        // especially, does not have duplicate results.
        const actualDocumentIds = snapshots.map(snapshot => snapshot.id);
        (0, chai_1.expect)(actualDocumentIds).to.eql(documentIds);
    });
    (0, mocha_1.it)('resuming queries with a cursor should respect the original query limit', async () => {
        // Generate the IDs of the documents that will match the query.
        const documentIds = Array.from(new Array(500), (_, index) => `doc${index}`);
        // Set up the mocked responses from Watch.
        let requestNum = 0;
        const overrides = {
            runQuery: request => {
                requestNum++;
                switch (requestNum) {
                    case 1:
                        return (0, helpers_1.stream)(...getDocResponsesFollowedByError(documentIds, documentIds.length / 2, new google_gax_1.GoogleError('simulated retryable error')));
                    case 2:
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds));
                    default:
                        throw new Error(`should never get here (requestNum=${requestNum})`);
                }
            },
        };
        // Create an async iterator to get the result set.
        const limit = 300;
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId').limit(limit);
        query._queryUtil._isPermanentRpcError = () => false;
        const iterator = query
            .stream()[Symbol.asyncIterator]();
        const snapshots = await (0, helpers_1.collect)(iterator);
        // Verify that we got the correct number of results, and the results match
        // the documents we expect.
        const actualDocumentIds = snapshots.map(snapshot => snapshot.id);
        (0, chai_1.expect)(actualDocumentIds.length).to.eql(limit);
        (0, chai_1.expect)(actualDocumentIds).to.eql(documentIds.slice(0, limit));
    });
    (0, mocha_1.it)('resuming queries with a cursor should respect the original query limitToLast', async () => {
        // Generate the IDs of the documents that will match the query.
        const documentIds = Array.from(new Array(500), (_, index) => `doc${index}`);
        // Set up the mocked responses from Watch.
        let requestNum = 0;
        const overrides = {
            runQuery: request => {
                requestNum++;
                switch (requestNum) {
                    case 1:
                        return (0, helpers_1.stream)(...getDocResponsesFollowedByError(documentIds, documentIds.length / 2, new google_gax_1.GoogleError('simulated retryable error'), 
                        /*startAtEnd*/ true));
                    case 2:
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds));
                    default:
                        throw new Error(`should never get here (requestNum=${requestNum})`);
                }
            },
        };
        // `stream()` cannot be called for `limitToLast` queries. We can, however,
        // test using the `.get()` method which does some additional processing.
        const limit = 300;
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore
            .collection('collectionId')
            .orderBy(src_1.FieldPath.documentId())
            .limitToLast(limit);
        query._queryUtil._isPermanentRpcError = () => false;
        const snapshots = await query.get();
        // Verify that we got the correct number of results, and the results match
        // the documents we expect.
        const actualDocumentIds = snapshots.docs.map(snapshot => snapshot.id);
        (0, chai_1.expect)(actualDocumentIds.length).to.eql(limit);
        // slice(-limit) returns the last `limit` documents in the array.
        (0, chai_1.expect)(actualDocumentIds).to.eql(documentIds.slice(-limit));
    });
    (0, mocha_1.it)('resuming queries with multiple failures should respect the original limit', async () => {
        // Generate the IDs of the documents that will match the query.
        const documentIds = Array.from(new Array(600), (_, index) => `doc${index}`);
        // Set up the mocked responses from Watch.
        let requestNum = 0;
        const overrides = {
            runQuery: request => {
                requestNum++;
                switch (requestNum) {
                    case 1:
                        // Get the first 60 documents followed by a retryable error.
                        return (0, helpers_1.stream)(...getDocResponsesFollowedByError(documentIds, documentIds.length / 10, new google_gax_1.GoogleError('simulated retryable error')));
                    case 2:
                        // Get the another 120 documents followed by a retryable error.
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds, {
                            numDocs: documentIds.length / 5,
                            error: new google_gax_1.GoogleError('simulated retryable error'),
                        }));
                    case 3:
                        // Get the rest of the documents.
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds));
                    default:
                        throw new Error(`should never get here (requestNum=${requestNum})`);
                }
            },
        };
        // Create an async iterator to get the result set.
        const limit = 300;
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId').limit(limit);
        query._queryUtil._isPermanentRpcError = () => false;
        const iterator = query
            .stream()[Symbol.asyncIterator]();
        const snapshots = await (0, helpers_1.collect)(iterator);
        // Verify that we got the correct number of results, and the results match
        // the documents we expect.
        const actualDocumentIds = snapshots.map(snapshot => snapshot.id);
        (0, chai_1.expect)(actualDocumentIds.length).to.eql(limit);
        (0, chai_1.expect)(actualDocumentIds).to.eql(documentIds.slice(0, limit));
    });
    (0, mocha_1.it)('resuming queries with multiple failures should respect the original limitToLast', async () => {
        // Generate the IDs of the documents that will match the query.
        const documentIds = Array.from(new Array(600), (_, index) => `doc${index}`);
        // Set up the mocked responses from Watch.
        let requestNum = 0;
        const overrides = {
            runQuery: request => {
                requestNum++;
                switch (requestNum) {
                    case 1:
                        // Get the first 60 documents followed by a retryable error.
                        return (0, helpers_1.stream)(...getDocResponsesFollowedByError(documentIds, documentIds.length / 10, new google_gax_1.GoogleError('simulated retryable error'), 
                        /*startAtEnd*/ true));
                    case 2:
                        // Get the another 120 documents followed by a retryable error.
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds, {
                            numDocs: documentIds.length / 5,
                            error: new google_gax_1.GoogleError('simulated retryable error'),
                        }));
                    case 3:
                        // Get the rest of the documents.
                        return (0, helpers_1.stream)(...getDocResponsesForRequest(request, documentIds));
                    default:
                        throw new Error(`should never get here (requestNum=${requestNum})`);
                }
            },
        };
        // `stream()` cannot be called for `limitToLast` queries. We can, however,
        // test using the `.get()` method which does some additional processing.
        const limit = 300;
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore
            .collection('collectionId')
            .orderBy(src_1.FieldPath.documentId())
            .limitToLast(limit);
        query._queryUtil._isPermanentRpcError = () => false;
        const snapshots = await query.get();
        // Verify that we got the correct number of results, and the results match
        // the documents we expect.
        const actualDocumentIds = snapshots.docs.map(snapshot => snapshot.id);
        (0, chai_1.expect)(actualDocumentIds.length).to.eql(limit);
        // slice(-limit) returns the last `limit` documents in the array.
        (0, chai_1.expect)(actualDocumentIds).to.eql(documentIds.slice(-limit));
    });
});
//# sourceMappingURL=query.js.map
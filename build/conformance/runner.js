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
const duplexify = require("duplexify");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const path = require("path");
const fs = require("fs");
const protobufjs = require("protobufjs");
const through2 = require("through2");
const src_1 = require("../src");
const convert_1 = require("../src/convert");
const path_1 = require("../src/path");
const util_1 = require("../src/util");
const helpers_1 = require("../test/util/helpers");
/** List of test cases that are ignored. */
const ignoredRe = [];
/** If non-empty, list the test cases to run exclusively. */
const exclusiveRe = [];
// The project ID used in the conformance test protos.
const CONFORMANCE_TEST_PROJECT_ID = 'projectID';
// Load Protobuf definition and types
const protobufRoot = new protobufjs.Root();
protobufRoot.resolvePath = (origin, target) => {
    if (/^google\/.*/.test(target)) {
        target = path.join(__dirname, '../protos', target);
    }
    return target;
};
const protoDefinition = protobufRoot.loadSync(path.join(__dirname, 'test-definition.proto'));
const TEST_SUITE_TYPE = protoDefinition.lookupType('tests.TestFile');
const STRUCTURED_QUERY_TYPE = protoDefinition.lookupType('google.firestore.v1.StructuredQuery');
const COMMIT_REQUEST_TYPE = protoDefinition.lookupType('google.firestore.v1.CommitRequest');
// Firestore instance initialized by the test runner.
let firestore;
const docRef = (path) => {
    const resourcePath = path_1.QualifiedResourcePath.fromSlashSeparatedString(path);
    return firestore.doc(resourcePath.relativeName);
};
const collRef = (path) => {
    const resourcePath = path_1.QualifiedResourcePath.fromSlashSeparatedString(path);
    return firestore.collection(resourcePath.relativeName);
};
const watchQuery = () => {
    return firestore.collection('C').orderBy('a');
};
const createInstance = (overrides) => {
    return (0, helpers_1.createInstance)(overrides, {
        projectId: CONFORMANCE_TEST_PROJECT_ID,
    }).then(firestoreClient => {
        firestore = firestoreClient;
    });
};
/** Converts JSON test data into JavaScript types suitable for the Node API. */
const convertInput = {
    argument: (json) => {
        const obj = JSON.parse(json);
        function convertValue(value) {
            if ((0, util_1.isObject)(value)) {
                return convertObject(value);
            }
            else if (Array.isArray(value)) {
                return convertArray(value);
            }
            else if (value === 'NaN') {
                return NaN;
            }
            else if (value === 'Delete') {
                return src_1.FieldValue.delete();
            }
            else if (value === 'ServerTimestamp') {
                return src_1.FieldValue.serverTimestamp();
            }
            return value;
        }
        function convertArray(arr) {
            if (arr.length > 0 && arr[0] === 'ArrayUnion') {
                return src_1.FieldValue.arrayUnion(...convertArray(arr.slice(1)));
            }
            else if (arr.length > 0 && arr[0] === 'ArrayRemove') {
                return src_1.FieldValue.arrayRemove(...convertArray(arr.slice(1)));
            }
            else {
                for (let i = 0; i < arr.length; ++i) {
                    arr[i] = convertValue(arr[i]);
                }
                return arr;
            }
        }
        function convertObject(obj) {
            for (const key of Object.keys(obj)) {
                obj[key] = convertValue(obj[key]);
            }
            return obj;
        }
        return convertValue(obj);
    },
    precondition: (precondition) => {
        const deepCopy = JSON.parse(JSON.stringify(precondition));
        if (deepCopy.updateTime) {
            deepCopy.lastUpdateTime = src_1.Timestamp.fromProto({
                seconds: deepCopy.updateTime.seconds,
                nanos: deepCopy.updateTime.nanos,
            });
            delete deepCopy.updateTime;
        }
        return deepCopy;
    },
    path: (path) => {
        if (path.field.length === 1 && path.field[0] === '__name__') {
            return src_1.FieldPath.documentId();
        }
        return new src_1.FieldPath(...path.field);
    },
    paths: (fields) => {
        const convertedPaths = [];
        if (fields) {
            for (const field of fields) {
                convertedPaths.push(convertInput.path(field));
            }
        }
        else {
            convertedPaths.push(src_1.FieldPath.documentId());
        }
        return convertedPaths;
    },
    cursor: (cursor) => {
        const args = [];
        if (cursor.docSnapshot) {
            args.push(src_1.DocumentSnapshot.fromObject(docRef(cursor.docSnapshot.path), convertInput.argument(cursor.docSnapshot.jsonData)));
        }
        else {
            for (const jsonValue of cursor.jsonValues) {
                args.push(convertInput.argument(jsonValue));
            }
        }
        return args;
    },
    snapshot: (snapshot) => {
        const docs = [];
        const changes = [];
        const readTime = src_1.Timestamp.fromProto(snapshot.readTime);
        for (const doc of snapshot.docs) {
            const deepCopy = JSON.parse(JSON.stringify(doc));
            deepCopy.fields = (0, convert_1.fieldsFromJson)(deepCopy.fields);
            docs.push(firestore.snapshot_(deepCopy, readTime.toDate().toISOString(), 'json'));
        }
        for (const change of snapshot.changes) {
            const deepCopy = JSON.parse(JSON.stringify(change.doc));
            deepCopy.fields = (0, convert_1.fieldsFromJson)(deepCopy.fields);
            const doc = firestore.snapshot_(deepCopy, readTime.toDate().toISOString(), 'json');
            const type = ['unspecified', 'added', 'removed', 'modified'][change.kind];
            changes.push(new src_1.DocumentChange(type, doc, change.oldIndex, change.newIndex));
        }
        return new src_1.QuerySnapshot(watchQuery(), readTime, docs.length, () => docs, () => changes);
    },
};
/** Converts Firestore Protobuf types in Proto3 JSON format to Protobuf JS. */
const convertProto = {
    targetChange: (type) => type || 'NO_CHANGE',
    listenResponse: (listenRequest) => {
        const deepCopy = JSON.parse(JSON.stringify(listenRequest));
        if (deepCopy.targetChange) {
            deepCopy.targetChange.targetChangeType = convertProto.targetChange(deepCopy.targetChange.targetChangeType);
        }
        if (deepCopy.documentChange) {
            deepCopy.documentChange.document.fields = (0, convert_1.fieldsFromJson)(deepCopy.documentChange.document.fields);
        }
        return deepCopy;
    },
};
/** Request handler for _commit. */
function commitHandler(spec) {
    return request => {
        const actualCommit = COMMIT_REQUEST_TYPE.fromObject(request);
        const expectedCommit = COMMIT_REQUEST_TYPE.fromObject(spec.request);
        (0, chai_1.expect)(actualCommit).to.deep.equal(expectedCommit);
        const res = {
            commitTime: {},
            writeResults: [],
        };
        for (let i = 1; i <= request.writes.length; ++i) {
            res.writeResults.push({
                updateTime: {},
            });
        }
        return (0, helpers_1.response)(res);
    };
}
/** Request handler for _runQuery. */
function queryHandler(spec) {
    return (request) => {
        const actualQuery = STRUCTURED_QUERY_TYPE.fromObject(request.structuredQuery);
        const expectedQuery = STRUCTURED_QUERY_TYPE.fromObject(spec.query);
        (0, chai_1.expect)(actualQuery).to.deep.equal(expectedQuery);
        const stream = through2.obj();
        setImmediate(() => {
            // Empty query always emits a readTime
            stream.push({ readTime: { seconds: 0, nanos: 0 } });
            stream.push(null);
        });
        return stream;
    };
}
/** Request handler for _batchGetDocuments. */
function getHandler(spec) {
    return (request) => {
        const getDocument = spec.request;
        (0, chai_1.expect)(request.documents[0]).to.equal(getDocument.name);
        const stream = through2.obj();
        setImmediate(() => {
            stream.push({
                missing: getDocument.name,
                readTime: { seconds: 0, nanos: 0 },
            });
            stream.push(null);
        });
        return stream;
    };
}
function runTest(spec) {
    console.log(`Running Spec:\n${JSON.stringify(spec, null, 2)}\n`);
    const updateTest = (spec) => {
        const overrides = { commit: commitHandler(spec) };
        return createInstance(overrides).then(() => {
            const varargs = [];
            if (spec.jsonData) {
                varargs[0] = convertInput.argument(spec.jsonData);
            }
            else {
                for (let i = 0; i < spec.fieldPaths.length; ++i) {
                    varargs[2 * i] = new src_1.FieldPath(...spec.fieldPaths[i].field);
                }
                for (let i = 0; i < spec.jsonValues.length; ++i) {
                    varargs[2 * i + 1] = convertInput.argument(spec.jsonValues[i]);
                }
            }
            if (spec.precondition) {
                varargs.push(convertInput.precondition(spec.precondition));
            }
            const document = docRef(spec.docRefPath);
            return document.update(varargs[0], ...varargs.slice(1));
        });
    };
    const queryTest = (spec) => {
        const overrides = { runQuery: queryHandler(spec) };
        const applyClause = (query, clause) => {
            if (clause.select) {
                query = query.select(...convertInput.paths(clause.select.fields));
            }
            else if (clause.where) {
                const fieldPath = convertInput.path(clause.where.path);
                const value = convertInput.argument(clause.where.jsonValue);
                query = query.where(fieldPath, clause.where.op, value);
            }
            else if (clause.orderBy) {
                const fieldPath = convertInput.path(clause.orderBy.path);
                query = query.orderBy(fieldPath, clause.orderBy.direction);
            }
            else if (clause.offset) {
                query = query.offset(clause.offset);
            }
            else if (clause.limit) {
                query = query.limit(clause.limit);
            }
            else if (clause.startAt) {
                const cursor = convertInput.cursor(clause.startAt);
                query = query.startAt(...cursor);
            }
            else if (clause.startAfter) {
                const cursor = convertInput.cursor(clause.startAfter);
                query = query.startAfter(...cursor);
            }
            else if (clause.endAt) {
                const cursor = convertInput.cursor(clause.endAt);
                query = query.endAt(...cursor);
            }
            else if (clause.endBefore) {
                const cursor = convertInput.cursor(clause.endBefore);
                query = query.endBefore(...cursor);
            }
            return query;
        };
        return createInstance(overrides).then(() => {
            let query = collRef(spec.collPath);
            for (const clause of spec.clauses) {
                query = applyClause(query, clause);
            }
            return query.get();
        });
    };
    const deleteTest = (spec) => {
        const overrides = { commit: commitHandler(spec) };
        return createInstance(overrides).then(() => {
            if (spec.precondition) {
                const precondition = convertInput.precondition(deleteSpec.precondition);
                return docRef(spec.docRefPath).delete(precondition);
            }
            else {
                return docRef(spec.docRefPath).delete();
            }
        });
    };
    const setTest = (spec) => {
        const overrides = { commit: commitHandler(spec) };
        return createInstance(overrides).then(() => {
            const setOption = {};
            if (spec.option && spec.option.all) {
                setOption.merge = true;
            }
            else if (spec.option && spec.option.fields) {
                setOption.mergeFields = [];
                for (const fieldPath of spec.option.fields) {
                    setOption.mergeFields.push(new src_1.FieldPath(...fieldPath.field));
                }
            }
            return docRef(setSpec.docRefPath).set(convertInput.argument(spec.jsonData), setOption);
        });
    };
    const createTest = (spec) => {
        const overrides = { commit: commitHandler(spec) };
        return createInstance(overrides).then(() => {
            return docRef(spec.docRefPath).create(convertInput.argument(spec.jsonData));
        });
    };
    const getTest = (spec) => {
        const overrides = { batchGetDocuments: getHandler(spec) };
        return createInstance(overrides).then(() => {
            return docRef(spec.docRefPath).get();
        });
    };
    const watchTest = (spec) => {
        const expectedSnapshots = spec.snapshots;
        const writeStream = through2.obj();
        const overrides = {
            listen: () => duplexify.obj(through2.obj(), writeStream),
        };
        return createInstance(overrides).then(() => {
            return new Promise((resolve, reject) => {
                const unlisten = watchQuery().onSnapshot(actualSnap => {
                    const expectedSnapshot = expectedSnapshots.shift();
                    if (expectedSnapshot) {
                        if (!actualSnap.isEqual(convertInput.snapshot(expectedSnapshot))) {
                            reject(new Error('Expected and actual snapshots do not match.'));
                        }
                        if (expectedSnapshots.length === 0 || !spec.isError) {
                            unlisten();
                            resolve();
                        }
                    }
                    else {
                        reject(new Error('Received unexpected snapshot'));
                    }
                }, err => {
                    (0, chai_1.expect)(expectedSnapshots).to.have.length(0);
                    unlisten();
                    reject(err);
                });
                for (const response of spec.responses) {
                    writeStream.write(convertProto.listenResponse(response));
                }
            });
        });
    };
    let testSpec;
    let testPromise;
    const getSpec = spec.get;
    const createSpec = spec.create;
    const setSpec = spec.set;
    const updateSpec = spec.update || spec.updatePaths;
    const deleteSpec = spec.delete;
    const querySpec = spec.query;
    const listenSpec = spec.listen;
    if (getSpec) {
        testSpec = getSpec;
        testPromise = getTest(getSpec);
    }
    else if (createSpec) {
        testSpec = createSpec;
        testPromise = createTest(createSpec);
    }
    else if (setSpec) {
        testSpec = setSpec;
        testPromise = setTest(setSpec);
    }
    else if (updateSpec) {
        testSpec = updateSpec;
        testPromise = updateTest(updateSpec);
    }
    else if (deleteSpec) {
        testSpec = deleteSpec;
        testPromise = deleteTest(deleteSpec);
    }
    else if (querySpec) {
        testSpec = querySpec;
        testPromise = queryTest(querySpec);
    }
    else if (listenSpec) {
        testSpec = listenSpec;
        testPromise = watchTest(listenSpec);
    }
    else {
        return Promise.reject(new Error(`Unhandled Spec: ${JSON.stringify(spec)}`));
    }
    return testPromise.then(() => {
        (0, chai_1.expect)(testSpec.isError || false).to.be.false;
    }, err => {
        if (!testSpec.isError) {
            throw err;
        }
    });
}
/**
 * Parses through the TestFile and changes all instances of Timestamps encoded
 * as strings to a proper protobuf type since protobufJS does not support it at
 * the moment.
 */
function normalizeTimestamp(obj) {
    const fieldNames = ['updateTime', 'createTime', 'readTime'];
    for (const key of Object.keys(obj)) {
        if (fieldNames.includes(key) && typeof obj[key] === 'string') {
            obj[key] = convertTimestamp(obj[key]);
        }
        else if (typeof obj[key] === 'object') {
            normalizeTimestamp(obj[key]);
        }
    }
}
/**
 * Convert a string TimeStamp, e.g. "1970-01-01T00:00:42Z", to its protobuf
 * type.
 */
function convertTimestamp(text) {
    const split = text.split(':');
    const secondsStr = split[split.length - 1];
    // Remove trailing 'Z' from Timestamp
    const seconds = Number(secondsStr.slice(0, secondsStr.length - 2));
    const frac = seconds - Math.floor(seconds);
    return {
        seconds: Math.floor(seconds),
        nanos: frac * 1e9,
    };
}
/**
 * Parses through the TestFile and changes all instances of Int32Values encoded
 * as numbers to a proper protobuf type since protobufJS does not support it at
 * the moment.
 *
 * We must include a parent field to properly catch which fields are standard
 * values vs. Int32Values. In this case, the 'limit' field in 'clauses' has
 * Value type, but the 'limit' field in 'query' has Int32Value type, resulting
 * in the need for an extra layer of specificity.
 */
function normalizeInt32Value(obj, parent = '') {
    const fieldNames = ['limit'];
    const parentNames = ['query'];
    for (const key of Object.keys(obj)) {
        if (fieldNames.includes(key) &&
            typeof obj[key] === 'number' &&
            parentNames.includes(parent)) {
            obj[key] = {
                value: obj[key],
            };
        }
        else if (typeof obj[key] === 'object') {
            normalizeInt32Value(obj[key], key);
        }
    }
}
(0, mocha_1.describe)('Conformance Tests', () => {
    const loadTestCases = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let testDataJson = [];
        const testPath = path.join(__dirname, 'conformance-tests');
        const fileNames = fs.readdirSync(testPath);
        for (const fileName of fileNames) {
            const testFilePath = path.join(__dirname, 'conformance-tests', fileName);
            const singleTest = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'));
            // Convert Timestamp string representation to protobuf object.
            normalizeTimestamp(singleTest);
            // Convert Int32Value to protobuf object.
            normalizeInt32Value(singleTest);
            const testFile = TEST_SUITE_TYPE.fromObject(singleTest);
            testDataJson = testDataJson.concat(testFile);
        }
        return testDataJson.map(testFile => testFile.tests[0]);
    };
    for (const testCase of loadTestCases()) {
        const isIgnored = ignoredRe.find(re => re.test(testCase.description));
        const isExclusive = exclusiveRe.find(re => re.test(testCase.description));
        if (isIgnored || (exclusiveRe.length > 0 && !isExclusive)) {
            (0, mocha_1.xit)(`${testCase.description}`, () => { });
        }
        else {
            (0, mocha_1.it)(`${testCase.description}`, () => runTest(testCase));
        }
    }
});
//# sourceMappingURL=runner.js.map
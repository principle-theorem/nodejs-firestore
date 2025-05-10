"use strict";
// Copyright 2024 Google LLC
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
exports.findNearestQuery = findNearestQuery;
const mocha_1 = require("mocha");
const query_1 = require("./query");
const helpers_1 = require("./util/helpers");
const src_1 = require("../src");
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const backoff_1 = require("../src/backoff");
(0, chai_1.use)(chaiAsPromised);
function findNearestQuery(fieldPath, queryVector, limit, measure) {
    return {
        findNearest: {
            vectorField: { fieldPath },
            queryVector: {
                mapValue: {
                    fields: {
                        __type__: { stringValue: '__vector__' },
                        value: {
                            arrayValue: {
                                values: queryVector.map(n => {
                                    return { doubleValue: n };
                                }),
                            },
                        },
                    },
                },
            },
            limit: { value: limit },
            distanceMeasure: measure,
        },
    };
}
describe('Vector(findNearest) query interface', () => {
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
        const queryA = firestore.collection('collectionId').where('foo', '==', 42);
        const queryB = firestore.collection('collectionId').where('foo', '==', 42);
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(queryA.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'COSINE',
            limit: 10,
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 0.125,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 0.125,
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 0.125,
            distanceResultField: new src_1.FieldPath('foo'),
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 0.125,
            distanceResultField: new src_1.FieldPath('foo'),
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: 'distance',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: new src_1.FieldPath('distance'),
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(firestore.collection('collectionId').findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'COSINE',
            limit: 10,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 42],
            distanceMeasure: 'COSINE',
            limit: 10,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'COSINE',
            limit: 1000,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 1.125,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 0.125,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 1,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceThreshold: 1,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: 'distance',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: 'result',
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: new src_1.FieldPath('bar'),
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: new src_1.FieldPath('foo'),
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: new src_1.FieldPath('foo'),
        }))).to.be.false;
        (0, chai_1.expect)(queryA
            .findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
            distanceResultField: 'result',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'EUCLIDEAN',
            limit: 10,
        }))).to.be.false;
    });
    (0, mocha_1.it)('generates equal vector queries with deprecated API', () => {
        const queryA = firestore.collection('collectionId').where('foo', '==', 42);
        const queryB = firestore.collection('collectionId').where('foo', '==', 42);
        (0, chai_1.expect)(queryA
            .findNearest('embedding', [40, 41, 42], {
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'embedding',
            queryVector: [40, 41, 42],
            distanceMeasure: 'COSINE',
            limit: 10,
        }))).to.be.true;
        (0, chai_1.expect)(queryA
            .findNearest('foo', [40, 41, 42, 43], {
            limit: 1,
            distanceMeasure: 'DOT_PRODUCT',
        })
            .isEqual(queryB.findNearest({
            vectorField: 'foo',
            queryVector: [40, 41, 42, 43],
            distanceMeasure: 'DOT_PRODUCT',
            limit: 1,
        }))).to.be.true;
    });
    (0, mocha_1.it)('generates proto', async () => {
        const overrides = {
            runQuery: request => {
                (0, query_1.queryEquals)(request, (0, query_1.fieldFiltersQuery)('foo', 'EQUAL', 'bar'), findNearestQuery('embedding', [3, 4, 5], 100, 'COSINE'));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId');
            const vectorQuery = query
                .where('foo', '==', 'bar')
                .findNearest('embedding', src_1.FieldValue.vector([3, 4, 5]), {
                limit: 100,
                distanceMeasure: 'COSINE',
            });
            return vectorQuery.get();
        });
    });
    (0, mocha_1.it)('validates inputs', async () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query.findNearest({
                vectorField: 'embedding',
                queryVector: [],
                limit: 10,
                distanceMeasure: 'EUCLIDEAN',
            });
        }).to.throw('not a valid vector size');
        (0, chai_1.expect)(() => {
            query.findNearest({
                vectorField: 'embedding',
                queryVector: [10, 1000],
                limit: 0,
                distanceMeasure: 'EUCLIDEAN',
            });
        }).to.throw('not a valid positive limit number');
    });
    (0, mocha_1.it)('validates inputs - preview (deprecated) API', async () => {
        const query = firestore.collection('collectionId');
        (0, chai_1.expect)(() => {
            query.findNearest('embedding', [], {
                limit: 10,
                distanceMeasure: 'EUCLIDEAN',
            });
        }).to.throw('not a valid vector size');
        (0, chai_1.expect)(() => {
            query.findNearest('embedding', [10, 1000], {
                limit: 0,
                distanceMeasure: 'EUCLIDEAN',
            });
        }).to.throw('not a valid positive limit number');
    });
    const distanceMeasure = [
        'EUCLIDEAN',
        'DOT_PRODUCT',
        'COSINE',
    ];
    distanceMeasure.forEach(distanceMeasure => {
        (0, mocha_1.it)(`returns results when distanceMeasure is ${distanceMeasure}`, async () => {
            const overrides = {
                runQuery: request => {
                    (0, query_1.queryEquals)(request, findNearestQuery('embedding', [1], 2, distanceMeasure));
                    return (0, helpers_1.stream)((0, query_1.result)('first'), (0, query_1.result)('second'));
                },
            };
            return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
                firestore = firestoreInstance;
                const query = firestore.collection('collectionId').findNearest({
                    vectorField: 'embedding',
                    queryVector: [1],
                    limit: 2,
                    distanceMeasure: distanceMeasure,
                });
                return query.get().then(results => {
                    (0, chai_1.expect)(results.size).to.equal(2);
                    (0, chai_1.expect)(results.empty).to.be.false;
                    (0, chai_1.expect)(results.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                    (0, chai_1.expect)(results.docs[0].id).to.equal('first');
                    (0, chai_1.expect)(results.docs[1].id).to.equal('second');
                    (0, chai_1.expect)(results.docChanges()).to.have.length(2);
                    let count = 0;
                    results.forEach(doc => {
                        (0, chai_1.expect)(doc instanceof src_1.DocumentSnapshot).to.be.true;
                        (0, chai_1.expect)(doc.createTime.isEqual(new src_1.Timestamp(1, 2))).to.be.true;
                        (0, chai_1.expect)(doc.updateTime.isEqual(new src_1.Timestamp(3, 4))).to.be.true;
                        (0, chai_1.expect)(doc.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                        ++count;
                    });
                    (0, chai_1.expect)(2).to.equal(count);
                });
            });
        });
    });
    (0, mocha_1.it)('successful return without ending the stream on get()', async () => {
        const overrides = {
            runQuery: request => {
                (0, query_1.queryEquals)(request, findNearestQuery('vector', [1], 10, 'COSINE'));
                return (0, helpers_1.streamWithoutEnd)((0, query_1.result)('first'), (0, query_1.result)('second', true));
            },
        };
        let counter = 0;
        return (0, helpers_1.createInstance)(overrides).then(firestoreInstance => {
            firestore = firestoreInstance;
            const query = firestore.collection('collectionId').findNearest({
                vectorField: 'vector',
                queryVector: [1],
                limit: 10,
                distanceMeasure: 'COSINE',
            });
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
    (0, mocha_1.it)('handles stream exception at initialization', async () => {
        let attempts = 0;
        const query = firestore.collection('collectionId').findNearest({
            vectorField: 'embedding',
            queryVector: [1],
            limit: 100,
            distanceMeasure: 'EUCLIDEAN',
        });
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
    (0, mocha_1.it)('handles stream exception during initialization', async () => {
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
                .findNearest({
                vectorField: 'embedding',
                queryVector: [1],
                limit: 10,
                distanceMeasure: 'COSINE',
            })
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
});
//# sourceMappingURL=vector-query.js.map
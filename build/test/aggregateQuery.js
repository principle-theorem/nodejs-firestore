"use strict";
// Copyright 2022 Google LLC
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
const helpers_1 = require("./util/helpers");
const src_1 = require("../src");
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const backoff_1 = require("../src/backoff");
(0, chai_1.use)(chaiAsPromised);
describe('aggregate query interface', () => {
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
            for (const equal1 of equals) {
                const equal1count = equal1.count();
                for (const equal2 of equals) {
                    const equal2count = equal2.count();
                    (0, chai_1.expect)(equal1count.isEqual(equal2count)).to.be.true;
                    (0, chai_1.expect)(equal2count.isEqual(equal1count)).to.be.true;
                }
                for (const notEqual of notEquals) {
                    const notEqual2count = notEqual.count();
                    (0, chai_1.expect)(equal1count.isEqual(notEqual2count)).to.be.false;
                    (0, chai_1.expect)(notEqual2count.isEqual(equal1count)).to.be.false;
                }
            }
        };
        queryEquals([
            queryA.orderBy('foo').endBefore('a'),
            queryB.orderBy('foo').endBefore('a'),
        ], [
            queryA.orderBy('foo').endBefore('b'),
            queryB.orderBy('bar').endBefore('a'),
        ]);
    });
    (0, mocha_1.it)('returns results', async () => {
        // Here we are mocking the response from the server. The client uses
        // `aggregate_$i` aliases in requests and will receive these in responses.
        const result = {
            result: {
                aggregateFields: {
                    aggregate_0: { integerValue: '99' },
                },
            },
            readTime: { seconds: 5, nanos: 6 },
        };
        const overrides = {
            runAggregationQuery: () => (0, helpers_1.stream)(result),
        };
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId').count();
        return query.get().then(results => {
            (0, chai_1.expect)(results.data().count).to.be.equal(99);
            (0, chai_1.expect)(results.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
            (0, chai_1.expect)(results.query).to.be.equal(query);
        });
    });
    (0, mocha_1.it)('handles stream exception at initialization', async () => {
        let attempts = 0;
        const query = firestore.collection('collectionId').count();
        query._stream = () => {
            ++attempts;
            throw new Error('Expected error');
        };
        await query
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
            runAggregationQuery: () => {
                ++attempts;
                return (0, helpers_1.stream)(new Error('Expected error'));
            },
        };
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId').count();
        await query
            .get()
            .then(() => {
            throw new Error('Unexpected success in Promise');
        })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('Expected error');
            (0, chai_1.expect)(attempts).to.equal(5);
        });
    });
    (0, mocha_1.it)('handles message without result during initialization', async () => {
        let attempts = 0;
        const overrides = {
            runAggregationQuery: () => {
                ++attempts;
                return (0, helpers_1.stream)({ readTime: { seconds: 5, nanos: 6 } });
            },
        };
        firestore = await (0, helpers_1.createInstance)(overrides);
        const query = firestore.collection('collectionId').count();
        await query
            .get()
            .then(() => {
            throw new Error('Unexpected success in Promise');
        })
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('No AggregateQuery results');
            (0, chai_1.expect)(attempts).to.equal(1);
        });
    });
});
//# sourceMappingURL=aggregateQuery.js.map
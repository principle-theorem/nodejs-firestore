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
exports.partitionQueryEquals = partitionQueryEquals;
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const extend = require("extend");
const backoff_1 = require("../src/backoff");
const helpers_1 = require("./util/helpers");
(0, chai_1.use)(chaiAsPromised);
const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;
const DOC1 = `${DATABASE_ROOT}/documents/coll/doc1`;
const DOC2 = `${DATABASE_ROOT}/documents/coll/doc2`;
function partitionQueryEquals(actual, partitionCount) {
    (0, chai_1.expect)(actual).to.not.be.undefined;
    const query = {
        parent: DATABASE_ROOT + '/documents',
        structuredQuery: {
            from: [
                {
                    allDescendants: true,
                    collectionId: 'collectionId',
                },
            ],
            orderBy: [
                {
                    direction: 'ASCENDING',
                    field: {
                        fieldPath: '__name__',
                    },
                },
            ],
        },
        partitionCount,
    };
    // 'extend' removes undefined fields in the request object. The backend
    // ignores these fields, but we need to manually strip them before we compare
    // the expected and the actual request.
    actual = extend(true, {}, actual);
    (0, chai_1.expect)(actual).to.deep.eq(query);
}
(0, mocha_1.describe)('Partition Query', () => {
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
    async function getPartitions(collectionGroup, desiredPartitionsCount) {
        const partitions = [];
        for await (const partition of collectionGroup.getPartitions(desiredPartitionsCount)) {
            partitions.push(partition);
        }
        return partitions;
    }
    function verifyPartition(partition, startAt, endBefore) {
        var _a, _b;
        if (startAt) {
            (0, chai_1.expect)((_a = partition.startAt) === null || _a === void 0 ? void 0 : _a.map(value => value.path)).to.have.members([startAt]);
        }
        else {
            (0, chai_1.expect)(partition.startAt).to.be.undefined;
        }
        if (endBefore) {
            (0, chai_1.expect)((_b = partition.endBefore) === null || _b === void 0 ? void 0 : _b.map(value => value.path)).to.have.members([endBefore]);
        }
        else {
            (0, chai_1.expect)(partition.endBefore).to.be.undefined;
        }
    }
    (0, mocha_1.it)('requests one less than desired partitions', () => {
        const desiredPartitionsCount = 2;
        const cursorValue = {
            values: [{ referenceValue: DOC1 }],
        };
        const overrides = {
            partitionQueryStream: request => {
                partitionQueryEquals(request, 
                /* partitionCount= */ desiredPartitionsCount - 1);
                return (0, helpers_1.stream)(cursorValue);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
            const query = firestore.collectionGroup('collectionId');
            const result = await getPartitions(query, desiredPartitionsCount);
            (0, chai_1.expect)(result.length).to.equal(2);
            (0, chai_1.expect)(result[0].startAt).to.be.undefined;
            (0, chai_1.expect)(result[0].endBefore).to.deep.equal(result[1].startAt);
            (0, chai_1.expect)(result[1].endBefore).to.be.undefined;
        });
    });
    (0, mocha_1.it)('does not issue RPC if only a single partition is requested', () => {
        const desiredPartitionsCount = 1;
        return (0, helpers_1.createInstance)().then(async (firestore) => {
            const query = firestore.collectionGroup('collectionId');
            const result = await getPartitions(query, desiredPartitionsCount);
            (0, chai_1.expect)(result.length).to.equal(1);
            (0, chai_1.expect)(result[0].startAt).to.be.undefined;
            (0, chai_1.expect)(result[0].endBefore).to.be.undefined;
        });
    });
    (0, mocha_1.it)('validates partition count', () => {
        return (0, helpers_1.createInstance)().then(firestore => {
            const query = firestore.collectionGroup('collectionId');
            return (0, chai_1.expect)(getPartitions(query, 0)).to.eventually.be.rejectedWith('Value for argument "desiredPartitionCount" must be within [1, Infinity] inclusive, but was: 0');
        });
    });
    (0, mocha_1.it)('converts partitions to queries', () => {
        const desiredPartitionsCount = 3;
        const expectedStartAt = [
            undefined,
            { referenceValue: DOC1 },
            { referenceValue: DOC2 },
        ];
        const expectedEndBefore = [
            { referenceValue: DOC1 },
            { referenceValue: DOC2 },
            undefined,
        ];
        const overrides = {
            partitionQueryStream: request => {
                partitionQueryEquals(request, 
                /* partitionCount= */ desiredPartitionsCount - 1);
                return (0, helpers_1.stream)({
                    values: [{ referenceValue: DOC1 }],
                }, {
                    values: [{ referenceValue: DOC2 }],
                });
            },
            runQuery: request => {
                const startAt = expectedStartAt.shift();
                if (startAt) {
                    (0, chai_1.expect)(request.structuredQuery.startAt).to.deep.equal({
                        before: true,
                        values: [startAt],
                    });
                }
                else {
                    (0, chai_1.expect)(request.structuredQuery.startAt).to.be.undefined;
                }
                const endBefore = expectedEndBefore.shift();
                if (endBefore) {
                    (0, chai_1.expect)(request.structuredQuery.endAt).to.deep.equal({
                        before: true,
                        values: [endBefore],
                    });
                }
                else {
                    (0, chai_1.expect)(request.structuredQuery.endAt).to.be.undefined;
                }
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
            const query = firestore.collectionGroup('collectionId');
            const partitions = await getPartitions(query, desiredPartitionsCount);
            (0, chai_1.expect)(partitions.length).to.equal(3);
            for (const partition of partitions) {
                await partition.toQuery().get();
            }
        });
    });
    (0, mocha_1.it)("doesn't truncate large numbers", () => {
        // JavaScript by default truncates large numbers. If partition data were
        // to include truncated numbers, using them as cursors could skip or
        // duplicate results. Note that the backend API currently only returns
        // DocumentReferences as partitions, but this may change in the future.
        const bigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
        const desiredPartitionsCount = 2;
        const overrides = {
            partitionQueryStream: request => {
                partitionQueryEquals(request, 
                /* partitionCount= */ desiredPartitionsCount - 1);
                return (0, helpers_1.stream)({
                    values: [{ integerValue: bigIntValue.toString() }],
                });
            },
            runQuery: request => {
                (0, chai_1.expect)(request.structuredQuery.endAt.values[0].integerValue).to.equal(bigIntValue.toString());
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
            const query = firestore.collectionGroup('collectionId');
            const result = await getPartitions(query, desiredPartitionsCount);
            (0, chai_1.expect)(result.length).to.equal(2);
            // If the user uses the cursor directly, we follow the `useBigInt`
            // setting. By default, we return a truncated number.
            (0, chai_1.expect)(result[0].endBefore[0]).to.be.a('number');
            (0, chai_1.expect)(result[1].startAt[0]).to.be.a('number');
            return result[0].toQuery().get();
        });
    });
    (0, mocha_1.it)('sorts partitions', () => {
        const desiredPartitionsCount = 3;
        const overrides = {
            partitionQueryStream: () => {
                return (0, helpers_1.stream)({
                    values: [{ referenceValue: DOC2 }],
                }, {
                    values: [{ referenceValue: DOC1 }],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
            const query = firestore.collectionGroup('collectionId');
            const partitions = await getPartitions(query, desiredPartitionsCount);
            (0, chai_1.expect)(partitions.length).to.equal(3);
            verifyPartition(partitions[0], null, 'coll/doc1');
            verifyPartition(partitions[1], 'coll/doc1', 'coll/doc2');
            verifyPartition(partitions[2], 'coll/doc2', null);
        });
    });
});
//# sourceMappingURL=partition-query.js.map
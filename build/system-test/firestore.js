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
const src_1 = require("../src");
const util_1 = require("../src/util");
const bundle_1 = require("../test/bundle");
const helpers_1 = require("../test/util/helpers");
const google_gax_1 = require("google-gax");
const filter_1 = require("../src/filter");
const index_test_helper_1 = require("./index_test_helper");
(0, chai_1.use)(chaiAsPromised);
const version = require('../../package.json').version;
class DeferredPromise {
    constructor() {
        this.resolve = () => {
            throw new Error('DeferredPromise.resolve has not been initialized');
        };
        this.reject = () => {
            throw new Error('DeferredPromise.reject has not been initialized');
        };
        this.promise = null;
    }
}
const firestoreEnv = {};
for (const key in process.env) {
    if (key.startsWith('FIRESTORE')) {
        firestoreEnv[key] = process.env[key];
    }
}
console.log(`Running system tests with environment variables:\n ${JSON.stringify(firestoreEnv, null, 2)}`);
if (process.env.NODE_ENV === 'DEBUG') {
    (0, src_1.setLogFunction)(console.log);
}
function getTestRoot(settings = {}) {
    const internalSettings = {};
    if (process.env.FIRESTORE_NAMED_DATABASE) {
        internalSettings.databaseId = process.env.FIRESTORE_NAMED_DATABASE;
    }
    const firestore = new src_1.Firestore({
        ...internalSettings,
        ...settings, // caller settings take precedent over internal settings
    });
    return firestore.collection(`node_${version}_${(0, util_1.autoId)()}`);
}
(0, mocha_1.describe)('Firestore class', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has collection() method', () => {
        const ref = firestore.collection('col');
        (0, chai_1.expect)(ref.id).to.equal('col');
    });
    (0, mocha_1.it)('has doc() method', () => {
        const ref = firestore.doc('col/doc');
        (0, chai_1.expect)(ref.id).to.equal('doc');
    });
    (0, mocha_1.it)('has getAll() method', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({ foo: 'a' }), ref2.set({ foo: 'a' })])
            .then(() => {
            return firestore.getAll(ref1, ref2);
        })
            .then(docs => {
            (0, chai_1.expect)(docs.length).to.equal(2);
        });
    });
    (0, mocha_1.it)('can plan a query using default options', async () => {
        await randomCol.doc('doc1').set({ foo: 1 });
        await randomCol.doc('doc2').set({ foo: 2 });
        await randomCol.doc('doc3').set({ foo: 1 });
        const explainResults = await randomCol.where('foo', '>', 1).explain();
        // Should have metrics.
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics).to.not.be.null;
        // Should have query plan.
        const plan = metrics.planSummary;
        (0, chai_1.expect)(plan).to.not.be.null;
        (0, chai_1.expect)(Object.keys(plan.indexesUsed).length).to.be.greaterThan(0);
        // No execution stats and no snapshot.
        (0, chai_1.expect)(metrics.executionStats).to.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.be.null;
    });
    (0, mocha_1.it)('can plan a query', async () => {
        await randomCol.doc('doc1').set({ foo: 1 });
        await randomCol.doc('doc2').set({ foo: 2 });
        await randomCol.doc('doc3').set({ foo: 1 });
        const explainResults = await randomCol
            .where('foo', '>', 1)
            .explain({ analyze: false });
        // Should have metrics.
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics).to.not.be.null;
        // Should have query plan.
        const plan = metrics.planSummary;
        (0, chai_1.expect)(plan).to.not.be.null;
        (0, chai_1.expect)(Object.keys(plan.indexesUsed).length).to.be.greaterThan(0);
        // No execution stats and no snapshot.
        (0, chai_1.expect)(metrics.executionStats).to.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.be.null;
    });
    (0, mocha_1.it)('can profile a query', async () => {
        await randomCol.doc('doc1').set({ foo: 1, bar: 0 });
        await randomCol.doc('doc2').set({ foo: 2, bar: 1 });
        await randomCol.doc('doc3').set({ foo: 1, bar: 2 });
        const explainResults = await randomCol
            .where('foo', '==', 1)
            .explain({ analyze: true });
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics.planSummary).to.not.be.null;
        (0, chai_1.expect)(metrics.executionStats).to.not.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.not.be.null;
        (0, chai_1.expect)(Object.keys(metrics.planSummary.indexesUsed).length).to.be.greaterThan(0);
        const stats = metrics.executionStats;
        (0, chai_1.expect)(stats.readOperations).to.be.greaterThan(0);
        (0, chai_1.expect)(stats.resultsReturned).to.be.equal(2);
        (0, chai_1.expect)(stats.executionDuration.nanoseconds > 0 ||
            stats.executionDuration.seconds > 0).to.be.true;
        (0, chai_1.expect)(Object.keys(stats.debugStats).length).to.be.greaterThan(0);
        (0, chai_1.expect)(explainResults.snapshot.size).to.equal(2);
    });
    (0, mocha_1.it)('can profile a query that does not match any docs', async () => {
        await randomCol.doc('doc1').set({ foo: 1, bar: 0 });
        await randomCol.doc('doc2').set({ foo: 2, bar: 1 });
        await randomCol.doc('doc3').set({ foo: 1, bar: 2 });
        const results = await randomCol.where('foo', '==', 12345).get();
        (0, chai_1.expect)(results.empty).to.be.true;
        (0, chai_1.expect)(results.docs.length).to.equal(0);
        (0, chai_1.expect)(results.readTime.toMillis()).to.be.greaterThan(0);
        const explainResults = await randomCol
            .where('foo', '==', 12345)
            .explain({ analyze: true });
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics.planSummary).to.not.be.null;
        (0, chai_1.expect)(metrics.executionStats).to.not.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.not.be.null;
        (0, chai_1.expect)(Object.keys(metrics.planSummary.indexesUsed).length).to.be.greaterThan(0);
        const stats = metrics.executionStats;
        (0, chai_1.expect)(stats.readOperations).to.be.greaterThan(0);
        (0, chai_1.expect)(stats.resultsReturned).to.be.equal(0);
        (0, chai_1.expect)(stats.executionDuration.nanoseconds > 0 ||
            stats.executionDuration.seconds > 0).to.be.true;
        (0, chai_1.expect)(Object.keys(stats.debugStats).length).to.be.greaterThan(0);
        (0, chai_1.expect)(explainResults.snapshot.size).to.equal(0);
    });
    (0, mocha_1.it)('can stream explain results with default options', async () => {
        await randomCol.doc('doc1').set({ foo: 1, bar: 0 });
        await randomCol.doc('doc2').set({ foo: 2, bar: 1 });
        await randomCol.doc('doc3').set({ foo: 1, bar: 2 });
        let totalResponses = 0;
        let totalDocuments = 0;
        let metrics = null;
        const stream = randomCol.explainStream();
        const promise = new Promise((resolve, reject) => {
            stream.on('data', data => {
                ++totalResponses;
                if (data.document) {
                    ++totalDocuments;
                }
                if (data.metrics) {
                    metrics = data.metrics;
                }
            });
            stream.on('end', () => {
                (0, chai_1.expect)(totalResponses).to.equal(1);
                (0, chai_1.expect)(totalDocuments).to.equal(0);
                (0, chai_1.expect)(metrics).to.not.be.null;
                (0, chai_1.expect)(metrics.planSummary.indexesUsed.length).to.be.greaterThan(0);
                (0, chai_1.expect)(metrics.executionStats).to.be.null;
                resolve(true);
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
        const success = await promise;
        (0, chai_1.expect)(success).to.be.true;
    });
    (0, mocha_1.it)('can stream explain results without analyze', async () => {
        await randomCol.doc('doc1').set({ foo: 1, bar: 0 });
        await randomCol.doc('doc2').set({ foo: 2, bar: 1 });
        await randomCol.doc('doc3').set({ foo: 1, bar: 2 });
        let totalResponses = 0;
        let totalDocuments = 0;
        let metrics = null;
        const stream = randomCol.explainStream({ analyze: false });
        const promise = new Promise((resolve, reject) => {
            stream.on('data', data => {
                ++totalResponses;
                if (data.document) {
                    ++totalDocuments;
                }
                if (data.metrics) {
                    metrics = data.metrics;
                }
            });
            stream.on('end', () => {
                (0, chai_1.expect)(totalResponses).to.equal(1);
                (0, chai_1.expect)(totalDocuments).to.equal(0);
                (0, chai_1.expect)(metrics).to.not.be.null;
                (0, chai_1.expect)(metrics.planSummary.indexesUsed.length).to.be.greaterThan(0);
                (0, chai_1.expect)(metrics.executionStats).to.be.null;
                resolve(true);
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
        const success = await promise;
        (0, chai_1.expect)(success).to.be.true;
    });
    (0, mocha_1.it)('can stream explain results with analyze', async () => {
        await randomCol.doc('doc1').set({ foo: 1, bar: 0 });
        await randomCol.doc('doc2').set({ foo: 2, bar: 1 });
        await randomCol.doc('doc3').set({ foo: 1, bar: 2 });
        let totalResponses = 0;
        let totalDocuments = 0;
        let metrics = null;
        const stream = randomCol
            .where('foo', '==', 1)
            .explainStream({ analyze: true });
        const promise = new Promise((resolve, reject) => {
            stream.on('data', data => {
                ++totalResponses;
                if (data.document) {
                    ++totalDocuments;
                }
                if (data.metrics) {
                    metrics = data.metrics;
                }
            });
            stream.on('end', () => {
                (0, chai_1.expect)(totalResponses).to.equal(2);
                (0, chai_1.expect)(totalDocuments).to.equal(2);
                (0, chai_1.expect)(metrics).to.not.be.null;
                (0, chai_1.expect)(metrics.planSummary.indexesUsed.length).to.be.greaterThan(0);
                (0, chai_1.expect)(metrics.executionStats).to.not.be.null;
                (0, chai_1.expect)(metrics.executionStats.resultsReturned).to.equal(2);
                resolve(true);
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
        const success = await promise;
        (0, chai_1.expect)(success).to.be.true;
    });
    (0, mocha_1.it)('can plan an aggregate query using default options', async () => {
        await randomCol.doc('doc1').set({ foo: 1 });
        await randomCol.doc('doc2').set({ foo: 2 });
        await randomCol.doc('doc3').set({ foo: 1 });
        const explainResults = await randomCol
            .where('foo', '>', 0)
            .count()
            .explain();
        const metrics = explainResults.metrics;
        const plan = metrics.planSummary;
        (0, chai_1.expect)(plan).to.not.be.null;
        (0, chai_1.expect)(Object.keys(plan.indexesUsed).length).to.be.greaterThan(0);
        (0, chai_1.expect)(metrics.executionStats).to.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.be.null;
    });
    (0, mocha_1.it)('can plan an aggregate query', async () => {
        await randomCol.doc('doc1').set({ foo: 1 });
        await randomCol.doc('doc2').set({ foo: 2 });
        await randomCol.doc('doc3').set({ foo: 1 });
        const explainResults = await randomCol
            .where('foo', '>', 0)
            .count()
            .explain({ analyze: false });
        const metrics = explainResults.metrics;
        const plan = metrics.planSummary;
        (0, chai_1.expect)(plan).to.not.be.null;
        (0, chai_1.expect)(Object.keys(plan.indexesUsed).length).to.be.greaterThan(0);
        (0, chai_1.expect)(metrics.executionStats).to.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.be.null;
    });
    (0, mocha_1.it)('can profile an aggregate query', async () => {
        await randomCol.doc('doc1').set({ foo: 1 });
        await randomCol.doc('doc2').set({ foo: 2 });
        await randomCol.doc('doc3').set({ foo: 1 });
        const explainResults = await randomCol
            .where('foo', '<', 3)
            .count()
            .explain({ analyze: true });
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics.planSummary).to.not.be.null;
        (0, chai_1.expect)(Object.keys(metrics.planSummary.indexesUsed).length).to.be.greaterThan(0);
        (0, chai_1.expect)(metrics.executionStats).to.not.be.null;
        const stats = metrics.executionStats;
        (0, chai_1.expect)(stats.readOperations).to.be.greaterThan(0);
        (0, chai_1.expect)(stats.resultsReturned).to.be.equal(1);
        (0, chai_1.expect)(stats.executionDuration.nanoseconds > 0 ||
            stats.executionDuration.seconds > 0).to.be.true;
        (0, chai_1.expect)(Object.keys(stats.debugStats).length).to.be.greaterThan(0);
        (0, chai_1.expect)(explainResults.snapshot).to.not.be.null;
        (0, chai_1.expect)(explainResults.snapshot.data().count).to.equal(3);
    });
    (0, mocha_1.it)('can plan a vector query', async () => {
        const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
        const collectionReference = await indexTestHelper.createTestDocs([
            { foo: 'bar' },
            { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
        ]);
        const explainResults = await indexTestHelper
            .query(collectionReference)
            .findNearest({
            vectorField: 'embedding',
            queryVector: src_1.FieldValue.vector([1, 3]),
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .explain({ analyze: false });
        const metrics = explainResults.metrics;
        const plan = metrics.planSummary;
        (0, chai_1.expect)(plan).to.not.be.null;
        (0, chai_1.expect)(Object.keys(plan.indexesUsed).length).to.be.greaterThan(0);
        (0, chai_1.expect)(metrics.executionStats).to.be.null;
        (0, chai_1.expect)(explainResults.snapshot).to.be.null;
    });
    (0, mocha_1.it)('can profile a vector query', async () => {
        const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
        const collectionReference = await indexTestHelper.createTestDocs([
            { foo: 'bar' },
            { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) },
            { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
        ]);
        const explainResults = await indexTestHelper
            .query(collectionReference)
            .findNearest({
            vectorField: 'embedding',
            queryVector: src_1.FieldValue.vector([1, 3]),
            limit: 10,
            distanceMeasure: 'COSINE',
        })
            .explain({ analyze: true });
        const metrics = explainResults.metrics;
        (0, chai_1.expect)(metrics.planSummary).to.not.be.null;
        (0, chai_1.expect)(Object.keys(metrics.planSummary.indexesUsed).length).to.be.greaterThan(0);
        (0, chai_1.expect)(metrics.executionStats).to.not.be.null;
        const stats = metrics.executionStats;
        (0, chai_1.expect)(stats.readOperations).to.be.greaterThan(0);
        (0, chai_1.expect)(stats.resultsReturned).to.be.equal(5);
        (0, chai_1.expect)(stats.executionDuration.nanoseconds > 0 ||
            stats.executionDuration.seconds > 0).to.be.true;
        (0, chai_1.expect)(Object.keys(stats.debugStats).length).to.be.greaterThan(0);
        (0, chai_1.expect)(explainResults.snapshot).to.not.be.null;
        (0, chai_1.expect)(explainResults.snapshot.docs.length).to.equal(5);
    });
    (0, mocha_1.it)('getAll() supports array destructuring', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({ foo: 'a' }), ref2.set({ foo: 'a' })])
            .then(() => {
            return firestore.getAll(...[ref1, ref2]);
        })
            .then(docs => {
            (0, chai_1.expect)(docs.length).to.equal(2);
        });
    });
    (0, mocha_1.it)('getAll() supports field mask', () => {
        const ref1 = randomCol.doc('doc1');
        return ref1
            .set({ foo: 'a', bar: 'b' })
            .then(() => {
            return firestore.getAll(ref1, { fieldMask: ['foo'] });
        })
            .then(docs => {
            (0, chai_1.expect)(docs[0].data()).to.deep.equal({ foo: 'a' });
        });
    });
    (0, mocha_1.it)('getAll() supports array destructuring with field mask', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({ f: 'a', b: 'b' }), ref2.set({ f: 'a', b: 'b' })])
            .then(() => {
            return firestore.getAll(...[ref1, ref2], { fieldMask: ['f'] });
        })
            .then(docs => {
            (0, chai_1.expect)(docs[0].data()).to.deep.equal({ f: 'a' });
            (0, chai_1.expect)(docs[1].data()).to.deep.equal({ f: 'a' });
        });
    });
    (0, mocha_1.it)('getAll() supports generics', async () => {
        const ref1 = randomCol.doc('doc1').withConverter(helpers_1.postConverter);
        const ref2 = randomCol.doc('doc2').withConverter(helpers_1.postConverter);
        await ref1.set(new helpers_1.Post('post1', 'author1'));
        await ref2.set(new helpers_1.Post('post2', 'author2'));
        const docs = await firestore.getAll(ref1, ref2);
        (0, chai_1.expect)(docs[0].data().toString()).to.deep.equal('post1, by author1');
        (0, chai_1.expect)(docs[1].data().toString()).to.deep.equal('post2, by author2');
    });
    (0, mocha_1.it)('cannot make calls after the client has been terminated', () => {
        const ref1 = randomCol.doc('doc1');
        return firestore
            .terminate()
            .then(() => {
            return ref1.set({ foo: 100 });
        })
            .then(() => Promise.reject('set() should have failed'))
            .catch(err => {
            (0, chai_1.expect)(err.message).to.equal('The client has already been terminated');
        });
    });
    (0, mocha_1.it)('throws an error if terminate() is called with active listeners', async () => {
        const ref = randomCol.doc('doc-1');
        const unsubscribe = ref.onSnapshot(() => {
            // No-op
        });
        await (0, chai_1.expect)(firestore.terminate()).to.eventually.be.rejectedWith('All onSnapshot() listeners must be unsubscribed, and all BulkWriter ' +
            'instances must be closed before terminating the client. There are 1 ' +
            'active listeners and 0 open BulkWriter instances.');
        unsubscribe();
    });
    (0, mocha_1.it)('throws an error if terminate() is called with pending BulkWriter operations', async () => {
        const writer = firestore.bulkWriter();
        const ref = randomCol.doc('doc-1');
        writer.set(ref, { foo: 'bar' });
        await (0, chai_1.expect)(firestore.terminate()).to.eventually.be.rejectedWith('All onSnapshot() listeners must be unsubscribed, and all BulkWriter ' +
            'instances must be closed before terminating the client. There are 0 ' +
            'active listeners and 1 open BulkWriter instances.');
    });
});
// Skip partition query tests when running against the emulator because
// partition queries are not supported by the emulator.
(process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.describe : mocha_1.describe.skip)('CollectionGroup class', () => {
    const desiredPartitionCount = 3;
    const documentCount = 2 * 128 + 127; // Minimum partition size is 128.
    let firestore;
    let randomColl;
    let collectionGroup;
    (0, mocha_1.before)(async () => {
        randomColl = getTestRoot();
        firestore = randomColl.firestore;
        collectionGroup = firestore.collectionGroup(randomColl.id);
        const batch = firestore.batch();
        for (let i = 0; i < documentCount; ++i) {
            batch.create(randomColl.doc(), { title: 'post', author: 'author' });
        }
        await batch.commit();
    });
    async function getPartitions(collectionGroup, desiredPartitionsCount) {
        const partitions = [];
        for await (const partition of collectionGroup.getPartitions(desiredPartitionsCount)) {
            partitions.push(partition);
        }
        return partitions;
    }
    async function verifyPartitions(partitions) {
        (0, chai_1.expect)(partitions.length).to.not.be.greaterThan(desiredPartitionCount);
        (0, chai_1.expect)(partitions[0].startAt).to.be.undefined;
        for (let i = 0; i < partitions.length - 1; ++i) {
            // The cursor value is a single DocumentReference
            (0, chai_1.expect)(partitions[i].endBefore[0].isEqual(partitions[i + 1].startAt[0])).to.be.true;
        }
        (0, chai_1.expect)(partitions[partitions.length - 1].endBefore).to.be.undefined;
        // Validate that we can use the partitions to read the original documents.
        const documents = [];
        for (const partition of partitions) {
            documents.push(...(await partition.toQuery().get()).docs);
        }
        (0, chai_1.expect)(documents.length).to.equal(documentCount);
        return documents;
    }
    (0, mocha_1.it)('partition query', async () => {
        const partitions = await getPartitions(collectionGroup, desiredPartitionCount);
        await verifyPartitions(partitions);
    });
    (0, mocha_1.it)('partition query with manual cursors', async () => {
        const partitions = await getPartitions(collectionGroup, desiredPartitionCount);
        const documents = [];
        for (const partition of partitions) {
            let partitionedQuery = collectionGroup.orderBy(src_1.FieldPath.documentId());
            if (partition.startAt) {
                partitionedQuery = partitionedQuery.startAt(...partition.startAt);
            }
            if (partition.endBefore) {
                partitionedQuery = partitionedQuery.endBefore(...partition.endBefore);
            }
            documents.push(...(await partitionedQuery.get()).docs);
        }
        (0, chai_1.expect)(documents.length).to.equal(documentCount);
    });
    (0, mocha_1.it)('partition query with converter', async () => {
        const collectionGroupWithConverter = collectionGroup.withConverter(helpers_1.postConverter);
        const partitions = await getPartitions(collectionGroupWithConverter, desiredPartitionCount);
        const documents = await verifyPartitions(partitions);
        for (const document of documents) {
            (0, chai_1.expect)(document.data()).to.be.an.instanceOf(helpers_1.Post);
        }
    });
    (0, mocha_1.it)('empty partition query', async () => {
        const desiredPartitionCount = 3;
        const collectionGroupId = randomColl.doc().id;
        const collectionGroup = firestore.collectionGroup(collectionGroupId);
        const partitions = await getPartitions(collectionGroup, desiredPartitionCount);
        (0, chai_1.expect)(partitions.length).to.equal(1);
        (0, chai_1.expect)(partitions[0].startAt).to.be.undefined;
        (0, chai_1.expect)(partitions[0].endBefore).to.be.undefined;
    });
});
(0, mocha_1.describe)('CollectionReference class', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has firestore property', () => {
        const ref = firestore.collection('col');
        (0, chai_1.expect)(ref.firestore).to.be.an.instanceOf(src_1.Firestore);
    });
    (0, mocha_1.it)('has id property', () => {
        const ref = firestore.collection('col');
        (0, chai_1.expect)(ref.id).to.equal('col');
    });
    (0, mocha_1.it)('has parent property', () => {
        const ref = firestore.collection('col/doc/col');
        (0, chai_1.expect)(ref.parent.id).to.equal('doc');
    });
    (0, mocha_1.it)('has path property', () => {
        const ref = firestore.collection('col/doc/col');
        (0, chai_1.expect)(ref.path).to.equal('col/doc/col');
    });
    (0, mocha_1.it)('has doc() method', () => {
        let ref = firestore.collection('col').doc('doc');
        (0, chai_1.expect)(ref.id).to.equal('doc');
        ref = firestore.collection('col').doc();
        (0, chai_1.expect)(ref.id).to.have.length(20);
    });
    (0, mocha_1.it)('has add() method', () => {
        return randomCol
            .add({ foo: 'a' })
            .then(ref => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('lists missing documents', async () => {
        const batch = firestore.batch();
        batch.set(randomCol.doc('a'), {});
        batch.set(randomCol.doc('b/b/b'), {});
        batch.set(randomCol.doc('c'), {});
        await batch.commit();
        const documentRefs = await randomCol.listDocuments();
        const documents = await firestore.getAll(...documentRefs);
        const existingDocs = documents.filter(doc => doc.exists);
        const missingDocs = documents.filter(doc => !doc.exists);
        (0, chai_1.expect)(existingDocs.map(doc => doc.id)).to.have.members(['a', 'c']);
        (0, chai_1.expect)(missingDocs.map(doc => doc.id)).to.have.members(['b']);
    });
    (0, mocha_1.it)('lists documents (more than the max page size)', async () => {
        const batch = firestore.batch();
        const expectedResults = [];
        for (let i = 0; i < 400; i++) {
            const docRef = randomCol.doc(`${i}`.padStart(3, '0'));
            batch.set(docRef, { id: i });
            expectedResults.push(docRef.id);
        }
        await batch.commit();
        const documentRefs = await randomCol.listDocuments();
        const actualDocIds = documentRefs
            .map(dr => dr.id)
            .sort((a, b) => a.localeCompare(b));
        (0, chai_1.expect)(actualDocIds).to.deep.equal(expectedResults);
    });
    (0, mocha_1.it)('supports withConverter()', async () => {
        const ref = await firestore
            .collection('col')
            .withConverter(helpers_1.postConverter)
            .add(new helpers_1.Post('post', 'author'));
        const postData = await ref.get();
        const post = postData.data();
        (0, chai_1.expect)(post).to.not.be.undefined;
        (0, chai_1.expect)(post.toString()).to.equal('post, by author');
    });
});
(0, mocha_1.describe)('DocumentReference class', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has firestore property', () => {
        const ref = firestore.doc('col/doc');
        (0, chai_1.expect)(ref.firestore).to.be.an.instanceOf(src_1.Firestore);
    });
    (0, mocha_1.it)('has id property', () => {
        const ref = firestore.doc('col/doc');
        (0, chai_1.expect)(ref.id).to.equal('doc');
    });
    (0, mocha_1.it)('has parent property', () => {
        const ref = firestore.doc('col/doc');
        (0, chai_1.expect)(ref.parent.id).to.equal('col');
    });
    (0, mocha_1.it)('has path property', () => {
        const ref = firestore.doc('col/doc');
        (0, chai_1.expect)(ref.path).to.equal('col/doc');
    });
    (0, mocha_1.it)('has collection() method', () => {
        const ref = firestore.doc('col/doc').collection('subcol');
        (0, chai_1.expect)(ref.id).to.equal('subcol');
    });
    (0, mocha_1.it)('has create()/get() method', () => {
        const ref = randomCol.doc();
        return ref
            .create({ foo: 'a' })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('has set() method', () => {
        const allSupportedTypesObject = {
            stringValue: 'a',
            trueValue: true,
            falseValue: false,
            integerValue: 10,
            largeIntegerValue: 1234567890000,
            doubleValue: 0.1,
            infinityValue: Infinity,
            negativeInfinityValue: -Infinity,
            objectValue: { foo: 'bar', '😀': '😜' },
            emptyObject: {},
            dateValue: new src_1.Timestamp(479978400, 123000000),
            zeroDateValue: new src_1.Timestamp(0, 0),
            pathValue: firestore.doc('col1/ref1'),
            arrayValue: ['foo', 42, 'bar'],
            emptyArray: [],
            nilValue: null,
            geoPointValue: new src_1.GeoPoint(50.1430847, -122.947778),
            zeroGeoPointValue: new src_1.GeoPoint(0, 0),
            bytesValue: Buffer.from([0x01, 0x02]),
        };
        const ref = randomCol.doc('doc');
        return ref
            .set(allSupportedTypesObject)
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            const data = doc.data();
            (0, chai_1.expect)(data.pathValue.path).to.equal(allSupportedTypesObject.pathValue.path);
            delete data.pathValue;
            delete allSupportedTypesObject.pathValue;
            (0, chai_1.expect)(data).to.deep.equal(allSupportedTypesObject);
        });
    });
    (0, mocha_1.it)('supports NaNs', () => {
        const nanObject = {
            nanValue: NaN,
        };
        const ref = randomCol.doc('doc');
        return ref
            .set(nanObject)
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            const actualValue = doc.data().nanValue;
            (0, chai_1.expect)(actualValue).to.be.a('number');
            (0, chai_1.expect)(actualValue).to.be.NaN;
        });
    });
    (0, mocha_1.it)('round-trips BigInts', () => {
        const bigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
        const randomCol = getTestRoot({ useBigInt: true });
        const ref = randomCol.doc('doc');
        return ref
            .set({ bigIntValue })
            .then(() => ref.get())
            .then(doc => ref.set(doc.data()))
            .then(() => ref.get())
            .then(doc => {
            const actualValue = doc.data().bigIntValue;
            (0, chai_1.expect)(actualValue).to.be.a('bigint');
            (0, chai_1.expect)(actualValue).to.equal(bigIntValue);
        });
    });
    (0, mocha_1.it)('supports server timestamps', () => {
        const baseObject = {
            a: 'bar',
            b: { remove: 'bar' },
            d: { keep: 'bar' },
            f: src_1.FieldValue.serverTimestamp(),
        };
        const updateObject = {
            a: src_1.FieldValue.serverTimestamp(),
            b: { c: src_1.FieldValue.serverTimestamp() },
            'd.e': src_1.FieldValue.serverTimestamp(),
        };
        const ref = randomCol.doc('doc');
        let setTimestamp;
        return ref
            .set(baseObject)
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            setTimestamp = doc.get('f');
            (0, chai_1.expect)(setTimestamp).to.be.an.instanceOf(src_1.Timestamp);
            (0, chai_1.expect)(doc.data()).to.deep.equal({
                a: 'bar',
                b: { remove: 'bar' },
                d: { keep: 'bar' },
                f: setTimestamp,
            });
            return ref.update(updateObject);
        })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            const updateTimestamp = doc.get('a');
            (0, chai_1.expect)(setTimestamp).to.be.an.instanceOf(src_1.Timestamp);
            (0, chai_1.expect)(doc.data()).to.deep.equal({
                a: updateTimestamp,
                b: { c: updateTimestamp },
                d: { e: updateTimestamp, keep: 'bar' },
                f: setTimestamp,
            });
        });
    });
    (0, mocha_1.it)('supports increment()', () => {
        const baseData = { sum: 1 };
        const updateData = { sum: src_1.FieldValue.increment(1) };
        const expectedData = { sum: 2 };
        const ref = randomCol.doc('doc');
        return ref
            .set(baseData)
            .then(() => ref.update(updateData))
            .then(() => ref.get())
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal(expectedData);
        });
    });
    (0, mocha_1.it)('supports increment() with set() with merge', () => {
        const baseData = { sum: 1 };
        const updateData = { sum: src_1.FieldValue.increment(1) };
        const expectedData = { sum: 2 };
        const ref = randomCol.doc('doc');
        return ref
            .set(baseData)
            .then(() => ref.set(updateData, { merge: true }))
            .then(() => ref.get())
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal(expectedData);
        });
    });
    (0, mocha_1.it)('supports arrayUnion()', () => {
        const baseObject = {
            a: [],
            b: ['foo'],
            c: { d: ['foo'] },
        };
        const updateObject = {
            a: src_1.FieldValue.arrayUnion('foo', 'bar'),
            b: src_1.FieldValue.arrayUnion('foo', 'bar'),
            'c.d': src_1.FieldValue.arrayUnion('foo', 'bar'),
        };
        const expectedObject = {
            a: ['foo', 'bar'],
            b: ['foo', 'bar'],
            c: { d: ['foo', 'bar'] },
        };
        const ref = randomCol.doc('doc');
        return ref
            .set(baseObject)
            .then(() => ref.update(updateObject))
            .then(() => ref.get())
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal(expectedObject);
        });
    });
    (0, mocha_1.it)('supports arrayRemove()', () => {
        const baseObject = {
            a: [],
            b: ['foo', 'foo', 'baz'],
            c: { d: ['foo', 'bar', 'baz'] },
        };
        const updateObject = {
            a: src_1.FieldValue.arrayRemove('foo'),
            b: src_1.FieldValue.arrayRemove('foo'),
            'c.d': src_1.FieldValue.arrayRemove('foo', 'bar'),
        };
        const expectedObject = {
            a: [],
            b: ['baz'],
            c: { d: ['baz'] },
        };
        const ref = randomCol.doc('doc');
        return ref
            .set(baseObject)
            .then(() => ref.update(updateObject))
            .then(() => ref.get())
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal(expectedObject);
        });
    });
    (0, mocha_1.it)('supports set() with merge', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ 'a.1': 'foo', nested: { 'b.1': 'bar' } })
            .then(() => ref.set({ 'a.2': 'foo', nested: { 'b.2': 'bar' } }, { merge: true }))
            .then(() => ref.get())
            .then(doc => {
            const data = doc.data();
            (0, chai_1.expect)(data).to.deep.equal({
                'a.1': 'foo',
                'a.2': 'foo',
                nested: {
                    'b.1': 'bar',
                    'b.2': 'bar',
                },
            });
        });
    });
    (0, mocha_1.it)('supports server timestamps for merge', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ a: 'b' })
            .then(() => ref.set({ c: src_1.FieldValue.serverTimestamp() }, { merge: true }))
            .then(() => ref.get())
            .then(doc => {
            const updateTimestamp = doc.get('c');
            (0, chai_1.expect)(updateTimestamp).to.be.an.instanceOf(src_1.Timestamp);
            (0, chai_1.expect)(doc.data()).to.deep.equal({
                a: 'b',
                c: updateTimestamp,
            });
        });
    });
    (0, mocha_1.it)('has update() method', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'a' })
            .then(res => {
            return ref.update({ foo: 'b' }, { lastUpdateTime: res.writeTime });
        })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('b');
        });
    });
    (0, mocha_1.it)('enforces that updated document exists', async () => {
        const promise = randomCol.doc().update({ foo: 'b' });
        // Validate the error message when testing against the firestore backend.
        if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
            await (0, chai_1.expect)(promise).to.eventually.be.rejectedWith(/No document to update/);
        }
        else {
            // The emulator generates a different error message, do not validate the error message.
            await (0, chai_1.expect)(promise).to.eventually.be.rejected;
        }
    });
    (0, mocha_1.it)('has delete() method', () => {
        let deleted = false;
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'a' })
            .then(() => {
            return ref.delete();
        })
            .then(() => {
            deleted = true;
            return ref.get();
        })
            .then(result => {
            (0, chai_1.expect)(deleted).to.be.true;
            (0, chai_1.expect)(result.exists).to.be.false;
        });
    });
    (0, mocha_1.it)('can delete() a non-existing document', () => {
        const ref = firestore.collection('col').doc();
        return ref.delete();
    });
    (0, mocha_1.it)('will fail to delete document with exists: true if doc does not exist', async () => {
        const ref = randomCol.doc();
        const promise = ref
            .delete({ exists: true })
            .then(() => Promise.reject('Delete should have failed'));
        // Validate the error message when testing against the firestore backend.
        if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
            await (0, chai_1.expect)(promise).to.eventually.be.rejectedWith(/No document to update/);
        }
        else {
            // The emulator generates a different error message, do not validate the error message.
            await (0, chai_1.expect)(promise).to.eventually.be.rejected;
        }
    });
    (0, mocha_1.it)('supports non-alphanumeric field names', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ '!.\\`': { '!.\\`': 'value' } })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal({ '!.\\`': { '!.\\`': 'value' } });
            return ref.update(new src_1.FieldPath('!.\\`', '!.\\`'), 'new-value');
        })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal({ '!.\\`': { '!.\\`': 'new-value' } });
        });
    });
    (0, mocha_1.it)('has listCollections() method', () => {
        const collections = [];
        const promises = [];
        for (let i = 0; i < 400; i++) {
            const collectionId = i.toString().padStart(3, '0');
            promises.push(randomCol.doc(`doc/${collectionId}/doc`).create({}));
            collections.push(collectionId);
        }
        return Promise.all(promises)
            .then(() => {
            return randomCol.doc('doc').listCollections();
        })
            .then(response => {
            (0, chai_1.expect)(response).to.have.length(collections.length);
            for (let i = 0; i < response.length; ++i) {
                (0, chai_1.expect)(response[i].id).to.equal(collections[i]);
            }
        });
    });
    // tslint:disable-next-line:only-arrow-function
    (0, mocha_1.it)('can add and delete fields sequentially', function () {
        this.timeout(30 * 1000);
        const ref = randomCol.doc('doc');
        const actions = [
            () => ref.create({}),
            () => ref.delete(),
            () => ref.create({ a: { b: 'c' } }),
            () => ref.set({}, { merge: true }),
            () => ref.set({}),
            () => ref.set({ a: { b: 'c' } }),
            () => ref.set({ a: { d: 'e' } }, { merge: true }),
            () => ref.set({ a: { d: src_1.FieldValue.delete() } }, { merge: true }),
            () => ref.set({ a: { b: src_1.FieldValue.delete() } }, { merge: true }),
            () => ref.set({ a: { e: 'foo' } }, { merge: true }),
            () => ref.set({ f: 'foo' }, { merge: true }),
            () => ref.set({ f: { g: 'foo' } }, { merge: true }),
            () => ref.update({ 'f.h': 'foo' }),
            () => ref.update({ 'f.g': src_1.FieldValue.delete() }),
            () => ref.update({ 'f.h': src_1.FieldValue.delete() }),
            () => ref.update({ f: src_1.FieldValue.delete() }),
            () => ref.update({ 'i.j': {} }),
            () => ref.update({ 'i.j': { k: 'foo' } }),
            () => ref.update({ 'i.j': { l: {} } }),
            () => ref.update({ i: src_1.FieldValue.delete() }),
            () => ref.update({ a: src_1.FieldValue.delete() }),
        ];
        const expectedState = [
            {},
            null,
            { a: { b: 'c' } },
            { a: { b: 'c' } },
            {},
            { a: { b: 'c' } },
            { a: { b: 'c', d: 'e' } },
            { a: { b: 'c' } },
            { a: {} },
            { a: { e: 'foo' } },
            { a: { e: 'foo' }, f: 'foo' },
            { a: { e: 'foo' }, f: { g: 'foo' } },
            { a: { e: 'foo' }, f: { g: 'foo', h: 'foo' } },
            { a: { e: 'foo' }, f: { h: 'foo' } },
            { a: { e: 'foo' }, f: {} },
            { a: { e: 'foo' } },
            { a: { e: 'foo' }, i: { j: {} } },
            { a: { e: 'foo' }, i: { j: { k: 'foo' } } },
            { a: { e: 'foo' }, i: { j: { l: {} } } },
            { a: { e: 'foo' } },
            {},
        ];
        let promise = Promise.resolve();
        for (let i = 0; i < actions.length; ++i) {
            promise = promise
                .then(() => actions[i]())
                .then(() => {
                return ref.get();
            })
                .then(snap => {
                if (!snap.exists) {
                    (0, chai_1.expect)(expectedState[i]).to.be.null;
                }
                else {
                    (0, chai_1.expect)(snap.data()).to.deep.equal(expectedState[i]);
                }
            });
        }
        return promise;
    });
    // tslint:disable-next-line:only-arrow-function
    (0, mocha_1.it)('can add and delete fields with server timestamps', function () {
        this.timeout(10 * 1000);
        const ref = randomCol.doc('doc');
        const actions = [
            () => ref.create({
                time: src_1.FieldValue.serverTimestamp(),
                a: { b: src_1.FieldValue.serverTimestamp() },
            }),
            () => ref.set({
                time: src_1.FieldValue.serverTimestamp(),
                a: { c: src_1.FieldValue.serverTimestamp() },
            }),
            () => ref.set({
                time: src_1.FieldValue.serverTimestamp(),
                a: { d: src_1.FieldValue.serverTimestamp() },
            }, { merge: true }),
            () => ref.set({
                time: src_1.FieldValue.serverTimestamp(),
                e: src_1.FieldValue.serverTimestamp(),
            }, { merge: true }),
            () => ref.set({
                time: src_1.FieldValue.serverTimestamp(),
                e: { f: src_1.FieldValue.serverTimestamp() },
            }, { merge: true }),
            () => ref.update({
                time: src_1.FieldValue.serverTimestamp(),
                'g.h': src_1.FieldValue.serverTimestamp(),
            }),
            () => ref.update({
                time: src_1.FieldValue.serverTimestamp(),
                'g.j': { k: src_1.FieldValue.serverTimestamp() },
            }),
        ];
        const expectedState = [
            (times) => {
                return { time: times[0], a: { b: times[0] } };
            },
            (times) => {
                return { time: times[1], a: { c: times[1] } };
            },
            (times) => {
                return { time: times[2], a: { c: times[1], d: times[2] } };
            },
            (times) => {
                return { time: times[3], a: { c: times[1], d: times[2] }, e: times[3] };
            },
            (times) => {
                return {
                    time: times[4],
                    a: { c: times[1], d: times[2] },
                    e: { f: times[4] },
                };
            },
            (times) => {
                return {
                    time: times[5],
                    a: { c: times[1], d: times[2] },
                    e: { f: times[4] },
                    g: { h: times[5] },
                };
            },
            (times) => {
                return {
                    time: times[6],
                    a: { c: times[1], d: times[2] },
                    e: { f: times[4] },
                    g: { h: times[5], j: { k: times[6] } },
                };
            },
        ];
        let promise = Promise.resolve();
        const times = [];
        for (let i = 0; i < actions.length; ++i) {
            promise = promise
                .then(() => actions[i]())
                .then(() => {
                return ref.get();
            })
                .then(snap => {
                times.push(snap.get('time'));
                (0, chai_1.expect)(snap.data()).to.deep.equal(expectedState[i](times));
            });
        }
        return promise;
    });
    (0, mocha_1.it)('can write and read vector embeddings', async () => {
        const ref = randomCol.doc();
        await ref.create({
            vector0: src_1.FieldValue.vector([0.0]),
            vector1: src_1.FieldValue.vector([1, 2, 3.99]),
        });
        await ref.set({
            vector0: src_1.FieldValue.vector([0.0]),
            vector1: src_1.FieldValue.vector([1, 2, 3.99]),
            vector2: src_1.FieldValue.vector([0, 0, 0]),
        });
        await ref.update({
            vector3: src_1.FieldValue.vector([-1, -200, -999]),
        });
        const snap1 = await ref.get();
        (0, chai_1.expect)(snap1.get('vector0').isEqual(src_1.FieldValue.vector([0.0]))).to.be.true;
        (0, chai_1.expect)(snap1.get('vector1').isEqual(src_1.FieldValue.vector([1, 2, 3.99]))).to.be
            .true;
        (0, chai_1.expect)(snap1.get('vector2').isEqual(src_1.FieldValue.vector([0, 0, 0]))).to.be
            .true;
        (0, chai_1.expect)(snap1.get('vector3').isEqual(src_1.FieldValue.vector([-1, -200, -999]))).to
            .be.true;
    });
    (0, mocha_1.describe)('watch', () => {
        const currentDeferred = new DeferredPromise();
        function resetPromise() {
            currentDeferred.promise = new Promise((resolve, reject) => {
                currentDeferred.resolve = resolve;
                currentDeferred.reject = reject;
            });
        }
        function waitForSnapshot() {
            return currentDeferred.promise.then(snapshot => {
                resetPromise();
                return snapshot;
            });
        }
        (0, mocha_1.beforeEach)(() => resetPromise());
        (0, mocha_1.it)('handles changing a doc', () => {
            const ref = randomCol.doc('doc');
            let readTime;
            let createTime;
            let updateTime;
            const unsubscribe = ref.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            return waitForSnapshot()
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add the document.
                return ref.set({ foo: 'a' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('a');
                readTime = snapshot.readTime;
                createTime = snapshot.createTime;
                updateTime = snapshot.updateTime;
                // Update documents.
                return ref.set({ foo: 'b' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                (0, chai_1.expect)(snapshot.get('foo')).to.equal('b');
                (0, chai_1.expect)(snapshot.createTime.isEqual(createTime)).to.be.true;
                (0, chai_1.expect)(snapshot.readTime.toMillis()).to.be.greaterThan(readTime.toMillis());
                (0, chai_1.expect)(snapshot.updateTime.toMillis()).to.be.greaterThan(updateTime.toMillis());
                unsubscribe();
            });
        });
        (0, mocha_1.it)('handles deleting a doc', () => {
            const ref = randomCol.doc('doc');
            const unsubscribe = ref.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            return waitForSnapshot()
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                // Add the document.
                return ref.set({ foo: 'a' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.true;
                // Delete the document.
                return ref.delete();
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.be.false;
                unsubscribe();
            });
        });
        (0, mocha_1.it)('handles multiple docs', done => {
            const doc1 = randomCol.doc();
            const doc2 = randomCol.doc();
            // Documents transition from non-existent to existent to non-existent.
            const exists1 = [false, true, false];
            const exists2 = [false, true, false];
            const promises = [];
            // Code blocks to run after each step.
            const run = [
                () => {
                    promises.push(doc1.set({ foo: 'foo' }));
                    promises.push(doc2.set({ foo: 'foo' }));
                },
                () => {
                    promises.push(doc1.delete());
                    promises.push(doc2.delete());
                },
                () => {
                    unsubscribe1();
                    unsubscribe2();
                    Promise.all(promises).then(() => done());
                },
            ];
            const maybeRun = () => {
                if (exists1.length === exists2.length) {
                    run.shift()();
                }
            };
            const unsubscribe1 = doc1.onSnapshot(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.equal(exists1.shift());
                maybeRun();
            });
            const unsubscribe2 = doc2.onSnapshot(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.equal(exists2.shift());
                maybeRun();
            });
        });
        (0, mocha_1.it)('handles multiple streams on same doc', done => {
            const doc = randomCol.doc();
            // Document transitions from non-existent to existent to non-existent.
            const exists1 = [false, true, false];
            const exists2 = [false, true, false];
            const promises = [];
            // Code blocks to run after each step.
            const run = [
                () => {
                    promises.push(doc.set({ foo: 'foo' }));
                },
                () => {
                    promises.push(doc.delete());
                },
                () => {
                    unsubscribe1();
                    unsubscribe2();
                    Promise.all(promises).then(() => done());
                },
            ];
            const maybeRun = () => {
                if (exists1.length === exists2.length) {
                    run.shift()();
                }
            };
            const unsubscribe1 = doc.onSnapshot(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.equal(exists1.shift());
                maybeRun();
            });
            const unsubscribe2 = doc.onSnapshot(snapshot => {
                (0, chai_1.expect)(snapshot.exists).to.equal(exists2.shift());
                maybeRun();
            });
        });
        (0, mocha_1.it)('handles more than 100 concurrent listeners', async () => {
            const ref = randomCol.doc('doc');
            const emptyResults = [];
            const documentResults = [];
            const unsubscribeCallbacks = [];
            // A single GAPIC client can only handle 100 concurrent streams. We set
            // up 100+ long-lived listeners to verify that Firestore pools requests
            // across multiple clients.
            for (let i = 0; i < 150; ++i) {
                emptyResults[i] = new util_1.Deferred();
                documentResults[i] = new util_1.Deferred();
                unsubscribeCallbacks[i] = randomCol
                    .where('i', '>', i)
                    .onSnapshot(snapshot => {
                    if (snapshot.size === 0) {
                        emptyResults[i].resolve();
                    }
                    else if (snapshot.size === 1) {
                        documentResults[i].resolve();
                    }
                });
            }
            await Promise.all(emptyResults.map(d => d.promise));
            await ref.set({ i: 1337 });
            await Promise.all(documentResults.map(d => d.promise));
            unsubscribeCallbacks.forEach(c => c());
        });
        (0, mocha_1.it)('handles query snapshots with converters', async () => {
            const setupDeferred = new util_1.Deferred();
            const resultsDeferred = new util_1.Deferred();
            const ref = randomCol.doc('doc').withConverter(helpers_1.postConverter);
            const unsubscribe = randomCol
                .where('title', '==', 'post')
                .withConverter(helpers_1.postConverter)
                .onSnapshot(snapshot => {
                if (snapshot.size === 0) {
                    setupDeferred.resolve();
                }
                if (snapshot.size === 1) {
                    resultsDeferred.resolve(snapshot);
                }
            });
            await setupDeferred.promise;
            await ref.set(new helpers_1.Post('post', 'author'));
            const snapshot = await resultsDeferred.promise;
            (0, chai_1.expect)(snapshot.docs[0].data().toString()).to.equal('post, by author');
            unsubscribe();
        });
    });
    (0, mocha_1.it)('supports withConverter()', async () => {
        const ref = firestore
            .collection('col')
            .doc('doc')
            .withConverter(helpers_1.postConverter);
        await ref.set(new helpers_1.Post('post', 'author'));
        const postData = await ref.get();
        const post = postData.data();
        (0, chai_1.expect)(post).to.not.be.undefined;
        (0, chai_1.expect)(post.toString()).to.equal('post, by author');
    });
    (0, mocha_1.it)('supports primitive types with valid converter', async () => {
        const primitiveConverter = {
            toFirestore(value) {
                return { value };
            },
            fromFirestore(snapshot) {
                const data = snapshot.data();
                return data.value;
            },
        };
        const arrayConverter = {
            toFirestore(value) {
                return { values: value };
            },
            fromFirestore(snapshot) {
                const data = snapshot.data();
                return data.values;
            },
        };
        const coll = firestore.collection('tests');
        const ref = coll.doc('number').withConverter(primitiveConverter);
        await ref.set(3);
        const result = await ref.get();
        (0, chai_1.expect)(result.data()).to.equal(3);
        const ref2 = coll.doc('array').withConverter(arrayConverter);
        await ref2.set([1, 2, 3]);
        const result2 = await ref2.get();
        (0, chai_1.expect)(result2.data()).to.deep.equal([1, 2, 3]);
    });
    (0, mocha_1.it)('can listen to documents with vectors', async () => {
        const ref = randomCol.doc();
        const initialDeferred = new util_1.Deferred();
        const createDeferred = new util_1.Deferred();
        const setDeferred = new util_1.Deferred();
        const updateDeferred = new util_1.Deferred();
        const deleteDeferred = new util_1.Deferred();
        const expected = [
            initialDeferred,
            createDeferred,
            setDeferred,
            updateDeferred,
            deleteDeferred,
        ];
        let idx = 0;
        let document = null;
        const unlisten = randomCol
            .where('purpose', '==', 'vector tests')
            .onSnapshot(snap => {
            expected[idx].resolve();
            idx += 1;
            if (snap.docs.length > 0) {
                document = snap.docs[0];
            }
            else {
                document = null;
            }
        });
        await initialDeferred.promise;
        (0, chai_1.expect)(document).to.be.null;
        await ref.create({
            purpose: 'vector tests',
            vector0: src_1.FieldValue.vector([0.0]),
            vector1: src_1.FieldValue.vector([1, 2, 3.99]),
        });
        await createDeferred.promise;
        (0, chai_1.expect)(document).to.be.not.null;
        (0, chai_1.expect)(document.get('vector0').isEqual(src_1.FieldValue.vector([0.0]))).to.be
            .true;
        (0, chai_1.expect)(document.get('vector1').isEqual(src_1.FieldValue.vector([1, 2, 3.99]))).to
            .be.true;
        await ref.set({
            purpose: 'vector tests',
            vector0: src_1.FieldValue.vector([0.0]),
            vector1: src_1.FieldValue.vector([1, 2, 3.99]),
            vector2: src_1.FieldValue.vector([0, 0, 0]),
        });
        await setDeferred.promise;
        (0, chai_1.expect)(document).to.be.not.null;
        (0, chai_1.expect)(document.get('vector0').isEqual(src_1.FieldValue.vector([0.0]))).to.be
            .true;
        (0, chai_1.expect)(document.get('vector1').isEqual(src_1.FieldValue.vector([1, 2, 3.99]))).to
            .be.true;
        (0, chai_1.expect)(document.get('vector2').isEqual(src_1.FieldValue.vector([0, 0, 0]))).to.be
            .true;
        await ref.update({
            vector3: src_1.FieldValue.vector([-1, -200, -999]),
        });
        await updateDeferred.promise;
        (0, chai_1.expect)(document).to.be.not.null;
        (0, chai_1.expect)(document.get('vector0').isEqual(src_1.FieldValue.vector([0.0]))).to.be
            .true;
        (0, chai_1.expect)(document.get('vector1').isEqual(src_1.FieldValue.vector([1, 2, 3.99]))).to
            .be.true;
        (0, chai_1.expect)(document.get('vector2').isEqual(src_1.FieldValue.vector([0, 0, 0]))).to.be
            .true;
        (0, chai_1.expect)(document.get('vector3').isEqual(src_1.FieldValue.vector([-1, -200, -999]))).to.be.true;
        await ref.delete();
        await deleteDeferred.promise;
        (0, chai_1.expect)(document).to.be.null;
        unlisten();
    });
});
(0, mocha_1.describe)('runs query on a large collection', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(async () => {
        firestore = new src_1.Firestore({});
        randomCol = getTestRoot(firestore);
        const promises = [];
        for (let i = 0; i < 1000; i++) {
            promises.push(randomCol.add({ foo: 'a' }));
        }
        await Promise.all(promises);
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('can get()', () => {
        return randomCol.get().then(res => {
            (0, chai_1.expect)(res.size).to.equal(1000);
        });
    });
    (0, mocha_1.it)('can stream()', async () => {
        let received = 0;
        const stream = randomCol.stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(1000);
    });
});
(0, mocha_1.describe)('Query class', () => {
    let firestore;
    let randomCol;
    const paginateResults = (query, startAfter) => {
        return (startAfter ? query.startAfter(startAfter) : query)
            .get()
            .then(snapshot => {
            if (snapshot.empty) {
                return { pages: 0, docs: [] };
            }
            else {
                const docs = snapshot.docs;
                return paginateResults(query, docs[docs.length - 1]).then(nextPage => {
                    return {
                        pages: nextPage.pages + 1,
                        docs: docs.concat(nextPage.docs),
                    };
                });
            }
        });
    };
    async function addDocs(...docs) {
        let id = 0; // Guarantees consistent ordering for the first documents
        const refs = [];
        for (const doc of docs) {
            const ref = randomCol.doc('doc' + id++);
            await ref.set(doc);
            refs.push(ref);
        }
        return refs;
    }
    async function testCollectionWithDocs(docs) {
        for (const id in docs) {
            const ref = randomCol.doc(id);
            await ref.set(docs[id]);
        }
        return randomCol;
    }
    function expectDocs(result, ...data) {
        (0, chai_1.expect)(result.size).to.equal(data.length);
        if (data.length > 0) {
            if (typeof data[0] === 'string') {
                const actualIds = result.docs.map(docSnapshot => docSnapshot.id);
                (0, chai_1.expect)(actualIds).to.deep.equal(data);
            }
            else {
                result.forEach(doc => {
                    (0, chai_1.expect)(doc.data()).to.deep.equal(data.shift());
                });
            }
        }
    }
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has firestore property', () => {
        const ref = randomCol.limit(0);
        (0, chai_1.expect)(ref.firestore).to.be.an.instanceOf(src_1.Firestore);
    });
    (0, mocha_1.it)('has select() method', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'bar', bar: 'foo' })
            .then(() => {
            return randomCol.select('foo').get();
        })
            .then(res => {
            (0, chai_1.expect)(res.docs[0].data()).to.deep.equal({ foo: 'bar' });
        });
    });
    (0, mocha_1.it)('select() supports empty fields', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'bar', bar: 'foo' })
            .then(() => {
            return randomCol.select().get();
        })
            .then(res => {
            (0, chai_1.expect)(res.docs[0].ref.id).to.deep.equal('doc');
            (0, chai_1.expect)(res.docs[0].data()).to.deep.equal({});
        });
    });
    (0, mocha_1.it)('has where() method', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'bar' })
            .then(() => {
            return randomCol.where('foo', '==', 'bar').get();
        })
            .then(res => {
            (0, chai_1.expect)(res.docs[0].data()).to.deep.equal({ foo: 'bar' });
        });
    });
    (0, mocha_1.it)('supports NaN and Null', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: NaN, bar: null })
            .then(() => {
            return randomCol.where('foo', '==', NaN).where('bar', '==', null).get();
        })
            .then(res => {
            (0, chai_1.expect)(typeof res.docs[0].get('foo') === 'number' &&
                isNaN(res.docs[0].get('foo')));
            (0, chai_1.expect)(res.docs[0].get('bar')).to.equal(null);
        });
    });
    (0, mocha_1.it)('supports array-contains', () => {
        return Promise.all([
            randomCol.add({ foo: ['bar'] }),
            randomCol.add({ foo: [] }),
        ])
            .then(() => randomCol.where('foo', 'array-contains', 'bar').get())
            .then(res => {
            (0, chai_1.expect)(res.size).to.equal(1);
            (0, chai_1.expect)(res.docs[0].get('foo')).to.deep.equal(['bar']);
        });
    });
    (0, mocha_1.describe)('vector search', () => {
        (0, mocha_1.it)('supports findNearest by EUCLIDEAN distance', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionReference = await indexTestHelper.createTestDocs([
                { foo: 'bar' },
                { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(3);
            (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([10, 0])))
                .to.be.true;
            (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 1]))).to
                .be.true;
            (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([20, 0])))
                .to.be.true;
        });
        (0, mocha_1.it)('supports findNearest by COSINE distance', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionReference = await indexTestHelper.setTestDocs({
                '1': { foo: 'bar' },
                '2': { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) },
                '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
                '4': { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) },
                '5': { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
                '6': { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
            });
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'COSINE',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(3);
            if (res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, 1]))) {
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([100, 100]))).to.be.true;
            }
            else {
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([100, 100]))).to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 1])))
                    .to.be.true;
            }
            (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([20, 0])) ||
                res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([20, 0]))).to.be.true;
        });
        (0, mocha_1.it)('supports findNearest by DOT_PRODUCT distance', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionReference = await indexTestHelper.createTestDocs([
                { foo: 'bar' },
                { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'DOT_PRODUCT',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(3);
            (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([100, 100]))).to.be.true;
            (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([20, 0])))
                .to.be.true;
            (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([10, 0])))
                .to.be.true;
        });
        (0, mocha_1.it)('findNearest works with converters', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            class FooDistance {
                constructor(foo, embedding) {
                    this.foo = foo;
                    this.embedding = embedding;
                }
            }
            const fooConverter = {
                toFirestore(d) {
                    return { title: d.foo, embedding: src_1.FieldValue.vector(d.embedding) };
                },
                fromFirestore(snapshot) {
                    const data = snapshot.data();
                    return new FooDistance(data.foo, data.embedding.toArray());
                },
            };
            const collectionRef = await indexTestHelper.createTestDocs([
                { foo: 'bar', embedding: src_1.FieldValue.vector([5, 5]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionRef)
                .withConverter(fooConverter)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(1);
            (0, chai_1.expect)(res.docs[0].data().foo).to.equal('bar');
            (0, chai_1.expect)(res.docs[0].data().embedding).to.deep.equal([5, 5]);
        });
        (0, mocha_1.it)('supports findNearest skipping fields of wrong types', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionRef = await indexTestHelper.createTestDocs([
                { foo: 'bar' },
                // These documents are skipped because it is not really a vector value
                { foo: 'bar', embedding: [10, 10] },
                { foo: 'bar', embedding: 'not actually a vector' },
                { foo: 'bar', embedding: null },
                // Actual vector values
                { foo: 'bar', embedding: src_1.FieldValue.vector([9, 9]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([50, 50]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionRef)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 100, // Intentionally large to get all matches.
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(3);
            (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([9, 9]))).to
                .be.true;
            (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([50, 50])))
                .to.be.true;
            (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([100, 100]))).to.be.true;
        });
        (0, mocha_1.it)('findNearest ignores mismatching dimensions', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionRef = await indexTestHelper.createTestDocs([
                { foo: 'bar' },
                // Vectors with dimension mismatch
                { foo: 'bar', embedding: src_1.FieldValue.vector([10]) },
                // Vectors with dimension match
                { foo: 'bar', embedding: src_1.FieldValue.vector([9, 9]) },
                { foo: 'bar', embedding: src_1.FieldValue.vector([50, 50]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionRef)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(2);
            (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([9, 9]))).to
                .be.true;
            (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([50, 50])))
                .to.be.true;
        });
        (0, mocha_1.it)('supports findNearest on non-existent field', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionRef = await indexTestHelper.createTestDocs([
                { foo: 'bar' },
                { foo: 'bar', otherField: [10, 10] },
                { foo: 'bar', otherField: 'not actually a vector' },
                { foo: 'bar', otherField: null },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionRef)
                .where('foo', '==', 'bar')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(0);
        });
        (0, mocha_1.it)('supports findNearest on vector nested in a map', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionReference = await indexTestHelper.createTestDocs([
                { nested: { foo: 'bar' } },
                { nested: { foo: 'xxx', embedding: src_1.FieldValue.vector([10, 10]) } },
                { nested: { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) } },
                { nested: { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) } },
                { nested: { foo: 'bar', embedding: src_1.FieldValue.vector([20, 0]) } },
                { nested: { foo: 'bar', embedding: src_1.FieldValue.vector([100, 100]) } },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .findNearest({
                vectorField: 'nested.embedding',
                queryVector: [10, 10],
                limit: 3,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(3);
            (0, chai_1.expect)(res.docs[0].get('nested.embedding').isEqual(src_1.FieldValue.vector([10, 10]))).to.be.true;
            (0, chai_1.expect)(res.docs[1].get('nested.embedding').isEqual(src_1.FieldValue.vector([10, 0]))).to.be.true;
            (0, chai_1.expect)(res.docs[2].get('nested.embedding').isEqual(src_1.FieldValue.vector([1, 1]))).to.be.true;
        });
        (0, mocha_1.it)('supports findNearest with select to exclude vector data in response', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const collectionReference = await indexTestHelper.createTestDocs([
                { foo: 1 },
                { foo: 2, embedding: src_1.FieldValue.vector([10, 10]) },
                { foo: 3, embedding: src_1.FieldValue.vector([1, 1]) },
                { foo: 4, embedding: src_1.FieldValue.vector([10, 0]) },
                { foo: 5, embedding: src_1.FieldValue.vector([20, 0]) },
                { foo: 6, embedding: src_1.FieldValue.vector([100, 100]) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .where('foo', 'in', [1, 2, 3, 4, 5, 6])
                .select('foo')
                .findNearest({
                vectorField: 'embedding',
                queryVector: [10, 10],
                limit: 10,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(5);
            (0, chai_1.expect)(res.docs[0].get('foo')).to.equal(2);
            (0, chai_1.expect)(res.docs[1].get('foo')).to.equal(4);
            (0, chai_1.expect)(res.docs[2].get('foo')).to.equal(3);
            (0, chai_1.expect)(res.docs[3].get('foo')).to.equal(5);
            (0, chai_1.expect)(res.docs[4].get('foo')).to.equal(6);
            res.docs.forEach(ds => (0, chai_1.expect)(ds.get('embedding')).to.be.undefined);
        });
        (0, mocha_1.it)('supports findNearest limits', async () => {
            const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
            const embeddingVector = [];
            const queryVector = [];
            for (let i = 0; i < 2048; i++) {
                embeddingVector.push(i + 1);
                queryVector.push(i - 1);
            }
            const collectionReference = await indexTestHelper.createTestDocs([
                { embedding: src_1.FieldValue.vector(embeddingVector) },
            ]);
            const vectorQuery = indexTestHelper
                .query(collectionReference)
                .findNearest({
                vectorField: 'embedding',
                queryVector: queryVector,
                limit: 1000,
                distanceMeasure: 'EUCLIDEAN',
            });
            const res = await vectorQuery.get();
            (0, chai_1.expect)(res.size).to.equal(1);
            (0, chai_1.expect)(res.docs[0].get('embedding').toArray()).to.deep.equal(embeddingVector);
        });
        (0, mocha_1.describe)('preview API (deprecated)', () => {
            (0, mocha_1.it)('supports findNearest with EUCLIDEAN', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.createTestDocs([
                    { foo: 'bar' },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([10, 10]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1.1]) },
                    { foo: 'x', embedding: src_1.FieldValue.vector([1, 1]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([-100, -100]) },
                ]);
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .where('foo', '==', 'bar')
                    .findNearest('embedding', [1, 1], {
                    limit: 3,
                    distanceMeasure: 'EUCLIDEAN',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(3);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, 1.1]))).to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([10, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([10, 10]))).to.be.true;
            });
            (0, mocha_1.it)('supports findNearest with COSINE', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.createTestDocs([
                    { foo: 'bar' },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([10, 10]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1.1]) },
                    { foo: 'x', embedding: src_1.FieldValue.vector([1, 1]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([10, 0]) },
                    { foo: 'bar', embedding: src_1.FieldValue.vector([-100, -100]) },
                ]);
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .where('foo', '==', 'bar')
                    .findNearest('embedding', [1, 1], {
                    limit: 3,
                    distanceMeasure: 'COSINE',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(3);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([10, 10]))).to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 1.1]))).to.be.true;
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([10, 0])))
                    .to.be.true;
            });
        });
        (0, mocha_1.describe)('requesting computed distance', () => {
            (0, mocha_1.it)('supports requesting computed COSINE distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([0, 1]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([0, -0.1]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([-1, 0]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'COSINE',
                    distanceResultField: 'distance',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(4);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[0].get('distance')).to.equal(0);
                (0, chai_1.expect)(res.docs[1].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[2].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[3].get('embedding').isEqual(src_1.FieldValue.vector([-1, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[3].get('distance')).to.equal(2);
            });
            (0, mocha_1.it)('supports requesting computed EUCLIDEAN distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([1, -0.1]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([4, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'EUCLIDEAN',
                    distanceResultField: 'distance',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(4);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, -0.1]))).to.be.true;
                (0, chai_1.expect)(res.docs[0].get('distance')).to.equal(0.1);
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([4, 4])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[2].get('distance')).to.equal(5);
                (0, chai_1.expect)(res.docs[3].get('embedding').isEqual(src_1.FieldValue.vector([1, 100]))).to.be.true;
                (0, chai_1.expect)(res.docs[3].get('distance')).to.equal(100);
            });
            (0, mocha_1.it)('supports requesting computed DOT_PRODUCT distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([-20, 0]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([0.1, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'DOT_PRODUCT',
                    distanceResultField: 'distance',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(4);
                (0, chai_1.expect)(res.docs[0].get('distance')).to.equal(2);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 100]))).to.be.true;
                (0, chai_1.expect)(res.docs[2].get('distance')).to.equal(0.1);
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([0.1, 4]))).to.be.true;
                (0, chai_1.expect)(res.docs[3].get('distance')).to.equal(-20);
                (0, chai_1.expect)(res.docs[3].get('embedding').isEqual(src_1.FieldValue.vector([-20, 0]))).to.be.true;
            });
            (0, mocha_1.it)('overwrites distance result field on conflict', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': {
                        foo: 'bar',
                        embedding: src_1.FieldValue.vector([0, 1]),
                        distance: '100 miles',
                    },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'COSINE',
                    distanceResultField: 'distance',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(1);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([0, 1])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[0].get('distance')).to.equal(1);
            });
            (0, mocha_1.it)('supports requesting computed distance in select queries', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([0, 1]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([0, -0.1]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([-1, 0]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    // value of `distanceResultField` must also be in select statement
                    .select('embedding', 'distance')
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'COSINE',
                    distanceResultField: 'distance',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(4);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[0].get('distance')).to.equal(0);
                (0, chai_1.expect)(res.docs[1].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[2].get('distance')).to.equal(1);
                (0, chai_1.expect)(res.docs[3].get('embedding').isEqual(src_1.FieldValue.vector([-1, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[3].get('distance')).to.equal(2);
            });
        });
        (0, mocha_1.describe)('querying with distance threshold', () => {
            (0, mocha_1.it)('supports querying with distance threshold using COSINE distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 1]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([0, -0.1]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([-1, 0]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'COSINE',
                    distanceThreshold: 1,
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(3);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 1])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([0, -0.1]))).to.be.true;
            });
            (0, mocha_1.it)('supports querying with distance threshold using EUCLIDEAN distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([1, -0.1]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([4, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'EUCLIDEAN',
                    distanceThreshold: 5,
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(3);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([1, -0.1]))).to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[2].get('embedding').isEqual(src_1.FieldValue.vector([4, 4])))
                    .to.be.true;
            });
            (0, mocha_1.it)('supports querying with distance threshold using DOT_PRODUCT distance', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([-20, 0]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([0.1, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'DOT_PRODUCT',
                    distanceThreshold: 1,
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(2);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 100]))).to.be.true;
            });
            (0, mocha_1.it)('works with distance result field', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([-20, 0]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([0.1, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 5,
                    distanceMeasure: 'DOT_PRODUCT',
                    distanceThreshold: 0.11,
                    distanceResultField: 'foo',
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(2);
                (0, chai_1.expect)(res.docs[0].get('foo')).to.equal(2);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('foo')).to.equal(1);
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 100]))).to.be.true;
            });
            (0, mocha_1.it)('will not exceed limit even if there are more results more similar than distanceThreshold', async () => {
                const indexTestHelper = new index_test_helper_1.IndexTestHelper(firestore);
                const collectionReference = await indexTestHelper.setTestDocs({
                    '1': { foo: 'bar' },
                    '2': { foo: 'bar', embedding: src_1.FieldValue.vector([2, 0]) },
                    '3': { foo: 'bar', embedding: src_1.FieldValue.vector([1, 100]) },
                    '4': { foo: 'bar', embedding: src_1.FieldValue.vector([-20, 0]) },
                    '5': { foo: 'bar', embedding: src_1.FieldValue.vector([0.1, 4]) },
                });
                const vectorQuery = indexTestHelper
                    .query(collectionReference)
                    .findNearest({
                    vectorField: 'embedding',
                    queryVector: [1, 0],
                    limit: 2,
                    distanceMeasure: 'DOT_PRODUCT',
                    distanceThreshold: 0.0,
                });
                const res = await vectorQuery.get();
                (0, chai_1.expect)(res.size).to.equal(2);
                (0, chai_1.expect)(res.docs[0].get('embedding').isEqual(src_1.FieldValue.vector([2, 0])))
                    .to.be.true;
                (0, chai_1.expect)(res.docs[1].get('embedding').isEqual(src_1.FieldValue.vector([1, 100]))).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('supports !=', async () => {
        await addDocs({ zip: NaN }, { zip: 91102 }, { zip: 98101 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } }, { zip: null });
        let res = await randomCol.where('zip', '!=', 98101).get();
        expectDocs(res, { zip: NaN }, { zip: 91102 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        res = await randomCol.where('zip', '!=', NaN).get();
        expectDocs(res, { zip: 91102 }, { zip: 98101 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        res = await randomCol.where('zip', '!=', null).get();
        expectDocs(res, { zip: NaN }, { zip: 91102 }, { zip: 98101 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
    });
    (0, mocha_1.it)('supports != with document ID', async () => {
        const refs = await addDocs({ count: 1 }, { count: 2 }, { count: 3 });
        const res = await randomCol
            .where(src_1.FieldPath.documentId(), '!=', refs[0].id)
            .get();
        expectDocs(res, { count: 2 }, { count: 3 });
    });
    (0, mocha_1.it)('supports not-in', async () => {
        await addDocs({ zip: 98101 }, { zip: 91102 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        let res = await randomCol.where('zip', 'not-in', [98101, 98103]).get();
        expectDocs(res, { zip: 91102 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        res = await randomCol.where('zip', 'not-in', [NaN]).get();
        expectDocs(res, { zip: 91102 }, { zip: 98101 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        res = await randomCol.where('zip', 'not-in', [null]).get();
        (0, chai_1.expect)(res.size).to.equal(0);
    });
    (0, mocha_1.it)('supports not-in with document ID array', async () => {
        const refs = await addDocs({ count: 1 }, { count: 2 }, { count: 3 });
        const res = await randomCol
            .where(src_1.FieldPath.documentId(), 'not-in', [refs[0].id, refs[1]])
            .get();
        expectDocs(res, { count: 3 });
    });
    (0, mocha_1.it)('supports "in"', async () => {
        await addDocs({ zip: 98101 }, { zip: 91102 }, { zip: 98103 }, { zip: [98101] }, { zip: ['98101', { zip: 98101 }] }, { zip: { zip: 98101 } });
        const res = await randomCol.where('zip', 'in', [98101, 98103]).get();
        expectDocs(res, { zip: 98101 }, { zip: 98103 });
    });
    (0, mocha_1.it)('supports "in" with document ID array', async () => {
        const refs = await addDocs({ count: 1 }, { count: 2 }, { count: 3 });
        const res = await randomCol
            .where(src_1.FieldPath.documentId(), 'in', [refs[0].id, refs[1]])
            .get();
        expectDocs(res, { count: 1 }, { count: 2 });
    });
    (0, mocha_1.it)('supports array-contains-any', async () => {
        await addDocs({ array: [42] }, { array: ['a', 42, 'c'] }, { array: [41.999, '42', { a: [42] }] }, { array: [42], array2: ['sigh'] }, { array: [43] }, { array: [{ a: 42 }] }, { array: 42 });
        const res = await randomCol
            .where('array', 'array-contains-any', [42, 43])
            .get();
        expectDocs(res, { array: [42] }, { array: ['a', 42, 'c'] }, {
            array: [42],
            array2: ['sigh'],
        }, { array: [43] });
    });
    (0, mocha_1.it)('can query by FieldPath.documentId()', () => {
        const ref = randomCol.doc('foo');
        return ref
            .set({})
            .then(() => {
            return randomCol.where(src_1.FieldPath.documentId(), '>=', 'bar').get();
        })
            .then(res => {
            (0, chai_1.expect)(res.docs.length).to.equal(1);
        });
    });
    (0, mocha_1.it)('has orderBy() method', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        let res = await randomCol.orderBy('foo').get();
        expectDocs(res, { foo: 'a' }, { foo: 'b' });
        res = await randomCol.orderBy('foo', 'desc').get();
        expectDocs(res, { foo: 'b' }, { foo: 'a' });
    });
    (0, mocha_1.it)('can order by FieldPath.documentId()', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({ foo: 'a' }), ref2.set({ foo: 'b' })])
            .then(() => {
            return randomCol.orderBy(src_1.FieldPath.documentId()).get();
        })
            .then(res => {
            (0, chai_1.expect)(res.docs[0].data()).to.deep.equal({ foo: 'a' });
            (0, chai_1.expect)(res.docs[1].data()).to.deep.equal({ foo: 'b' });
        });
    });
    (0, mocha_1.it)('can run get() on empty collection', async () => {
        return randomCol.get().then(res => {
            return (0, chai_1.expect)(res.empty);
        });
    });
    (0, mocha_1.it)('can run stream() on empty collection', async () => {
        let received = 0;
        const stream = randomCol.stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(0);
    });
    (0, mocha_1.it)('has limit() method on get()', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').limit(1).get();
        expectDocs(res, { foo: 'a' });
    });
    (0, mocha_1.it)('has limit() method on stream()', async () => {
        let received = 0;
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const stream = randomCol.orderBy('foo').limit(1).stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(1);
    });
    (0, mocha_1.it)('can run limit(num), where num is larger than the collection size on get()', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').limit(3).get();
        expectDocs(res, { foo: 'a' }, { foo: 'b' });
    });
    (0, mocha_1.it)('can run limit(num), where num is larger than the collection size on stream()', async () => {
        let received = 0;
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const stream = randomCol.orderBy('foo').limit(3).stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(2);
    });
    (0, mocha_1.it)('has limitToLast() method', async () => {
        await addDocs({ doc: 1 }, { doc: 2 }, { doc: 3 });
        const res = await randomCol.orderBy('doc').limitToLast(2).get();
        expectDocs(res, { doc: 2 }, { doc: 3 });
    });
    (0, mocha_1.it)('limitToLast() supports Query cursors', async () => {
        await addDocs({ doc: 1 }, { doc: 2 }, { doc: 3 }, { doc: 4 }, { doc: 5 });
        const res = await randomCol
            .orderBy('doc')
            .startAt(2)
            .endAt(4)
            .limitToLast(5)
            .get();
        expectDocs(res, { doc: 2 }, { doc: 3 }, { doc: 4 });
    });
    (0, mocha_1.it)('can use offset() method with get()', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').offset(1).get();
        expectDocs(res, { foo: 'b' });
    });
    (0, mocha_1.it)('can use offset() method with stream()', async () => {
        let received = 0;
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const stream = randomCol.orderBy('foo').offset(1).stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(1);
    });
    (0, mocha_1.it)('can run offset(num), where num is larger than the collection size on get()', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').offset(3).get();
        (0, chai_1.expect)(res.empty);
    });
    (0, mocha_1.it)('can run offset(num), where num is larger than the collection size on stream()', async () => {
        let received = 0;
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const stream = randomCol.orderBy('foo').offset(3).stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(0);
    });
    (0, mocha_1.it)('supports Unicode in document names', async () => {
        const collRef = randomCol.doc('доброеутро').collection('coll');
        await collRef.add({});
        const snapshot = await collRef.get();
        (0, chai_1.expect)(snapshot.size).to.equal(1);
    });
    (0, mocha_1.it)('supports pagination', () => {
        const batch = firestore.batch();
        for (let i = 0; i < 10; ++i) {
            batch.set(randomCol.doc('doc' + i), { val: i });
        }
        const query = randomCol.orderBy('val').limit(3);
        return batch
            .commit()
            .then(() => paginateResults(query))
            .then(results => {
            (0, chai_1.expect)(results.pages).to.equal(4);
            (0, chai_1.expect)(results.docs).to.have.length(10);
        });
    });
    (0, mocha_1.it)('supports pagination with where() clauses', () => {
        const batch = firestore.batch();
        for (let i = 0; i < 10; ++i) {
            batch.set(randomCol.doc('doc' + i), { val: i });
        }
        const query = randomCol.where('val', '>=', 1).limit(3);
        return batch
            .commit()
            .then(() => paginateResults(query))
            .then(results => {
            (0, chai_1.expect)(results.pages).to.equal(3);
            (0, chai_1.expect)(results.docs).to.have.length(9);
        });
    });
    (0, mocha_1.it)('supports pagination with array-contains filter', () => {
        const batch = firestore.batch();
        for (let i = 0; i < 10; ++i) {
            batch.set(randomCol.doc('doc' + i), { array: ['foo'] });
        }
        const query = randomCol.where('array', 'array-contains', 'foo').limit(3);
        return batch
            .commit()
            .then(() => paginateResults(query))
            .then(results => {
            (0, chai_1.expect)(results.pages).to.equal(4);
            (0, chai_1.expect)(results.docs).to.have.length(10);
        });
    });
    (0, mocha_1.it)('has startAt() method', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').startAt('b').get();
        expectDocs(res, { foo: 'b' });
    });
    (0, mocha_1.it)('startAt() adds implicit order by for DocumentSnapshot', async () => {
        const references = await addDocs({ foo: 'a' }, { foo: 'b' });
        const docSnap = await references[1].get();
        const res = await randomCol.startAt(docSnap).get();
        expectDocs(res, { foo: 'b' });
    });
    (0, mocha_1.it)('has startAfter() method', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').startAfter('a').get();
        expectDocs(res, { foo: 'b' });
    });
    (0, mocha_1.it)('has endAt() method', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').endAt('b').get();
        expectDocs(res, { foo: 'a' }, { foo: 'b' });
    });
    (0, mocha_1.it)('has endBefore() method', async () => {
        await addDocs({ foo: 'a' }, { foo: 'b' });
        const res = await randomCol.orderBy('foo').endBefore('b').get();
        expectDocs(res, { foo: 'a' });
    });
    (0, mocha_1.it)('has stream() method', done => {
        let received = 0;
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        Promise.all([ref1.set({ foo: 'a' }), ref2.set({ foo: 'b' })]).then(() => {
            return randomCol
                .stream()
                .on('data', d => {
                (0, chai_1.expect)(d).to.be.an.instanceOf(src_1.DocumentSnapshot);
                ++received;
            })
                .on('end', () => {
                (0, chai_1.expect)(received).to.equal(2);
                done();
            });
        });
    });
    (0, mocha_1.it)('stream() supports readable[Symbol.asyncIterator]()', async () => {
        let received = 0;
        await randomCol.doc().set({ foo: 'bar' });
        await randomCol.doc().set({ foo: 'bar' });
        const stream = randomCol.stream();
        for await (const doc of stream) {
            (0, chai_1.expect)(doc).to.be.an.instanceOf(src_1.QueryDocumentSnapshot);
            ++received;
        }
        (0, chai_1.expect)(received).to.equal(2);
    });
    (0, mocha_1.it)('can query collection groups', async () => {
        // Use `randomCol` to get a random collection group name to use but ensure
        // it starts with 'b' for predictable ordering.
        const collectionGroup = 'b' + randomCol.id;
        const docPaths = [
            `abc/123/${collectionGroup}/cg-doc1`,
            `abc/123/${collectionGroup}/cg-doc2`,
            `${collectionGroup}/cg-doc3`,
            `${collectionGroup}/cg-doc4`,
            `def/456/${collectionGroup}/cg-doc5`,
            `${collectionGroup}/virtual-doc/nested-coll/not-cg-doc`,
            `x${collectionGroup}/not-cg-doc`,
            `${collectionGroup}x/not-cg-doc`,
            `abc/123/${collectionGroup}x/not-cg-doc`,
            `abc/123/x${collectionGroup}/not-cg-doc`,
            `abc/${collectionGroup}`,
        ];
        const batch = firestore.batch();
        for (const docPath of docPaths) {
            batch.set(firestore.doc(docPath), { x: 1 });
        }
        await batch.commit();
        const querySnapshot = await firestore
            .collectionGroup(collectionGroup)
            .get();
        (0, chai_1.expect)(querySnapshot.docs.map(d => d.id)).to.deep.equal([
            'cg-doc1',
            'cg-doc2',
            'cg-doc3',
            'cg-doc4',
            'cg-doc5',
        ]);
    });
    (0, mocha_1.it)('can query collection groups with startAt / endAt by arbitrary documentId', async () => {
        // Use `randomCol` to get a random collection group name to use but
        // ensure it starts with 'b' for predictable ordering.
        const collectionGroup = 'b' + randomCol.id;
        const docPaths = [
            `a/a/${collectionGroup}/cg-doc1`,
            `a/b/a/b/${collectionGroup}/cg-doc2`,
            `a/b/${collectionGroup}/cg-doc3`,
            `a/b/c/d/${collectionGroup}/cg-doc4`,
            `a/c/${collectionGroup}/cg-doc5`,
            `${collectionGroup}/cg-doc6`,
            'a/b/nope/nope',
        ];
        const batch = firestore.batch();
        for (const docPath of docPaths) {
            batch.set(firestore.doc(docPath), { x: 1 });
        }
        await batch.commit();
        let querySnapshot = await firestore
            .collectionGroup(collectionGroup)
            .orderBy(src_1.FieldPath.documentId())
            .startAt('a/b')
            .endAt('a/b0')
            .get();
        (0, chai_1.expect)(querySnapshot.docs.map(d => d.id)).to.deep.equal([
            'cg-doc2',
            'cg-doc3',
            'cg-doc4',
        ]);
        querySnapshot = await firestore
            .collectionGroup(collectionGroup)
            .orderBy(src_1.FieldPath.documentId())
            .startAfter('a/b')
            .endBefore(`a/b/${collectionGroup}/cg-doc3`)
            .get();
        (0, chai_1.expect)(querySnapshot.docs.map(d => d.id)).to.deep.equal(['cg-doc2']);
    });
    (0, mocha_1.it)('can query collection groups with where filters on arbitrary documentId', async () => {
        // Use `randomCol` to get a random collection group name to use but
        // ensure it starts with 'b' for predictable ordering.
        const collectionGroup = 'b' + randomCol.id;
        const docPaths = [
            `a/a/${collectionGroup}/cg-doc1`,
            `a/b/a/b/${collectionGroup}/cg-doc2`,
            `a/b/${collectionGroup}/cg-doc3`,
            `a/b/c/d/${collectionGroup}/cg-doc4`,
            `a/c/${collectionGroup}/cg-doc5`,
            `${collectionGroup}/cg-doc6`,
            'a/b/nope/nope',
        ];
        const batch = firestore.batch();
        for (const docPath of docPaths) {
            batch.set(firestore.doc(docPath), { x: 1 });
        }
        await batch.commit();
        let querySnapshot = await firestore
            .collectionGroup(collectionGroup)
            .where(src_1.FieldPath.documentId(), '>=', 'a/b')
            .where(src_1.FieldPath.documentId(), '<=', 'a/b0')
            .get();
        (0, chai_1.expect)(querySnapshot.docs.map(d => d.id)).to.deep.equal([
            'cg-doc2',
            'cg-doc3',
            'cg-doc4',
        ]);
        querySnapshot = await firestore
            .collectionGroup(collectionGroup)
            .where(src_1.FieldPath.documentId(), '>', 'a/b')
            .where(src_1.FieldPath.documentId(), '<', `a/b/${collectionGroup}/cg-doc3`)
            .get();
        (0, chai_1.expect)(querySnapshot.docs.map(d => d.id)).to.deep.equal(['cg-doc2']);
    });
    (0, mocha_1.it)('can query large collections', async () => {
        // @grpc/grpc-js v0.4.1 failed to deliver the full set of query results for
        // larger collections (https://github.com/grpc/grpc-node/issues/895);
        const batch = firestore.batch();
        for (let i = 0; i < 100; ++i) {
            batch.create(randomCol.doc(), {});
        }
        await batch.commit();
        const snapshot = await randomCol.get();
        (0, chai_1.expect)(snapshot.size).to.equal(100);
    });
    (0, mocha_1.it)('supports OR queries', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { a: 2, b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1, b: 1 },
        });
        // Two equalities: a==1 || b==1.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '==', 1)))
            .get(), 'doc1', 'doc2', 'doc4', 'doc5');
        // (a==1 && b==0) || (a==3 && b==2)
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '==', 0)), filter_1.Filter.and(filter_1.Filter.where('a', '==', 3), filter_1.Filter.where('b', '==', 2))))
            .get(), 'doc1', 'doc3');
        // a==1 && (b==0 || b==3).
        expectDocs(await collection
            .where(filter_1.Filter.and(filter_1.Filter.where('a', '==', 1), filter_1.Filter.or(filter_1.Filter.where('b', '==', 0), filter_1.Filter.where('b', '==', 3))))
            .get(), 'doc1', 'doc4');
        // (a==2 || b==2) && (a==3 || b==3)
        expectDocs(await collection
            .where(filter_1.Filter.and(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', '==', 2)), filter_1.Filter.or(filter_1.Filter.where('a', '==', 3), filter_1.Filter.where('b', '==', 3))))
            .get(), 'doc3');
        // Test with limits without orderBy (the __name__ ordering is the tie breaker).
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', '==', 1)))
            .limit(1)
            .get(), 'doc2');
    });
    // Skip this test if running against production because it results in a 'missing index' error.
    // The Firestore Emulator, however, does serve these queries.
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it.skip : mocha_1.it)('supports OR queries with composite indexes', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { a: 2, b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1, b: 1 },
        });
        // with one inequality: a>2 || b==1.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '>', 2), filter_1.Filter.where('b', '==', 1)))
            .get(), 'doc5', 'doc2', 'doc3');
        // Test with limits (implicit order by ASC): (a==1) || (b > 0) LIMIT 2
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '>', 0)))
            .limit(2)
            .get(), 'doc1', 'doc2');
        // Test with limits (explicit order by): (a==1) || (b > 0) LIMIT_TO_LAST 2
        // Note: The public query API does not allow implicit ordering when limitToLast is used.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '>', 0)))
            .limitToLast(2)
            .orderBy('b')
            .get(), 'doc3', 'doc4');
        // Test with limits (explicit order by ASC): (a==2) || (b == 1) ORDER BY a LIMIT 1
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', '==', 1)))
            .limit(1)
            .orderBy('a')
            .get(), 'doc5');
        // Test with limits (explicit order by DESC): (a==2) || (b == 1) ORDER BY a LIMIT 1
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', '==', 1)))
            .limit(1)
            .orderBy('a', 'desc')
            .get(), 'doc2');
    });
    (0, mocha_1.it)('supports OR queries on documents with missing fields', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1 },
            doc6: { a: 2 },
        });
        // Query: a==1 || b==1
        // There's no explicit nor implicit orderBy. Documents with missing 'a' or missing 'b' should be
        // allowed if the document matches at least one disjunction term.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '==', 1)))
            .get(), 'doc1', 'doc2', 'doc4', 'doc5');
    });
    // Skip this test if running against production because it results in a 'missing index' error.
    // The Firestore Emulator, however, does serve these queries.
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it.skip : mocha_1.it)('supports OR queries on documents with missing fields', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1 },
            doc6: { a: 2 },
        });
        // Query: a==1 || b==1 order by a.
        // doc2 should not be included because it's missing the field 'a', and we have "orderBy a".
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '==', 1)))
            .orderBy('a')
            .get(), 'doc1', 'doc4', 'doc5');
        // Query: a==1 || b==1 order by b.
        // doc5 should not be included because it's missing the field 'b', and we have "orderBy b".
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 1), filter_1.Filter.where('b', '==', 1)))
            .orderBy('b')
            .get(), 'doc1', 'doc2', 'doc4');
        // Query: a>2 || b==1.
        // This query has an implicit 'order by a'.
        // doc2 should not be included because it's missing the field 'a'.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '>', 2), filter_1.Filter.where('b', '==', 1)))
            .get(), 'doc3');
        // Query: a>1 || b==1 order by a order by b.
        // doc6 should not be included because it's missing the field 'b'.
        // doc2 should not be included because it's missing the field 'a'.
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '>', 1), filter_1.Filter.where('b', '==', 1)))
            .orderBy('a')
            .orderBy('b')
            .get(), 'doc3');
    });
    (0, mocha_1.it)('supports OR queries with in', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1 },
            doc6: { a: 2 },
        });
        // Query: a==2 || b in [2, 3]
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', 'in', [2, 3])))
            .get(), 'doc3', 'doc4', 'doc6');
    });
    // Skip this test if running against production because it results in a 'missing index' error.
    // The Firestore Emulator, however, does serve these queries.
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it.skip : mocha_1.it)('supports OR queries with not-in', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: 0 },
            doc2: { b: 1 },
            doc3: { a: 3, b: 2 },
            doc4: { a: 1, b: 3 },
            doc5: { a: 1 },
            doc6: { a: 2 },
        });
        // a==2 || (b != 2 && b != 3)
        // Has implicit "orderBy b"
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', 'not-in', [2, 3])))
            .get(), 'doc1', 'doc2');
    });
    (0, mocha_1.it)('supports OR queries with array membership', async () => {
        const collection = await testCollectionWithDocs({
            doc1: { a: 1, b: [0] },
            doc2: { b: [1] },
            doc3: { a: 3, b: [2, 7] },
            doc4: { a: 1, b: [3, 7] },
            doc5: { a: 1 },
            doc6: { a: 2 },
        });
        // Query: a==2 || b array-contains 7
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', 'array-contains', 7)))
            .get(), 'doc3', 'doc4', 'doc6');
        // a==2 || b array-contains-any [0, 3]
        // Has implicit "orderBy b"
        expectDocs(await collection
            .where(filter_1.Filter.or(filter_1.Filter.where('a', '==', 2), filter_1.Filter.where('b', 'array-contains-any', [0, 3])))
            .get(), 'doc1', 'doc4', 'doc6');
    });
    (0, mocha_1.describe)('watch', () => {
        const currentDeferred = new DeferredPromise();
        const snapshot = (id, data) => {
            const ref = randomCol.doc(id);
            const fields = ref.firestore._serializer.encodeFields(data);
            return randomCol.firestore.snapshot_({
                name: 'projects/ignored/databases/(default)/documents/' +
                    ref._path.relativeName,
                fields,
                createTime: { seconds: 0, nanos: 0 },
                updateTime: { seconds: 0, nanos: 0 },
            }, { seconds: 0, nanos: 0 });
        };
        const docChange = (type, id, data) => {
            return {
                type,
                doc: snapshot(id, data),
            };
        };
        const added = (id, data) => docChange('added', id, data);
        const modified = (id, data) => docChange('modified', id, data);
        const removed = (id, data) => docChange('removed', id, data);
        function resetPromise() {
            currentDeferred.promise = new Promise((resolve, reject) => {
                currentDeferred.resolve = resolve;
                currentDeferred.reject = reject;
            });
        }
        function waitForSnapshot() {
            return currentDeferred.promise.then(snapshot => {
                resetPromise();
                return snapshot;
            });
        }
        function snapshotsEqual(actual, expected) {
            let i;
            (0, chai_1.expect)(actual.size).to.equal(expected.docs.length);
            for (i = 0; i < expected.docs.length && i < actual.size; i++) {
                (0, chai_1.expect)(actual.docs[i].ref.id).to.equal(expected.docs[i].ref.id);
                (0, chai_1.expect)(actual.docs[i].data()).to.deep.equal(expected.docs[i].data());
            }
            const actualDocChanges = actual.docChanges();
            (0, chai_1.expect)(actualDocChanges.length).to.equal(expected.docChanges.length);
            for (i = 0; i < expected.docChanges.length; i++) {
                (0, chai_1.expect)(actualDocChanges[i].type).to.equal(expected.docChanges[i].type);
                (0, chai_1.expect)(actualDocChanges[i].doc.ref.id).to.equal(expected.docChanges[i].doc.ref.id);
                (0, chai_1.expect)(actualDocChanges[i].doc.data()).to.deep.equal(expected.docChanges[i].doc.data());
                (0, chai_1.expect)(actualDocChanges[i].doc.readTime).to.exist;
                (0, chai_1.expect)(actualDocChanges[i].doc.createTime).to.exist;
                (0, chai_1.expect)(actualDocChanges[i].doc.updateTime).to.exist;
            }
            (0, chai_1.expect)(actual.readTime).to.exist;
        }
        (0, mocha_1.beforeEach)(() => resetPromise());
        (0, mocha_1.it)('handles changing a doc', () => {
            const ref1 = randomCol.doc('doc1');
            const ref2 = randomCol.doc('doc2');
            const unsubscribe = randomCol.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            return waitForSnapshot()
                .then(results => {
                snapshotsEqual(results, { docs: [], docChanges: [] });
                // Add a result.
                return ref1.set({ foo: 'a' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { foo: 'a' })],
                    docChanges: [added('doc1', { foo: 'a' })],
                });
                // Add another result.
                return ref2.set({ foo: 'b' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { foo: 'a' }), snapshot('doc2', { foo: 'b' })],
                    docChanges: [added('doc2', { foo: 'b' })],
                });
                // Change a result.
                return ref2.set({ bar: 'c' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { foo: 'a' }), snapshot('doc2', { bar: 'c' })],
                    docChanges: [modified('doc2', { bar: 'c' })],
                });
                unsubscribe();
            });
        });
        (0, mocha_1.it)("handles changing a doc so it doesn't match", () => {
            const ref1 = randomCol.doc('doc1');
            const ref2 = randomCol.doc('doc2');
            const query = randomCol.where('included', '==', 'yes');
            const unsubscribe = query.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            return waitForSnapshot()
                .then(results => {
                snapshotsEqual(results, { docs: [], docChanges: [] });
                // Add a result.
                return ref1.set({ included: 'yes' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { included: 'yes' })],
                    docChanges: [added('doc1', { included: 'yes' })],
                });
                // Add another result.
                return ref2.set({ included: 'yes' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [
                        snapshot('doc1', { included: 'yes' }),
                        snapshot('doc2', { included: 'yes' }),
                    ],
                    docChanges: [added('doc2', { included: 'yes' })],
                });
                // Change a result.
                return ref2.set({ included: 'no' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { included: 'yes' })],
                    docChanges: [removed('doc2', { included: 'yes' })],
                });
                unsubscribe();
            });
        });
        (0, mocha_1.it)('handles deleting a doc', () => {
            const ref1 = randomCol.doc('doc1');
            const ref2 = randomCol.doc('doc2');
            const unsubscribe = randomCol.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            return waitForSnapshot()
                .then(results => {
                snapshotsEqual(results, { docs: [], docChanges: [] });
                // Add a result.
                return ref1.set({ included: 'yes' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { included: 'yes' })],
                    docChanges: [added('doc1', { included: 'yes' })],
                });
                // Add another result.
                return ref2.set({ included: 'yes' });
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [
                        snapshot('doc1', { included: 'yes' }),
                        snapshot('doc2', { included: 'yes' }),
                    ],
                    docChanges: [added('doc2', { included: 'yes' })],
                });
                // Delete a result.
                return ref2.delete();
            })
                .then(() => {
                return waitForSnapshot();
            })
                .then(results => {
                snapshotsEqual(results, {
                    docs: [snapshot('doc1', { included: 'yes' })],
                    docChanges: [removed('doc2', { included: 'yes' })],
                });
                unsubscribe();
            });
        });
        (0, mocha_1.it)('orders limitToLast() correctly', async () => {
            const ref1 = randomCol.doc('doc1');
            const ref2 = randomCol.doc('doc2');
            const ref3 = randomCol.doc('doc3');
            await ref1.set({ doc: 1 });
            await ref2.set({ doc: 2 });
            await ref3.set({ doc: 3 });
            const unsubscribe = randomCol
                .orderBy('doc')
                .limitToLast(2)
                .onSnapshot(snapshot => currentDeferred.resolve(snapshot));
            const results = await waitForSnapshot();
            snapshotsEqual(results, {
                docs: [snapshot('doc2', { doc: 2 }), snapshot('doc3', { doc: 3 })],
                docChanges: [added('doc2', { doc: 2 }), added('doc3', { doc: 3 })],
            });
            unsubscribe();
        });
        (0, mocha_1.it)('snapshot listener sorts query by DocumentId same way as server', async () => {
            const batch = firestore.batch();
            batch.set(randomCol.doc('A'), { a: 1 });
            batch.set(randomCol.doc('a'), { a: 1 });
            batch.set(randomCol.doc('Aa'), { a: 1 });
            batch.set(randomCol.doc('7'), { a: 1 });
            batch.set(randomCol.doc('12'), { a: 1 });
            batch.set(randomCol.doc('__id7__'), { a: 1 });
            batch.set(randomCol.doc('__id12__'), { a: 1 });
            batch.set(randomCol.doc('__id-2__'), { a: 1 });
            batch.set(randomCol.doc('__id1_'), { a: 1 });
            batch.set(randomCol.doc('_id1__'), { a: 1 });
            batch.set(randomCol.doc('__id'), { a: 1 });
            // largest long number
            batch.set(randomCol.doc('__id9223372036854775807__'), { a: 1 });
            batch.set(randomCol.doc('__id9223372036854775806__'), { a: 1 });
            // smallest long number
            batch.set(randomCol.doc('__id-9223372036854775808__'), { a: 1 });
            batch.set(randomCol.doc('__id-9223372036854775807__'), { a: 1 });
            await batch.commit();
            const query = randomCol.orderBy(src_1.FieldPath.documentId());
            const expectedDocs = [
                '__id-9223372036854775808__',
                '__id-9223372036854775807__',
                '__id-2__',
                '__id7__',
                '__id12__',
                '__id9223372036854775806__',
                '__id9223372036854775807__',
                '12',
                '7',
                'A',
                'Aa',
                '__id',
                '__id1_',
                '_id1__',
                'a',
            ];
            const getSnapshot = await query.get();
            (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
            const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
            const watchSnapshot = await waitForSnapshot();
            // Compare the snapshot (including sort order) of a snapshot
            snapshotsEqual(watchSnapshot, {
                docs: getSnapshot.docs,
                docChanges: getSnapshot.docChanges(),
            });
            unsubscribe();
        });
        (0, mocha_1.it)('snapshot listener sorts filtered query by DocumentId same way as server', async () => {
            const batch = firestore.batch();
            batch.set(randomCol.doc('A'), { a: 1 });
            batch.set(randomCol.doc('a'), { a: 1 });
            batch.set(randomCol.doc('Aa'), { a: 1 });
            batch.set(randomCol.doc('7'), { a: 1 });
            batch.set(randomCol.doc('12'), { a: 1 });
            batch.set(randomCol.doc('__id7__'), { a: 1 });
            batch.set(randomCol.doc('__id12__'), { a: 1 });
            batch.set(randomCol.doc('__id-2__'), { a: 1 });
            batch.set(randomCol.doc('__id1_'), { a: 1 });
            batch.set(randomCol.doc('_id1__'), { a: 1 });
            batch.set(randomCol.doc('__id'), { a: 1 });
            // largest long number
            batch.set(randomCol.doc('__id9223372036854775807__'), { a: 1 });
            batch.set(randomCol.doc('__id9223372036854775806__'), { a: 1 });
            // smallest long number
            batch.set(randomCol.doc('__id-9223372036854775808__'), { a: 1 });
            batch.set(randomCol.doc('__id-9223372036854775807__'), { a: 1 });
            await batch.commit();
            const query = randomCol
                .where(src_1.FieldPath.documentId(), '>', '__id7__')
                .where(src_1.FieldPath.documentId(), '<=', 'A')
                .orderBy(src_1.FieldPath.documentId());
            const expectedDocs = [
                '__id12__',
                '__id9223372036854775806__',
                '__id9223372036854775807__',
                '12',
                '7',
                'A',
            ];
            const getSnapshot = await query.get();
            (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
            const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
            const watchSnapshot = await waitForSnapshot();
            // Compare the snapshot (including sort order) of a snapshot
            snapshotsEqual(watchSnapshot, {
                docs: getSnapshot.docs,
                docChanges: getSnapshot.docChanges(),
            });
            unsubscribe();
        });
        (0, mocha_1.it)('SDK orders vector field same way as backend', async () => {
            // We validate that the SDK orders the vector field the same way as the backend
            // by comparing the sort order of vector fields from a Query.get() and
            // Query.onSnapshot(). Query.onSnapshot() will return sort order of the SDK,
            // and Query.get() will return sort order of the backend.
            // Test data in the order that we expect the backend to sort it.
            const docsInOrder = [
                { embedding: [1, 2, 3, 4, 5, 6] },
                { embedding: [100] },
                { embedding: src_1.FieldValue.vector([Number.NEGATIVE_INFINITY]) },
                { embedding: src_1.FieldValue.vector([-100]) },
                { embedding: src_1.FieldValue.vector([100]) },
                { embedding: src_1.FieldValue.vector([Number.POSITIVE_INFINITY]) },
                { embedding: src_1.FieldValue.vector([1, 2]) },
                { embedding: src_1.FieldValue.vector([2, 2]) },
                { embedding: src_1.FieldValue.vector([1, 2, 3]) },
                { embedding: src_1.FieldValue.vector([1, 2, 3, 4]) },
                { embedding: src_1.FieldValue.vector([1, 2, 3, 4, 5]) },
                { embedding: src_1.FieldValue.vector([1, 2, 100, 4, 4]) },
                { embedding: src_1.FieldValue.vector([100, 2, 3, 4, 5]) },
                { embedding: { HELLO: 'WORLD' } },
                { embedding: { hello: 'world' } },
            ];
            const expectedSnapshots = [];
            const expectedChanges = [];
            for (let i = 0; i < docsInOrder.length; i++) {
                const dr = await randomCol.add(docsInOrder[i]);
                expectedSnapshots.push(snapshot(dr.id, docsInOrder[i]));
                expectedChanges.push(added(dr.id, docsInOrder[i]));
            }
            const orderedQuery = randomCol.orderBy('embedding');
            const unsubscribe = orderedQuery.onSnapshot(snapshot => {
                currentDeferred.resolve(snapshot);
            }, err => {
                currentDeferred.reject(err);
            });
            const watchSnapshot = await waitForSnapshot();
            unsubscribe();
            const getSnapshot = await orderedQuery.get();
            // Compare the snapshot (including sort order) of a snapshot
            // from Query.onSnapshot() to an actual snapshot from Query.get()
            snapshotsEqual(watchSnapshot, {
                docs: getSnapshot.docs,
                docChanges: getSnapshot.docChanges(),
            });
            // Compare the snapshot (including sort order) of a snapshot
            // from Query.onSnapshot() to the expected sort order from
            // the backend.
            snapshotsEqual(watchSnapshot, {
                docs: expectedSnapshots,
                docChanges: expectedChanges,
            });
        });
        (0, mocha_1.describe)('sort unicode strings', () => {
            const expectedDocs = [
                'b',
                'a',
                'h',
                'i',
                'c',
                'f',
                'e',
                'd',
                'g',
                'k',
                'j',
            ];
            (0, mocha_1.it)('snapshot listener sorts unicode strings same as server', async () => {
                const collection = await testCollectionWithDocs({
                    a: { value: 'Łukasiewicz' },
                    b: { value: 'Sierpiński' },
                    c: { value: '岩澤' },
                    d: { value: '🄟' },
                    e: { value: 'Ｐ' },
                    f: { value: '︒' },
                    g: { value: '🐵' },
                    h: { value: '你好' },
                    i: { value: '你顥' },
                    j: { value: '😁' },
                    k: { value: '😀' },
                });
                const query = collection.orderBy('value');
                const getSnapshot = await query.get();
                (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
                const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
                const watchSnapshot = await waitForSnapshot();
                snapshotsEqual(watchSnapshot, {
                    docs: getSnapshot.docs,
                    docChanges: getSnapshot.docChanges(),
                });
                unsubscribe();
            });
            (0, mocha_1.it)('snapshot listener sorts unicode strings in array same as server', async () => {
                const collection = await testCollectionWithDocs({
                    a: { value: ['Łukasiewicz'] },
                    b: { value: ['Sierpiński'] },
                    c: { value: ['岩澤'] },
                    d: { value: ['🄟'] },
                    e: { value: ['Ｐ'] },
                    f: { value: ['︒'] },
                    g: { value: ['🐵'] },
                    h: { value: ['你好'] },
                    i: { value: ['你顥'] },
                    j: { value: ['😁'] },
                    k: { value: ['😀'] },
                });
                const query = collection.orderBy('value');
                const getSnapshot = await query.get();
                (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
                const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
                const watchSnapshot = await waitForSnapshot();
                snapshotsEqual(watchSnapshot, {
                    docs: getSnapshot.docs,
                    docChanges: getSnapshot.docChanges(),
                });
                unsubscribe();
            });
            (0, mocha_1.it)('snapshot listener sorts unicode strings in map same as server', async () => {
                const collection = await testCollectionWithDocs({
                    a: { value: { foo: 'Łukasiewicz' } },
                    b: { value: { foo: 'Sierpiński' } },
                    c: { value: { foo: '岩澤' } },
                    d: { value: { foo: '🄟' } },
                    e: { value: { foo: 'Ｐ' } },
                    f: { value: { foo: '︒' } },
                    g: { value: { foo: '🐵' } },
                    h: { value: { foo: '你好' } },
                    i: { value: { foo: '你顥' } },
                    j: { value: { foo: '😁' } },
                    k: { value: { foo: '😀' } },
                });
                const query = collection.orderBy('value');
                const getSnapshot = await query.get();
                (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
                const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
                const watchSnapshot = await waitForSnapshot();
                snapshotsEqual(watchSnapshot, {
                    docs: getSnapshot.docs,
                    docChanges: getSnapshot.docChanges(),
                });
                unsubscribe();
            });
            (0, mocha_1.it)('snapshot listener sorts unicode strings in map key same as server', async () => {
                const collection = await testCollectionWithDocs({
                    a: { value: { Łukasiewicz: true } },
                    b: { value: { Sierpiński: true } },
                    c: { value: { 岩澤: true } },
                    d: { value: { '🄟': true } },
                    e: { value: { Ｐ: true } },
                    f: { value: { '︒': true } },
                    g: { value: { '🐵': true } },
                    h: { value: { 你好: true } },
                    i: { value: { 你顥: true } },
                    j: { value: { '😁': true } },
                    k: { value: { '😀': true } },
                });
                const query = collection.orderBy('value');
                const getSnapshot = await query.get();
                (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
                const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
                const watchSnapshot = await waitForSnapshot();
                snapshotsEqual(watchSnapshot, {
                    docs: getSnapshot.docs,
                    docChanges: getSnapshot.docChanges(),
                });
                unsubscribe();
            });
            (0, mocha_1.it)('snapshot listener sorts unicode strings in document key same as server', async () => {
                const collection = await testCollectionWithDocs({
                    Łukasiewicz: { value: true },
                    Sierpiński: { value: true },
                    岩澤: { value: true },
                    '🄟': { value: true },
                    Ｐ: { value: true },
                    '︒': { value: true },
                    '🐵': { value: true },
                    你好: { value: true },
                    你顥: { value: true },
                    '😁': { value: true },
                    '😀': { value: true },
                });
                const query = collection.orderBy(src_1.FieldPath.documentId());
                const expectedDocs = [
                    'Sierpiński',
                    'Łukasiewicz',
                    '你好',
                    '你顥',
                    '岩澤',
                    '︒',
                    'Ｐ',
                    '🄟',
                    '🐵',
                    '😀',
                    '😁',
                ];
                const getSnapshot = await query.get();
                (0, chai_1.expect)(getSnapshot.docs.map(d => d.id)).to.deep.equal(expectedDocs);
                const unsubscribe = query.onSnapshot(snapshot => currentDeferred.resolve(snapshot));
                const watchSnapshot = await waitForSnapshot();
                snapshotsEqual(watchSnapshot, {
                    docs: getSnapshot.docs,
                    docChanges: getSnapshot.docChanges(),
                });
                unsubscribe();
            });
        });
    });
    (process.env.FIRESTORE_EMULATOR_HOST === undefined
        ? mocha_1.describe.skip
        : mocha_1.describe)('multiple inequality', () => {
        (0, mocha_1.it)('supports multiple inequality queries', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 0, v: 0 },
                doc2: { key: 'b', sort: 3, v: 1 },
                doc3: { key: 'c', sort: 1, v: 3 },
                doc4: { key: 'd', sort: 2, v: 2 },
            });
            // Multiple inequality fields
            let results = await collection
                .where('key', '!=', 'a')
                .where('sort', '<=', 2)
                .where('v', '>', 2)
                .get();
            expectDocs(results, 'doc3');
            // Duplicate inequality fields
            results = await collection
                .where('key', '!=', 'a')
                .where('sort', '<=', 2)
                .where('sort', '>', 1)
                .get();
            expectDocs(results, 'doc4');
            // With multiple IN
            results = await collection
                .where('key', '>=', 'a')
                .where('sort', '<=', 2)
                .where('v', 'in', [2, 3, 4])
                .where('sort', 'in', [2, 3])
                .get();
            expectDocs(results, 'doc4');
            // With NOT-IN
            results = await collection
                .where('key', '>=', 'a')
                .where('sort', '<=', 2)
                .where('v', 'not-in', [2, 4, 5])
                .get();
            expectDocs(results, 'doc1', 'doc3');
            // With orderby
            results = await collection
                .where('key', '>=', 'a')
                .where('sort', '<=', 2)
                .orderBy('v', 'desc')
                .get();
            expectDocs(results, 'doc3', 'doc4', 'doc1');
            // With limit
            results = await collection
                .where('key', '>=', 'a')
                .where('sort', '<=', 2)
                .orderBy('v', 'desc')
                .limit(2)
                .get();
            expectDocs(results, 'doc3', 'doc4');
            // With limitToLast
            results = await collection
                .where('key', '>=', 'a')
                .where('sort', '<=', 2)
                .orderBy('v', 'desc')
                .limitToLast(2)
                .get();
            expectDocs(results, 'doc4', 'doc1');
        });
        (0, mocha_1.it)('can use on special values', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 0, v: 0 },
                doc2: { key: 'b', sort: NaN, v: 1 },
                doc3: { key: 'c', sort: null, v: 3 },
                doc4: { key: 'd', v: 0 },
                doc5: { key: 'e', sort: 1 },
                doc6: { key: 'f', sort: 1, v: 1 },
            });
            let results = await collection
                .where('key', '!=', 'a')
                .where('sort', '<=', 2)
                .get();
            expectDocs(results, 'doc5', 'doc6');
            results = await collection
                .where('key', '!=', 'a')
                .where('sort', '<=', 2)
                .where('v', '<=', 1)
                .get();
            expectDocs(results, 'doc6');
        });
        (0, mocha_1.it)('can use with array membership', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 0, v: [0] },
                doc2: { key: 'b', sort: 1, v: [0, 1, 3] },
                doc3: { key: 'c', sort: 1, v: [] },
                doc4: { key: 'd', sort: 2, v: [1] },
                doc5: { key: 'e', sort: 3, v: [2, 4] },
                doc6: { key: 'f', sort: 4, v: [NaN] },
                doc7: { key: 'g', sort: 4, v: [null] },
            });
            let results = await collection
                .where('key', '!=', 'a')
                .where('sort', '>=', 1)
                .where('v', 'array-contains', 0)
                .get();
            expectDocs(results, 'doc2');
            results = await collection
                .where('key', '!=', 'a')
                .where('sort', '>=', 1)
                .where('v', 'array-contains-any', [0, 1])
                .get();
            expectDocs(results, 'doc2', 'doc4');
        });
        // Use cursor in following test cases to add implicit order by fields in the sdk and compare the
        // result with the query fields normalized in the server.
        (0, mocha_1.it)('can use with nested field', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const testData = (n) => {
                n = n || 1;
                return {
                    name: 'room ' + n,
                    metadata: {
                        createdAt: n,
                    },
                    field: 'field ' + n,
                    'field.dot': n,
                    'field\\slash': n,
                };
            };
            const collection = await testCollectionWithDocs({
                doc1: testData(400),
                doc2: testData(200),
                doc3: testData(100),
                doc4: testData(300),
            });
            // ordered by: name asc, metadata.createdAt asc, __name__  asc
            let query = collection
                .where('metadata.createdAt', '<=', 500)
                .where('metadata.createdAt', '>', 100)
                .where('name', '!=', 'room 200')
                .orderBy('name');
            let docSnap = await collection.doc('doc4').get();
            let queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc4', 'doc1');
            expectDocs(await queryWithCursor.get(), 'doc4', 'doc1');
            // ordered by: name desc, field desc, field.dot desc, field\\slash desc, __name__ desc
            query = collection
                .where('field', '>=', 'field 100')
                .where(new src_1.FieldPath('field.dot'), '!=', 300)
                .where('field\\slash', '<', 400)
                .orderBy('name', 'desc');
            docSnap = await collection.doc('doc2').get();
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc3');
        });
        (0, mocha_1.it)('can use with nested composite filters', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 0, v: 5 },
                doc2: { key: 'aa', sort: 4, v: 4 },
                doc3: { key: 'c', sort: 3, v: 3 },
                doc4: { key: 'b', sort: 2, v: 2 },
                doc5: { key: 'b', sort: 2, v: 1 },
                doc6: { key: 'b', sort: 0, v: 0 },
            });
            // Implicitly ordered by: 'key' asc, 'sort' asc, 'v' asc, __name__ asc
            let query = collection.where(filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('key', '==', 'b'), filter_1.Filter.where('sort', '<=', 2)), filter_1.Filter.and(filter_1.Filter.where('key', '!=', 'b'), filter_1.Filter.where('v', '>', 4))));
            let docSnap = await collection.doc('doc1').get();
            let queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc1', 'doc6', 'doc5', 'doc4');
            expectDocs(await queryWithCursor.get(), 'doc1', 'doc6', 'doc5', 'doc4');
            // Ordered by: 'sort' desc, 'key' asc, 'v' asc, __name__ asc
            query = collection
                .where(filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('key', '==', 'b'), filter_1.Filter.where('sort', '<=', 2)), filter_1.Filter.and(filter_1.Filter.where('key', '!=', 'b'), filter_1.Filter.where('v', '>', 4))))
                .orderBy('sort', 'desc')
                .orderBy('key');
            docSnap = await collection.doc('doc5').get();
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc5', 'doc4', 'doc1', 'doc6');
            expectDocs(await queryWithCursor.get(), 'doc5', 'doc4', 'doc1', 'doc6');
            // Implicitly ordered by: 'key' asc, 'sort' asc, 'v' asc, __name__ asc
            query = collection.where(filter_1.Filter.and(filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('key', '==', 'b'), filter_1.Filter.where('sort', '<=', 4)), filter_1.Filter.and(filter_1.Filter.where('key', '!=', 'b'), filter_1.Filter.where('v', '>=', 4))), filter_1.Filter.or(filter_1.Filter.and(filter_1.Filter.where('key', '>', 'b'), filter_1.Filter.where('sort', '>=', 1)), filter_1.Filter.and(filter_1.Filter.where('key', '<', 'b'), filter_1.Filter.where('v', '>', 0)))));
            docSnap = await collection.doc('doc1').get();
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc1', 'doc2');
            expectDocs(await queryWithCursor.get(), 'doc1', 'doc2');
        });
        (0, mocha_1.it)('inequality fields will be implicitly ordered lexicographically by the server', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 0, v: 5 },
                doc2: { key: 'aa', sort: 4, v: 4 },
                doc3: { key: 'b', sort: 3, v: 3 },
                doc4: { key: 'b', sort: 2, v: 2 },
                doc5: { key: 'b', sort: 2, v: 1 },
                doc6: { key: 'b', sort: 0, v: 0 },
            });
            const docSnap = await collection.doc('doc2').get();
            // Implicitly ordered by: 'key' asc, 'sort' asc, __name__ asc
            let query = collection
                .where('key', '!=', 'a')
                .where('sort', '>', 1)
                .where('v', 'in', [1, 2, 3, 4]);
            let queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc4', 'doc5', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc4', 'doc5', 'doc3');
            // Changing filters order will not effect implicit order.
            // Implicitly ordered by: 'key' asc, 'sort' asc, __name__ asc
            query = collection
                .where('sort', '>', 1)
                .where('key', '!=', 'a')
                .where('v', 'in', [1, 2, 3, 4]);
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc4', 'doc5', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc4', 'doc5', 'doc3');
        });
        (0, mocha_1.it)('can use multiple explicit order by field', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 5, v: 0 },
                doc2: { key: 'aa', sort: 4, v: 0 },
                doc3: { key: 'b', sort: 3, v: 1 },
                doc4: { key: 'b', sort: 2, v: 1 },
                doc5: { key: 'bb', sort: 1, v: 1 },
                doc6: { key: 'c', sort: 0, v: 2 },
            });
            let docSnap = await collection.doc('doc2').get();
            // Ordered by: 'v' asc, 'key' asc, 'sort' asc, __name__ asc
            let query = collection
                .where('key', '>', 'a')
                .where('sort', '>=', 1)
                .orderBy('v');
            let queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc4', 'doc3', 'doc5');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc4', 'doc3', 'doc5');
            // Ordered by: 'v asc, 'sort' asc, 'key' asc,  __name__ asc
            query = collection
                .where('key', '>', 'a')
                .where('sort', '>=', 1)
                .orderBy('v')
                .orderBy('sort');
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc5', 'doc4', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc5', 'doc4', 'doc3');
            docSnap = await collection.doc('doc5').get();
            // Implicit order by matches the direction of last explicit order by.
            // Ordered by: 'v' desc, 'key' desc, 'sort' desc, __name__ desc
            query = collection
                .where('key', '>', 'a')
                .where('sort', '>=', 1)
                .orderBy('v', 'desc');
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc5', 'doc3', 'doc4', 'doc2');
            expectDocs(await queryWithCursor.get(), 'doc5', 'doc3', 'doc4', 'doc2');
            // Ordered by: 'v desc, 'sort' asc, 'key' asc,  __name__ asc
            query = collection
                .where('key', '>', 'a')
                .where('sort', '>=', 1)
                .orderBy('v', 'desc')
                .orderBy('sort');
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc5', 'doc4', 'doc3', 'doc2');
            expectDocs(await queryWithCursor.get(), 'doc5', 'doc4', 'doc3', 'doc2');
        });
        (0, mocha_1.it)('can use in aggregate query', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 5, v: 0 },
                doc2: { key: 'aa', sort: 4, v: 0 },
                doc3: { key: 'b', sort: 3, v: 1 },
                doc4: { key: 'b', sort: 2, v: 1 },
                doc5: { key: 'bb', sort: 1, v: 1 },
            });
            const results = await collection
                .where('key', '>', 'a')
                .where('sort', '>=', 1)
                .orderBy('v')
                .count()
                .get();
            (0, chai_1.expect)(results.data().count).to.be.equal(4);
            //TODO(MIEQ): Add sum and average when they are public.
        });
        (0, mocha_1.it)('can use document ID im multiple inequality query', async () => {
            const collection = await testCollectionWithDocs({
                doc1: { key: 'a', sort: 5 },
                doc2: { key: 'aa', sort: 4 },
                doc3: { key: 'b', sort: 3 },
                doc4: { key: 'b', sort: 2 },
                doc5: { key: 'bb', sort: 1 },
            });
            const docSnap = await collection.doc('doc2').get();
            // Document Key in inequality field will implicitly ordered to the last.
            // Implicitly ordered by: 'key' asc, 'sort' asc, __name__ asc
            let query = collection
                .where('sort', '>=', 1)
                .where('key', '!=', 'a')
                .where(src_1.FieldPath.documentId(), '<', 'doc5');
            let queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc4', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc4', 'doc3');
            // Changing filters order will not effect implicit order.
            // Implicitly ordered by: 'key' asc, 'sort' asc, __name__ asc
            query = collection
                .where(src_1.FieldPath.documentId(), '<', 'doc5')
                .where('sort', '>=', 1)
                .where('key', '!=', 'a');
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc4', 'doc3');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc4', 'doc3');
            // Ordered by: 'sort' desc,'key' desc,  __name__ desc
            query = collection
                .where(src_1.FieldPath.documentId(), '<', 'doc5')
                .where('sort', '>=', 1)
                .where('key', '!=', 'a')
                .orderBy('sort', 'desc');
            queryWithCursor = query.startAt(docSnap);
            expectDocs(await query.get(), 'doc2', 'doc3', 'doc4');
            expectDocs(await queryWithCursor.get(), 'doc2', 'doc3', 'doc4');
        });
    });
});
(0, mocha_1.describe)('count queries', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.describe)('Run outside Transaction', () => {
        countTests(async (q, n) => {
            const res = await q.get();
            (0, chai_1.expect)(res.data().count).to.equal(n);
        });
    });
    (0, mocha_1.describe)('Run within Transaction', () => {
        countTests(async (q, n) => {
            const res = await firestore.runTransaction(f => f.get(q));
            (0, chai_1.expect)(res.data().count).to.equal(n);
        });
    });
    function countTests(runQueryAndExpectCount) {
        (0, mocha_1.it)('counts 0 document from non-existent collection', async () => {
            const count = randomCol.count();
            await runQueryAndExpectCount(count, 0);
        });
        (0, mocha_1.it)('counts 0 document from filtered empty collection', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol.where('foo', '==', 'notbar').count();
            await runQueryAndExpectCount(count, 0);
        });
        (0, mocha_1.it)('counts 1 document', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol.count();
            await runQueryAndExpectCount(count, 1);
        });
        (0, mocha_1.it)('counts 1 document', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol.count();
            await runQueryAndExpectCount(count, 1);
        });
        (0, mocha_1.it)('counts 1 document', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol.count();
            await runQueryAndExpectCount(count, 1);
        });
        (0, mocha_1.it)('counts multiple documents with filter', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'notbar' });
            await randomCol.doc('doc3').set({ notfoo: 'bar' });
            const count = randomCol.where('foo', '==', 'bar').count();
            await runQueryAndExpectCount(count, 2);
        });
        (0, mocha_1.it)('counts up to limit', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'bar' });
            await randomCol.doc('doc4').set({ foo: 'bar' });
            await randomCol.doc('doc5').set({ foo: 'bar' });
            await randomCol.doc('doc6').set({ foo: 'bar' });
            await randomCol.doc('doc7').set({ foo: 'bar' });
            await randomCol.doc('doc8').set({ foo: 'bar' });
            const count = randomCol.limit(5).count();
            await runQueryAndExpectCount(count, 5);
        });
        (0, mocha_1.it)('counts with orderBy', async () => {
            await randomCol.doc('doc1').set({ foo1: 'bar1' });
            await randomCol.doc('doc2').set({ foo1: 'bar2' });
            await randomCol.doc('doc3').set({ foo1: 'bar3' });
            await randomCol.doc('doc4').set({ foo1: 'bar4' });
            await randomCol.doc('doc5').set({ foo1: 'bar5' });
            await randomCol.doc('doc6').set({ foo2: 'bar6' });
            await randomCol.doc('doc7').set({ foo2: 'bar7' });
            await randomCol.doc('doc8').set({ foo2: 'bar8' });
            const count1 = randomCol.orderBy('foo2').count();
            await runQueryAndExpectCount(count1, 3);
            const count2 = randomCol.orderBy('foo3').count();
            await runQueryAndExpectCount(count2, 0);
        });
        (0, mocha_1.it)('counts with startAt, endAt and offset', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'bar' });
            await randomCol.doc('doc4').set({ foo: 'bar' });
            await randomCol.doc('doc5').set({ foo: 'bar' });
            await randomCol.doc('doc6').set({ foo: 'bar' });
            await randomCol.doc('doc7').set({ foo: 'bar' });
            const docSnap = await randomCol.doc('doc3').get();
            const count1 = randomCol.startAfter(docSnap).count();
            await runQueryAndExpectCount(count1, 4);
            const count2 = randomCol.startAt(docSnap).count();
            await runQueryAndExpectCount(count2, 5);
            const count3 = randomCol.endAt(docSnap).count();
            await runQueryAndExpectCount(count3, 3);
            const count4 = randomCol.endBefore(docSnap).count();
            await runQueryAndExpectCount(count4, 2);
            const count5 = randomCol.offset(6).count();
            await runQueryAndExpectCount(count5, 1);
        });
    }
    // Only verify the error message for missing indexes when running against
    // production, since the Firestore Emulator does not require index creation
    // and will, therefore, never fail in this situation.
    // eslint-disable-next-line no-restricted-properties
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it : mocha_1.it.skip)('count query error message contains console link if missing index', () => {
        var _a;
        const query = randomCol.where('key1', '==', 42).where('key2', '<', 42);
        const countQuery = query.count();
        const databaseId = (_a = query.firestore._settings.databaseId) !== null && _a !== void 0 ? _a : '(default)';
        // TODO(b/316359394) Remove this check for the default databases once
        //  cl/582465034 is rolled out to production.
        if (databaseId === '(default)') {
            return (0, chai_1.expect)(countQuery.get()).to.be.eventually.rejectedWith(/index.*https:\/\/console\.firebase\.google\.com/);
        }
        else {
            return (0, chai_1.expect)(countQuery.get()).to.be.eventually.rejectedWith(/index/);
        }
    });
});
(0, mocha_1.describe)('count queries using aggregate api', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.describe)('Run outside Transaction', () => {
        countTests(async (q, n) => {
            const res = await q.get();
            (0, chai_1.expect)(res.data().count).to.equal(n);
        });
    });
    (0, mocha_1.describe)('Run within Transaction', () => {
        countTests(async (q, n) => {
            const res = await firestore.runTransaction(f => f.get(q));
            (0, chai_1.expect)(res.data().count).to.equal(n);
        });
    });
    function countTests(runQueryAndExpectCount) {
        (0, mocha_1.it)('counts 0 document from non-existent collection', async () => {
            const count = randomCol.aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count, 0);
        });
        (0, mocha_1.it)('counts 0 document from filtered empty collection', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol
                .where('foo', '==', 'notbar')
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count, 0);
        });
        (0, mocha_1.it)('counts 1 document', async () => {
            await randomCol.doc('doc').set({ foo: 'bar' });
            const count = randomCol.aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count, 1);
        });
        (0, mocha_1.it)('counts multiple documents with filter', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'notbar' });
            await randomCol.doc('doc3').set({ notfoo: 'bar' });
            const count = randomCol
                .where('foo', '==', 'bar')
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count, 2);
        });
        (0, mocha_1.it)('counts up to limit', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'bar' });
            await randomCol.doc('doc4').set({ foo: 'bar' });
            await randomCol.doc('doc5').set({ foo: 'bar' });
            await randomCol.doc('doc6').set({ foo: 'bar' });
            await randomCol.doc('doc7').set({ foo: 'bar' });
            await randomCol.doc('doc8').set({ foo: 'bar' });
            const count = randomCol
                .limit(5)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count, 5);
        });
        (0, mocha_1.it)('counts with orderBy', async () => {
            await randomCol.doc('doc1').set({ foo1: 'bar1' });
            await randomCol.doc('doc2').set({ foo1: 'bar2' });
            await randomCol.doc('doc3').set({ foo1: 'bar3' });
            await randomCol.doc('doc4').set({ foo1: 'bar4' });
            await randomCol.doc('doc5').set({ foo1: 'bar5' });
            await randomCol.doc('doc6').set({ foo2: 'bar6' });
            await randomCol.doc('doc7').set({ foo2: 'bar7' });
            await randomCol.doc('doc8').set({ foo2: 'bar8' });
            const count1 = randomCol
                .orderBy('foo2')
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count1, 3);
            const count2 = randomCol
                .orderBy('foo3')
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count2, 0);
        });
        (0, mocha_1.it)('counts with startAt, endAt and offset with DocumentReference cursor', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'bar' });
            await randomCol.doc('doc4').set({ foo: 'bar' });
            await randomCol.doc('doc5').set({ foo: 'bar' });
            await randomCol.doc('doc6').set({ foo: 'bar' });
            await randomCol.doc('doc7').set({ foo: 'bar' });
            const count1 = randomCol
                .orderBy(src_1.FieldPath.documentId())
                .startAfter(randomCol.doc('doc3'))
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count1, 4);
            const count2 = randomCol
                .orderBy(src_1.FieldPath.documentId())
                .startAt(randomCol.doc('doc3'))
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count2, 5);
            const count3 = randomCol
                .orderBy(src_1.FieldPath.documentId())
                .endAt(randomCol.doc('doc3'))
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count3, 3);
            const count4 = randomCol
                .orderBy(src_1.FieldPath.documentId())
                .endBefore(randomCol.doc('doc3'))
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count4, 2);
            const count5 = randomCol
                .offset(6)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count5, 1);
        });
        (0, mocha_1.it)('counts with startAt, endAt and offset with DocumentSnapshot cursor', async () => {
            await randomCol.doc('doc1').set({ foo: 'bar' });
            await randomCol.doc('doc2').set({ foo: 'bar' });
            await randomCol.doc('doc3').set({ foo: 'bar' });
            await randomCol.doc('doc4').set({ foo: 'bar' });
            await randomCol.doc('doc5').set({ foo: 'bar' });
            await randomCol.doc('doc6').set({ foo: 'bar' });
            await randomCol.doc('doc7').set({ foo: 'bar' });
            const docSnap = await randomCol.doc('doc3').get();
            const count1 = randomCol
                .startAfter(docSnap)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count1, 4);
            const count2 = randomCol
                .startAt(docSnap)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count2, 5);
            const count3 = randomCol
                .endAt(docSnap)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count3, 3);
            const count4 = randomCol
                .endBefore(docSnap)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count4, 2);
            const count5 = randomCol
                .offset(6)
                .aggregate({ count: src_1.AggregateField.count() });
            await runQueryAndExpectCount(count5, 1);
        });
    }
});
(0, mocha_1.describe)('Aggregation queries', () => {
    let firestore;
    let col;
    (0, mocha_1.beforeEach)(() => {
        col = getTestRoot();
        firestore = col.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    async function addTestDocs(docs) {
        const sets = [];
        Object.keys(docs).forEach(key => {
            sets.push(col.doc(key).set(docs[key]));
        });
        return Promise.all(sets);
    }
    (0, mocha_1.it)('can run count within a transaction with readtime', async () => {
        const doc = col.doc();
        const writeResult = await doc.create({ some: 'data' });
        const count = await firestore.runTransaction(t => t.get(col.count()), {
            readOnly: true,
            readTime: writeResult.writeTime,
        });
        (0, chai_1.expect)(count.data().count).to.equal(1);
        const countBefore = await firestore.runTransaction(t => t.get(col.count()), {
            readOnly: true,
            readTime: src_1.Timestamp.fromMillis(writeResult.writeTime.toMillis() - 1),
        });
        (0, chai_1.expect)(countBefore.data().count).to.equal(0);
    });
    (0, mocha_1.it)('can run count query using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            count: src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data().count).to.equal(2);
    });
    (0, mocha_1.it)('can alias aggregations using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            foo: src_1.AggregateField.count(),
            'with.dots': src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data().foo).to.equal(2);
        (0, chai_1.expect)(snapshot.data()['with.dots']).to.equal(2);
    });
    (0, mocha_1.it)('allows special chars in aliases when using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            'with-un/su+pp[or]ted': src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data()['with-un/su+pp[or]ted']).to.equal(2);
    });
    (0, mocha_1.it)('allows backticks in aliases when using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            '`with-un/su+pp[or]ted`': src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data()['`with-un/su+pp[or]ted`']).to.equal(2);
    });
    (0, mocha_1.it)('allows backslash in aliases when using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            'with\\backshash\\es': src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data()['with\\backshash\\es']).to.equal(2);
    });
    (0, mocha_1.it)('can get duplicate aggregations using aggregate api', async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        await addTestDocs(testDocs);
        const snapshot = await col
            .aggregate({
            count: src_1.AggregateField.count(),
            foo: src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data().foo).to.equal(2);
        (0, chai_1.expect)(snapshot.data().count).to.equal(2);
    });
    (0, mocha_1.it)("aggregate() doesn't use converter", async () => {
        const testDocs = {
            a: { author: 'authorA', title: 'titleA' },
            b: { author: 'authorB', title: 'titleB' },
        };
        const throwingConverter = {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            toFirestore(obj) {
                throw new Error('should never be called');
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            fromFirestore(snapshot) {
                throw new Error('should never be called');
            },
        };
        await addTestDocs(testDocs);
        const query = col
            .where('author', '==', 'authorA')
            .withConverter(throwingConverter);
        const snapshot = await query
            .aggregate({
            count: src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data().count).to.equal(1);
    });
    (0, mocha_1.it)('aggregate query supports collection groups', async () => {
        const collectionGroupId = (0, util_1.autoId)();
        const docPaths = [
            `${collectionGroupId}/cg-doc1`,
            `abc/123/${collectionGroupId}/cg-doc2`,
            `zzz${collectionGroupId}/cg-doc3`,
            `abc/123/zzz${collectionGroupId}/cg-doc4`,
            `abc/123/zzz/${collectionGroupId}`,
        ];
        const batch = firestore.batch();
        for (const docPath of docPaths) {
            batch.set(firestore.doc(docPath), { x: 1 });
        }
        await batch.commit();
        const snapshot = await firestore
            .collectionGroup(collectionGroupId)
            .aggregate({
            count: src_1.AggregateField.count(),
        })
            .get();
        (0, chai_1.expect)(snapshot.data().count).to.equal(2);
    });
    (0, mocha_1.it)('aggregate() fails if firestore is terminated', async () => {
        await firestore.terminate();
        await (0, chai_1.expect)(col.aggregate({ count: src_1.AggregateField.count() }).get()).to.eventually.be.rejectedWith('The client has already been terminated');
    });
    (0, mocha_1.it)("terminate doesn't crash when there is aggregate query in flight", async () => {
        col.aggregate({ count: src_1.AggregateField.count() }).get();
        await firestore.terminate();
    });
    // Only verify the error message for missing indexes when running against
    // production, since the Firestore Emulator does not require index creation
    // and will, therefore, never fail in this situation.
    // eslint-disable-next-line no-restricted-properties
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it : mocha_1.it.skip)('aggregate query error message contains console link if missing index', () => {
        var _a;
        const query = col.where('key1', '==', 42).where('key2', '<', 42);
        const aggregateQuery = query.aggregate({
            count: src_1.AggregateField.count(),
            sum: src_1.AggregateField.sum('pages'),
            average: src_1.AggregateField.average('pages'),
        });
        const databaseId = (_a = query.firestore._settings.databaseId) !== null && _a !== void 0 ? _a : '(default)';
        // TODO(b/316359394) Remove this check for the default databases once
        //  cl/582465034 is rolled out to production.
        if (databaseId === '(default)') {
            return (0, chai_1.expect)(aggregateQuery.get()).to.be.eventually.rejectedWith(/index.*https:\/\/console\.firebase\.google\.com/);
        }
        else {
            return (0, chai_1.expect)(aggregateQuery.get()).to.be.eventually.rejectedWith(/index/);
        }
    });
    (0, mocha_1.describe)('Aggregation queries - sum / average using aggregate() api', () => {
        (0, mocha_1.it)('can run sum query', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({ totalPages: src_1.AggregateField.sum('pages') })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(150);
        });
        (0, mocha_1.it)('can run average query', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({ averagePages: src_1.AggregateField.average('pages') })
                .get();
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(75);
        });
        (0, mocha_1.it)('can get multiple aggregations', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                count: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(75);
            (0, chai_1.expect)(snapshot.data().count).to.equal(2);
        });
        (0, mocha_1.it)('can get duplicate aggregations', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                totalPagesX: src_1.AggregateField.sum('pages'),
                averagePagesY: src_1.AggregateField.average('pages'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(75);
            (0, chai_1.expect)(snapshot.data().totalPagesX).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePagesY).to.equal(75);
        });
        (0, mocha_1.it)('can perform max (5) aggregations', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                count: src_1.AggregateField.count(),
                totalPagesX: src_1.AggregateField.sum('pages'),
                averagePagesY: src_1.AggregateField.average('pages'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(75);
            (0, chai_1.expect)(snapshot.data().count).to.equal(2);
            (0, chai_1.expect)(snapshot.data().totalPagesX).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePagesY).to.equal(75);
        });
        (0, mocha_1.it)('fails when exceeding the max (5) aggregations', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100 },
                b: { author: 'authorB', title: 'titleB', pages: 50 },
            };
            await addTestDocs(testDocs);
            const aggregateQuery = await col.aggregate({
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                count: src_1.AggregateField.count(),
                totalPagesX: src_1.AggregateField.sum('pages'),
                averagePagesY: src_1.AggregateField.average('pages'),
                countZ: src_1.AggregateField.count(),
            });
            await (0, chai_1.expect)(aggregateQuery.get()).to.eventually.be.rejectedWith(/maximum number of aggregations/);
        });
        (0, mocha_1.it)('returns undefined when getting the result of an unrequested aggregation', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: 3,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            // @ts-expect-error expected error as 'totalPages' is not in the AggregateSpec.
            const totalPages = snapshot.data().totalPages;
            (0, chai_1.expect)(totalPages).to.equal(undefined);
        });
        (0, mocha_1.it)('performs sum that results in float', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4.5,
                },
                c: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 150,
                    year: 2021,
                    rating: 3,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(12.5);
        });
        (0, mocha_1.it)('performs sum of ints and floats that results in an int', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4.5,
                },
                c: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 150,
                    year: 2021,
                    rating: 3.5,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(13);
        });
        (0, mocha_1.it)('performs sum that overflows max int', async () => {
            // A large value that will be represented as a Long on the server, but
            // doubling (2x) this value must overflow Long and force the result to be
            // represented as a Double type on the server.
            const maxLong = Math.pow(2, 63) - 1;
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: maxLong,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: maxLong,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(maxLong + maxLong);
        });
        (0, mocha_1.it)('performs sum that can overflow integer values during accumulation', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_SAFE_INTEGER,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 1,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 50,
                    year: 2020,
                    rating: -101,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(Number.MAX_SAFE_INTEGER - 100);
        });
        (0, mocha_1.it)('performs sum that is negative', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_SAFE_INTEGER,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: Number.MIN_SAFE_INTEGER,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 50,
                    year: 2020,
                    rating: -101,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: -10000,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(-10101);
        });
        (0, mocha_1.it)('performs sum that is positive infinity', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: Number.MAX_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(Number.POSITIVE_INFINITY);
        });
        (0, mocha_1.it)('performs sum that is positive infinity v2', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 1e293,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(Number.POSITIVE_INFINITY);
        });
        (0, mocha_1.it)('performs sum that is negative infinity', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: -Number.MAX_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: -Number.MAX_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(Number.NEGATIVE_INFINITY);
        });
        (0, mocha_1.it)('performs sum that is valid but could overflow during aggregation', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: Number.MAX_VALUE,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: -Number.MAX_VALUE,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: -Number.MAX_VALUE,
                },
                e: {
                    author: 'authorE',
                    title: 'titleE',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_VALUE,
                },
                f: {
                    author: 'authorF',
                    title: 'titleF',
                    pages: 50,
                    year: 2020,
                    rating: -Number.MAX_VALUE,
                },
                g: {
                    author: 'authorG',
                    title: 'titleG',
                    pages: 100,
                    year: 1980,
                    rating: -Number.MAX_VALUE,
                },
                h: {
                    author: 'authorH',
                    title: 'titleDH',
                    pages: 50,
                    year: 2020,
                    rating: Number.MAX_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.oneOf([
                0,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
            ]);
        });
        (0, mocha_1.it)('performs sum that includes NaN', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: Number.NaN,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.be.NaN;
        });
        (0, mocha_1.it)('performs sum over a result set of zero documents', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 4,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: 3,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .where('rating', '>', 4)
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(0);
        });
        (0, mocha_1.it)('performs sum only on numeric fields', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: '3',
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 1,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
                countOfDocs: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(10);
            (0, chai_1.expect)(snapshot.data().countOfDocs).to.equal(4);
        });
        (0, mocha_1.it)('performs sum of min IEEE754', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MIN_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(Number.MIN_VALUE);
        });
        (0, mocha_1.it)('performs average of ints that results in an int', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 10,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 5,
                },
                c: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 150,
                    year: 2021,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(5);
        });
        (0, mocha_1.it)('performs average of floats that results in an int', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 10.5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 9.5,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(10);
        });
        (0, mocha_1.it)('performs average of floats and ints that results in an int', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 10,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 9.5,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 150,
                    year: 2021,
                    rating: 10.5,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(10);
        });
        (0, mocha_1.it)('performs average of float that results in float', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5.5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4.5,
                },
                c: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 150,
                    year: 2021,
                    rating: 3.5,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(4.5);
        });
        (0, mocha_1.it)('performs average of floats and ints that results in a float', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 8.6,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 9,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 150,
                    year: 2021,
                    rating: 10,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.be.approximately(9.2, 0.0000001);
        });
        (0, mocha_1.it)('performs average of ints that results in a float', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 10,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 9,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(9.5);
        });
        (0, mocha_1.it)('performs average causing underflow', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MIN_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(0);
        });
        (0, mocha_1.it)('performs average of min IEEE754', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MIN_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(Number.MIN_VALUE);
        });
        (0, mocha_1.it)('performs average that overflows IEEE754 during accumulation', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: Number.MAX_VALUE,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: Number.MAX_VALUE,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(Number.POSITIVE_INFINITY);
        });
        (0, mocha_1.it)('performs average that includes NaN', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: Number.NaN,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.be.NaN;
        });
        (0, mocha_1.it)('performs average over a result set of zero documents', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 4,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: 3,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .where('rating', '>', 4)
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.be.null;
        });
        (0, mocha_1.it)('performs average only on numeric fields', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: '3',
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 6,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                averageRating: src_1.AggregateField.average('rating'),
                countOfDocs: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(5);
            (0, chai_1.expect)(snapshot.data().countOfDocs).to.equal(4);
        });
        (0, mocha_1.it)('allows aliases with length greater than 1500 bytes', async () => {
            // Alias string length is bytes of UTF-8 encoded alias + 1;
            let longAlias = '';
            for (let i = 0; i < 1500; i++) {
                longAlias += '0123456789';
            }
            const longerAlias = longAlias + longAlias;
            const testDocs = {
                a: { num: 3 },
                b: { num: 5 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                [longAlias]: src_1.AggregateField.count(),
                [longerAlias]: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data()[longAlias]).to.equal(2);
            (0, chai_1.expect)(snapshot.data()[longerAlias]).to.equal(2);
        });
        (0, mocha_1.it)('performs aggregations on nested map values', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    metadata: { pages: 100, rating: { critic: 2, user: 5 } },
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    metadata: { pages: 50, rating: { critic: 4, user: 4 } },
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalPages: src_1.AggregateField.sum('metadata.pages'),
                averagePages: src_1.AggregateField.average('metadata.pages'),
                count: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(150);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(75);
            (0, chai_1.expect)(snapshot.data().count).to.equal(2);
        });
        (0, mocha_1.it)('performs aggregates when using `in` operator', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: 3,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .where('rating', 'in', [5, 3])
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
                averageRating: src_1.AggregateField.average('rating'),
                countOfDocs: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(8);
            (0, chai_1.expect)(snapshot.data().averageRating).to.equal(4);
            (0, chai_1.expect)(snapshot.data().countOfDocs).to.equal(2);
        });
    });
    // Only run tests that require indexes against the emulator, because we don't
    // have a way to dynamically create the indexes when running the tests.
    (process.env.FIRESTORE_EMULATOR_HOST ? mocha_1.describe : mocha_1.describe.skip)('queries requiring indexes', () => {
        (0, mocha_1.it)('aggregate query supports collection groups', async () => {
            const collectionGroupId = (0, util_1.autoId)();
            const docPaths = [
                `${collectionGroupId}/cg-doc1`,
                `abc/123/${collectionGroupId}/cg-doc2`,
                `zzz${collectionGroupId}/cg-doc3`,
                `abc/123/zzz${collectionGroupId}/cg-doc4`,
                `abc/123/zzz/${collectionGroupId}`,
            ];
            const batch = firestore.batch();
            for (const docPath of docPaths) {
                batch.set(firestore.doc(docPath), { x: 2 });
            }
            await batch.commit();
            const snapshot = await firestore
                .collectionGroup(collectionGroupId)
                .aggregate({
                count: src_1.AggregateField.count(),
                sum: src_1.AggregateField.sum('x'),
                avg: src_1.AggregateField.average('x'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().count).to.equal(2);
            (0, chai_1.expect)(snapshot.data().sum).to.equal(4);
            (0, chai_1.expect)(snapshot.data().avg).to.equal(2);
        });
        (0, mocha_1.it)('performs aggregations on documents with all aggregated fields', async () => {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', pages: 100, year: 1980 },
                b: { author: 'authorB', title: 'titleB', pages: 50, year: 2020 },
                c: { author: 'authorC', title: 'titleC', pages: 150, year: 2021 },
                d: { author: 'authorD', title: 'titleD', pages: 50 },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                averageYear: src_1.AggregateField.average('year'),
                count: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(300);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(100);
            (0, chai_1.expect)(snapshot.data().averageYear).to.equal(2007);
            (0, chai_1.expect)(snapshot.data().count).to.equal(3);
        });
        (0, mocha_1.it)('performs aggregates on multiple fields where one aggregate could cause short-circuit due to NaN', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: 5,
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: 4,
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: Number.NaN,
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: 0,
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
                totalPages: src_1.AggregateField.sum('pages'),
                averageYear: src_1.AggregateField.average('year'),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.be.NaN;
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(300);
            (0, chai_1.expect)(snapshot.data().averageYear).to.equal(2000);
        });
        (0, mocha_1.it)('performs aggregates when using `array-contains-any` operator', async () => {
            const testDocs = {
                a: {
                    author: 'authorA',
                    title: 'titleA',
                    pages: 100,
                    year: 1980,
                    rating: [5, 1000],
                },
                b: {
                    author: 'authorB',
                    title: 'titleB',
                    pages: 50,
                    year: 2020,
                    rating: [4],
                },
                c: {
                    author: 'authorC',
                    title: 'titleC',
                    pages: 100,
                    year: 1980,
                    rating: [2222, 3],
                },
                d: {
                    author: 'authorD',
                    title: 'titleD',
                    pages: 50,
                    year: 2020,
                    rating: [0],
                },
            };
            await addTestDocs(testDocs);
            const snapshot = await col
                .where('rating', 'array-contains-any', [5, 3])
                .aggregate({
                totalRating: src_1.AggregateField.sum('rating'),
                averageRating: src_1.AggregateField.average('rating'),
                totalPages: src_1.AggregateField.sum('pages'),
                averagePages: src_1.AggregateField.average('pages'),
                countOfDocs: src_1.AggregateField.count(),
            })
                .get();
            (0, chai_1.expect)(snapshot.data().totalRating).to.equal(0);
            (0, chai_1.expect)(snapshot.data().averageRating).to.be.null;
            (0, chai_1.expect)(snapshot.data().totalPages).to.equal(200);
            (0, chai_1.expect)(snapshot.data().averagePages).to.equal(100);
            (0, chai_1.expect)(snapshot.data().countOfDocs).to.equal(2);
        });
    });
    (0, mocha_1.describe)('Aggregation queries - orderBy Normalization Checks', () => {
        async function addTwoDocs() {
            const testDocs = {
                a: { author: 'authorA', title: 'titleA', num: 5, foo: 1 },
                b: { author: 'authorB', title: 'titleB', num: 7, foo: 2 },
            };
            await addTestDocs(testDocs);
        }
        (0, mocha_1.it)('no filter, no orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(12);
        });
        (0, mocha_1.it)('equality filter, no orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '==', 5)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(5);
        });
        (0, mocha_1.it)('inequality filter, no orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '>', 5)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        (0, mocha_1.it)('no filter, explicit orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .orderBy('num')
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(12);
        });
        (0, mocha_1.it)('equality filter, explicit orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '==', 5)
                .orderBy('num')
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(5);
        });
        (0, mocha_1.it)('inequality filter, explicit orderBy, no cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '>', 5)
                .orderBy('num')
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        (0, mocha_1.it)('no filter, explicit orderBy, field value cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .orderBy('num')
                .startAfter(5)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `__name__, num` index.
        // SDK sends: orderBy __name__
        mocha_1.it.skip('no filter, explicit orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .orderBy(src_1.FieldPath.documentId())
                .startAfter(col.doc('a'))
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `__name__, num` index.
        // SDK sends: orderBy __name__
        mocha_1.it.skip('no filter, no orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `foo, __name__, num` index.
        // SDK sends: orderBy foo, __name__
        mocha_1.it.skip('no filter, explicit orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .orderBy('foo')
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This just happens to work because the orderBy field matches the aggregation field.
        // SDK sends: orderBy num, __name__
        (0, mocha_1.it)('no filter, explicit orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .orderBy('num')
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        (0, mocha_1.it)('equality filter, explicit orderBy, field value cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '==', 5)
                .orderBy('num')
                .startAt(5)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(5);
        });
        (0, mocha_1.it)('inequality filter, explicit orderBy, field value cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '>', 5)
                .orderBy('num')
                .startAt(5)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `__name__, num` index.
        // SDK sends: orderBy __name__
        mocha_1.it.skip('equality filter, explicit orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '==', 7)
                .orderBy(src_1.FieldPath.documentId())
                .startAfter(col.doc('a'))
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // Full orderBy is provided.
        // SDK sends: orderBy num, __name__
        (0, mocha_1.it)('inequality filter, explicit orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const snapshot = await col
                .where('num', '>', 5)
                .orderBy('num')
                .orderBy(src_1.FieldPath.documentId())
                .startAfter(5, col.doc('a'))
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `__name__, num` index.
        // SDK sends: orderBy __name__
        mocha_1.it.skip('equality filter, no orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .where('num', '==', 7)
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This just happens to work because the orderBy field matches the aggregation field.
        // SDK sends: orderBy num, __name__
        (0, mocha_1.it)('inequality filter, no orderBy, document reference cursor', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .where('num', '>', 0)
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
        // This is expected to fail because it requires the `foo, __name__, num` index.
        // SDK sends: orderBy foo, __name__
        mocha_1.it.skip('inequality filter, no orderBy, document reference cursor 2', async () => {
            await addTwoDocs();
            const docSnap = await col.doc('a').get();
            const snapshot = await col
                .where('foo', '>', 0)
                .startAfter(docSnap)
                .aggregate({ sum: src_1.AggregateField.sum('num') })
                .get();
            (0, chai_1.expect)(snapshot.data().sum).to.equal(7);
        });
    });
});
(0, mocha_1.describe)('Transaction class', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has get() method', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'bar' })
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                return updateFunction.get(ref).then(doc => {
                    return Promise.resolve(doc.get('foo'));
                });
            });
        })
            .then(res => {
            (0, chai_1.expect)(res).to.equal('bar');
        });
    });
    (0, mocha_1.it)('has getAll() method', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({}), ref2.set({})])
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                return updateFunction.getAll(ref1, ref2).then(docs => {
                    return Promise.resolve(docs.length);
                });
            });
        })
            .then(res => {
            (0, chai_1.expect)(res).to.equal(2);
        });
    });
    (0, mocha_1.it)('getAll() supports array destructuring', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([ref1.set({}), ref2.set({})])
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                return updateFunction.getAll(...[ref1, ref2]).then(docs => {
                    return Promise.resolve(docs.length);
                });
            });
        })
            .then(res => {
            (0, chai_1.expect)(res).to.equal(2);
        });
    });
    (0, mocha_1.it)('getAll() supports field mask', () => {
        const ref1 = randomCol.doc('doc1');
        return ref1.set({ foo: 'a', bar: 'b' }).then(() => {
            return firestore
                .runTransaction(updateFunction => {
                return updateFunction
                    .getAll(ref1, { fieldMask: ['foo'] })
                    .then(([doc]) => doc);
            })
                .then(doc => {
                (0, chai_1.expect)(doc.data()).to.deep.equal({ foo: 'a' });
            });
        });
    });
    (0, mocha_1.it)('getAll() supports array destructuring with field mask', () => {
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        return Promise.all([
            ref1.set({ f: 'a', b: 'b' }),
            ref2.set({ f: 'a', b: 'b' }),
        ]).then(() => {
            return firestore
                .runTransaction(updateFunction => {
                return updateFunction
                    .getAll(...[ref1, ref2], { fieldMask: ['f'] })
                    .then(docs => docs);
            })
                .then(docs => {
                (0, chai_1.expect)(docs[0].data()).to.deep.equal({ f: 'a' });
                (0, chai_1.expect)(docs[1].data()).to.deep.equal({ f: 'a' });
            });
        });
    });
    (0, mocha_1.it)('getAll() supports withConverter()', async () => {
        const ref1 = randomCol.doc('doc1').withConverter(helpers_1.postConverter);
        const ref2 = randomCol.doc('doc2').withConverter(helpers_1.postConverter);
        await ref1.set(new helpers_1.Post('post1', 'author1'));
        await ref2.set(new helpers_1.Post('post2', 'author2'));
        const docs = await firestore.runTransaction(updateFunction => {
            return updateFunction.getAll(ref1, ref2);
        });
        (0, chai_1.expect)(docs[0].data().toString()).to.equal('post1, by author1');
        (0, chai_1.expect)(docs[1].data().toString()).to.equal('post2, by author2');
    });
    (0, mocha_1.it)('set() and get() support withConverter()', async () => {
        const ref = randomCol.doc('doc1').withConverter(helpers_1.postConverter);
        await ref.set(new helpers_1.Post('post', 'author'));
        await firestore.runTransaction(async (txn) => {
            await txn.get(ref);
            await txn.set(ref, new helpers_1.Post('new post', 'author'));
        });
        const doc = await ref.get();
        (0, chai_1.expect)(doc.data().toString()).to.equal('new post, by author');
    });
    (0, mocha_1.it)('has get() with query', () => {
        const ref = randomCol.doc('doc');
        const query = randomCol.where('foo', '==', 'bar');
        return ref
            .set({ foo: 'bar' })
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                return updateFunction.get(query).then(res => {
                    return Promise.resolve(res.docs[0].get('foo'));
                });
            });
        })
            .then(res => {
            (0, chai_1.expect)(res).to.equal('bar');
        });
    });
    (0, mocha_1.it)('has set() method', () => {
        const ref = randomCol.doc('doc');
        return firestore
            .runTransaction(updateFunction => {
            updateFunction.set(ref, { foo: 'foobar' });
            return Promise.resolve();
        })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('foobar');
        });
    });
    (0, mocha_1.it)('has update() method', () => {
        const ref = randomCol.doc('doc');
        return ref
            .set({
            boo: ['ghost', 'sebastian'],
            moo: 'chicken',
        })
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                return updateFunction.get(ref).then(() => {
                    updateFunction.update(ref, {
                        boo: src_1.FieldValue.arrayRemove('sebastian'),
                        moo: 'cow',
                    });
                });
            });
        })
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.data()).to.deep.equal({
                boo: ['ghost'],
                moo: 'cow',
            });
        });
    });
    (0, mocha_1.it)('has delete() method', () => {
        let success = false;
        const ref = randomCol.doc('doc');
        return ref
            .set({ foo: 'bar' })
            .then(() => {
            return firestore.runTransaction(updateFunction => {
                updateFunction.delete(ref);
                return Promise.resolve();
            });
        })
            .then(() => {
            success = true;
            return ref.get();
        })
            .then(result => {
            (0, chai_1.expect)(success).to.be.true;
            (0, chai_1.expect)(result.exists).to.be.false;
        });
    });
    (0, mocha_1.it)('does not retry transaction that fail with FAILED_PRECONDITION', async () => {
        const ref = firestore.collection('col').doc();
        let attempts = 0;
        const promise = firestore.runTransaction(async (transaction) => {
            ++attempts;
            transaction.update(ref, { foo: 'b' });
        });
        // Validate the error message when testing against the firestore backend.
        if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
            await (0, chai_1.expect)(promise).to.eventually.be.rejectedWith(/No document to update/);
        }
        else {
            // The emulator generates a different error message, do not validate the error message.
            await (0, chai_1.expect)(promise).to.eventually.be.rejected;
        }
        (0, chai_1.expect)(attempts).to.equal(1);
    });
    // Skip this test when running against the emulator because it does not work
    // against the emulator. Contention in the emulator may behave differently.
    (process.env.FIRESTORE_EMULATOR_HOST === undefined ? mocha_1.it : mocha_1.it.skip)('retries transactions that fail with contention', async () => {
        const ref = randomCol.doc('doc');
        let attempts = 0;
        // Create two transactions that both read and update the same document.
        // `contentionPromise` is used to ensure that both transactions are active
        // on commit, which causes one of transactions to fail with Code ABORTED
        // and be retried.
        const contentionPromise = [new util_1.Deferred(), new util_1.Deferred()];
        const firstTransaction = firestore.runTransaction(async (transaction) => {
            ++attempts;
            await transaction.get(ref);
            contentionPromise[0].resolve();
            await contentionPromise[1].promise;
            transaction.set(ref, { first: true }, { merge: true });
        });
        const secondTransaction = firestore.runTransaction(async (transaction) => {
            ++attempts;
            await transaction.get(ref);
            contentionPromise[1].resolve();
            await contentionPromise[0].promise;
            transaction.set(ref, { second: true }, { merge: true });
        });
        await firstTransaction;
        await secondTransaction;
        (0, chai_1.expect)(attempts).to.equal(3);
        const finalSnapshot = await ref.get();
        (0, chai_1.expect)(finalSnapshot.data()).to.deep.equal({ first: true, second: true });
    });
    (0, mocha_1.it)('supports read-only transactions', async () => {
        const ref = randomCol.doc('doc');
        await ref.set({ foo: 'bar' });
        const snapshot = await firestore.runTransaction(updateFunction => updateFunction.get(ref), { readOnly: true });
        (0, chai_1.expect)(snapshot.exists).to.be.true;
    });
    (0, mocha_1.it)('supports read-only transactions with custom read-time', async () => {
        const ref = randomCol.doc('doc');
        const writeResult = await ref.set({ foo: 1 });
        await ref.set({ foo: 2 });
        const snapshot = await firestore.runTransaction(updateFunction => updateFunction.get(ref), { readOnly: true, readTime: writeResult.writeTime });
        (0, chai_1.expect)(snapshot.exists).to.be.true;
        (0, chai_1.expect)(snapshot.get('foo')).to.equal(1);
    });
});
(0, mocha_1.describe)('WriteBatch class', () => {
    let firestore;
    let randomCol;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('supports empty batches', () => {
        return firestore.batch().commit();
    });
    (0, mocha_1.it)('has create() method', () => {
        const ref = randomCol.doc();
        const batch = firestore.batch();
        batch.create(ref, { foo: 'a' });
        return batch
            .commit()
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('has set() method', () => {
        const ref = randomCol.doc('doc');
        const batch = firestore.batch();
        batch.set(ref, { foo: 'a' });
        return batch
            .commit()
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('set supports partials', async () => {
        const ref = randomCol.doc('doc').withConverter(helpers_1.postConverterMerge);
        await ref.set(new helpers_1.Post('walnut', 'author'));
        const batch = firestore.batch();
        batch.set(ref, { title: 'olive' }, { merge: true });
        return batch
            .commit()
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('title')).to.equal('olive');
            (0, chai_1.expect)(doc.get('author')).to.equal('author');
        });
    });
    (0, mocha_1.it)('set()', () => {
        const ref = randomCol.doc('doc');
        const batch = firestore.batch();
        batch.set(ref, { foo: 'a' });
        return batch
            .commit()
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('has a full stack trace if set() errors', () => {
        // Use an invalid document name that the backend will reject.
        const ref = randomCol.doc('__doc__');
        const batch = firestore.batch();
        batch.set(ref, { foo: 'a' });
        return batch
            .commit()
            .then(() => Promise.reject('commit() should have failed'))
            .catch((err) => {
            (0, chai_1.expect)(err.stack).to.contain('WriteBatch.commit');
        });
    });
    (0, mocha_1.it)('has update() method', () => {
        const ref = randomCol.doc('doc');
        const batch = firestore.batch();
        batch.set(ref, { foo: 'a' });
        batch.update(ref, { foo: 'b' });
        return batch
            .commit()
            .then(() => {
            return ref.get();
        })
            .then(doc => {
            (0, chai_1.expect)(doc.get('foo')).to.equal('b');
        });
    });
    (0, mocha_1.it)('omits document transforms from write results', () => {
        const batch = firestore.batch();
        batch.set(randomCol.doc(), { foo: 'a' });
        batch.set(randomCol.doc(), { foo: src_1.FieldValue.serverTimestamp() });
        return batch.commit().then(writeResults => {
            (0, chai_1.expect)(writeResults).to.have.length(2);
        });
    });
    (0, mocha_1.it)('enforces that updated document exists', () => {
        const ref = randomCol.doc();
        const batch = firestore.batch();
        batch.update(ref, { foo: 'b' });
        return batch
            .commit()
            .then(() => {
            chai_1.expect.fail();
        })
            .catch(err => {
            (0, chai_1.expect)(err.message.match(/No document to update/));
        });
    });
    (0, mocha_1.it)('has delete() method', () => {
        let success = false;
        const ref = randomCol.doc('doc');
        const batch = firestore.batch();
        batch.set(ref, { foo: 'a' });
        batch.delete(ref);
        return batch
            .commit()
            .then(() => {
            success = true;
            return ref.get();
        })
            .then(result => {
            (0, chai_1.expect)(success).to.be.true;
            (0, chai_1.expect)(result.exists).to.be.false;
        });
    });
});
(0, mocha_1.describe)('QuerySnapshot class', () => {
    let firestore;
    let querySnapshot;
    (0, mocha_1.beforeEach)(() => {
        const randomCol = getTestRoot();
        firestore = randomCol.firestore;
        const ref1 = randomCol.doc('doc1');
        const ref2 = randomCol.doc('doc2');
        querySnapshot = Promise.all([
            ref1.set({ foo: 'a' }),
            ref2.set({ foo: 'a' }),
        ]).then(() => {
            return randomCol.get();
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has query property', () => {
        return querySnapshot
            .then(snapshot => {
            return snapshot.query.get();
        })
            .then(snapshot => {
            (0, chai_1.expect)(snapshot.size).to.equal(2);
        });
    });
    (0, mocha_1.it)('has empty property', () => {
        return querySnapshot
            .then(snapshot => {
            (0, chai_1.expect)(snapshot.empty).to.be.false;
            (0, chai_1.expect)(snapshot.readTime).to.exist;
            return snapshot.query.where('foo', '==', 'bar').get();
        })
            .then(snapshot => {
            (0, chai_1.expect)(snapshot.empty).to.be.true;
            (0, chai_1.expect)(snapshot.readTime).to.exist;
        });
    });
    (0, mocha_1.it)('has size property', () => {
        return querySnapshot.then(snapshot => {
            (0, chai_1.expect)(snapshot.size).to.equal(2);
        });
    });
    (0, mocha_1.it)('has docs property', () => {
        return querySnapshot.then(snapshot => {
            (0, chai_1.expect)(snapshot.docs).to.have.length(2);
            (0, chai_1.expect)(snapshot.docs[0].get('foo')).to.equal('a');
        });
    });
    (0, mocha_1.it)('has forEach() method', () => {
        let count = 0;
        return querySnapshot.then(snapshot => {
            snapshot.forEach(doc => {
                (0, chai_1.expect)(doc.get('foo')).to.equal('a');
                ++count;
            });
            (0, chai_1.expect)(count).to.equal(2);
        });
    });
});
(0, mocha_1.describe)('BulkWriter class', () => {
    let firestore;
    let randomCol;
    let writer;
    (0, mocha_1.beforeEach)(() => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
        writer = firestore.bulkWriter();
    });
    (0, mocha_1.afterEach)(async () => {
        await writer.close();
        await (0, helpers_1.verifyInstance)(firestore);
        await firestore.terminate();
    });
    (0, mocha_1.it)('has create() method', async () => {
        const ref = randomCol.doc('doc1');
        const singleOp = writer.create(ref, { foo: 'bar' });
        await writer.close();
        const result = await ref.get();
        (0, chai_1.expect)(result.data()).to.deep.equal({ foo: 'bar' });
        const writeTime = (await singleOp).writeTime;
        (0, chai_1.expect)(writeTime).to.not.be.null;
    });
    (0, mocha_1.it)('has set() method', async () => {
        const ref = randomCol.doc('doc1');
        const singleOp = writer.set(ref, { foo: 'bar' });
        await writer.close();
        const result = await ref.get();
        (0, chai_1.expect)(result.data()).to.deep.equal({ foo: 'bar' });
        const writeTime = (await singleOp).writeTime;
        (0, chai_1.expect)(writeTime).to.not.be.null;
    });
    (0, mocha_1.it)('has update() method', async () => {
        const ref = randomCol.doc('doc1');
        await ref.set({ foo: 'bar' });
        const singleOp = writer.update(ref, { foo: 'bar2' });
        await writer.close();
        const result = await ref.get();
        (0, chai_1.expect)(result.data()).to.deep.equal({ foo: 'bar2' });
        const writeTime = (await singleOp).writeTime;
        (0, chai_1.expect)(writeTime).to.not.be.null;
    });
    (0, mocha_1.it)('has delete() method', async () => {
        const ref = randomCol.doc('doc1');
        await ref.set({ foo: 'bar' });
        const singleOp = writer.delete(ref);
        await writer.close();
        const result = await ref.get();
        (0, chai_1.expect)(result.exists).to.be.false;
        // TODO(b/158502664): Remove this check once we can get write times.
        const deleteResult = await singleOp;
        (0, chai_1.expect)(deleteResult.writeTime).to.deep.equal(new src_1.Timestamp(0, 0));
    });
    (0, mocha_1.it)('can write to the same document twice', async () => {
        const ref = randomCol.doc('doc1');
        const op1 = writer.set(ref, { foo: 'bar' });
        const op2 = writer.set(ref, { foo: 'bar2' });
        await writer.close();
        const result = await ref.get();
        // The order of writes is not guaranteed.
        (0, chai_1.expect)(result.get('foo')).to.not.be.undefined;
        const writeTime1 = (await op1).writeTime;
        const writeTime2 = (await op2).writeTime;
        (0, chai_1.expect)(writeTime1).to.not.be.null;
        (0, chai_1.expect)(writeTime2).to.not.be.null;
    });
    (0, mocha_1.it)('can terminate once BulkWriter is closed', async () => {
        const ref = randomCol.doc('doc1');
        writer.set(ref, { foo: 'bar' });
        await writer.close();
        return firestore.terminate();
    });
    (0, mocha_1.describe)('recursiveDelete()', () => {
        async function countDocumentChildren(ref) {
            let count = 0;
            const collections = await ref.listCollections();
            for (const collection of collections) {
                count += await countCollectionChildren(collection);
            }
            return count;
        }
        async function countCollectionChildren(ref) {
            let count = 0;
            const docs = await ref.listDocuments();
            for (const doc of docs) {
                count += (await countDocumentChildren(doc)) + 1;
            }
            return count;
        }
        (0, mocha_1.beforeEach)(async () => {
            // ROOT-DB
            // └── randomCol
            //     ├── anna
            //     └── bob
            //         └── parentsCol
            //             ├── charlie
            //             └── daniel
            //                 └── childCol
            //                     ├── ernie
            //                     └── francis
            const batch = firestore.batch();
            batch.set(randomCol.doc('anna'), { name: 'anna' });
            batch.set(randomCol.doc('bob'), { name: 'bob' });
            batch.set(randomCol.doc('bob/parentsCol/charlie'), { name: 'charlie' });
            batch.set(randomCol.doc('bob/parentsCol/daniel'), { name: 'daniel' });
            batch.set(randomCol.doc('bob/parentsCol/daniel/childCol/ernie'), {
                name: 'ernie',
            });
            batch.set(randomCol.doc('bob/parentsCol/daniel/childCol/francis'), {
                name: 'francis',
            });
            await batch.commit();
        });
        (0, mocha_1.it)('on top-level collection', async () => {
            await firestore.recursiveDelete(randomCol);
            (0, chai_1.expect)(await countCollectionChildren(randomCol)).to.equal(0);
        });
        (0, mocha_1.it)('on nested collection', async () => {
            const coll = randomCol.doc('bob').collection('parentsCol');
            await firestore.recursiveDelete(coll);
            (0, chai_1.expect)(await countCollectionChildren(coll)).to.equal(0);
            (0, chai_1.expect)(await countCollectionChildren(randomCol)).to.equal(2);
        });
        (0, mocha_1.it)('on nested document', async () => {
            const doc = randomCol.doc('bob/parentsCol/daniel');
            await firestore.recursiveDelete(doc);
            const docSnap = await doc.get();
            (0, chai_1.expect)(docSnap.exists).to.be.false;
            (0, chai_1.expect)(await countDocumentChildren(randomCol.doc('bob'))).to.equal(1);
            (0, chai_1.expect)(await countCollectionChildren(randomCol)).to.equal(3);
        });
        (0, mocha_1.it)('on leaf document', async () => {
            const doc = randomCol.doc('bob/parentsCol/daniel/childCol/ernie');
            await firestore.recursiveDelete(doc);
            const docSnap = await doc.get();
            (0, chai_1.expect)(docSnap.exists).to.be.false;
            (0, chai_1.expect)(await countCollectionChildren(randomCol)).to.equal(5);
        });
        (0, mocha_1.it)('does not affect other collections', async () => {
            // Add other nested collection that shouldn't be deleted.
            const collB = firestore.collection('doggos');
            await collB.doc('doggo').set({ name: 'goodboi' });
            await firestore.recursiveDelete(collB);
            (0, chai_1.expect)(await countCollectionChildren(randomCol)).to.equal(6);
            (0, chai_1.expect)(await countCollectionChildren(collB)).to.equal(0);
        });
        (0, mocha_1.it)('with custom BulkWriter instance', async () => {
            const bulkWriter = firestore.bulkWriter();
            let callbackCount = 0;
            bulkWriter.onWriteResult(() => {
                callbackCount++;
            });
            await firestore.recursiveDelete(randomCol, bulkWriter);
            (0, chai_1.expect)(callbackCount).to.equal(6);
            await bulkWriter.close();
        });
    });
    (0, mocha_1.it)('can retry failed writes with a provided callback', async () => {
        let retryCount = 0;
        let code = -1;
        writer.onWriteError(error => {
            retryCount = error.failedAttempts;
            return error.failedAttempts < 3;
        });
        // Use an invalid document name that the backend will reject.
        const ref = randomCol.doc('__doc__');
        writer.create(ref, { foo: 'bar' }).catch(err => {
            code = err.code;
        });
        await writer.close();
        (0, chai_1.expect)(retryCount).to.equal(3);
        (0, chai_1.expect)(code).to.equal(google_gax_1.Status.INVALID_ARGUMENT);
    });
});
(0, mocha_1.describe)('Client initialization', () => {
    const ops = [
        ['CollectionReference.get()', randomColl => randomColl.get()],
        ['CollectionReference.add()', randomColl => randomColl.add({})],
        [
            'CollectionReference.stream()',
            randomColl => {
                const deferred = new util_1.Deferred();
                randomColl.stream().on('finish', () => {
                    deferred.resolve();
                });
                return deferred.promise;
            },
        ],
        [
            'CollectionReference.listDocuments()',
            randomColl => randomColl.listDocuments(),
        ],
        [
            'CollectionReference.onSnapshot()',
            randomColl => {
                const deferred = new util_1.Deferred();
                const unsubscribe = randomColl.onSnapshot(() => {
                    unsubscribe();
                    deferred.resolve();
                });
                return deferred.promise;
            },
        ],
        ['DocumentReference.get()', randomColl => randomColl.doc().get()],
        ['DocumentReference.create()', randomColl => randomColl.doc().create({})],
        ['DocumentReference.set()', randomColl => randomColl.doc().set({})],
        [
            'DocumentReference.update()',
            async (randomColl) => {
                const update = randomColl.doc().update('foo', 'bar');
                // Don't validate the error message when running against the emulator.
                // Emulator gives different error message.
                if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
                    await (0, chai_1.expect)(update).to.eventually.be.rejectedWith('No document to update');
                }
                else {
                    await (0, chai_1.expect)(update).to.eventually.be.rejected;
                }
            },
        ],
        ['DocumentReference.delete()', randomColl => randomColl.doc().delete()],
        [
            'DocumentReference.listCollections()',
            randomColl => randomColl.doc().listCollections(),
        ],
        [
            'DocumentReference.onSnapshot()',
            randomColl => {
                const deferred = new util_1.Deferred();
                const unsubscribe = randomColl.doc().onSnapshot(() => {
                    unsubscribe();
                    deferred.resolve();
                });
                return deferred.promise;
            },
        ],
        [
            'CollectionGroup.getPartitions()',
            async (randomColl) => {
                const partitions = randomColl.firestore
                    .collectionGroup('id')
                    .getPartitions(2);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for await (const _ of partitions)
                    ;
            },
            // Skip this test when running against the emulator because partition queries
            // are not supported in the emulator.
            !!process.env.FIRESTORE_EMULATOR_HOST,
        ],
        [
            'Firestore.runTransaction()',
            randomColl => randomColl.firestore.runTransaction(t => t.get(randomColl)),
        ],
        [
            'Firestore.getAll()',
            randomColl => randomColl.firestore.getAll(randomColl.doc()),
        ],
        ['Firestore.batch()', randomColl => randomColl.firestore.batch().commit()],
        ['Firestore.terminate()', randomColl => randomColl.firestore.terminate()],
    ];
    for (const [description, op, skip] of ops) {
        (!skip ? mocha_1.it : mocha_1.it.skip)(`succeeds for ${description}`, () => {
            const randomCol = getTestRoot();
            return op(randomCol);
        });
    }
});
(0, mocha_1.describe)('Bundle building', () => {
    let firestore;
    let testCol;
    (0, mocha_1.beforeEach)(async () => {
        testCol = getTestRoot();
        firestore = testCol.firestore;
        const ref1 = testCol.doc('doc1');
        const ref2 = testCol.doc('doc2');
        const ref3 = testCol.doc('doc3');
        const ref4 = testCol.doc('doc4');
        await Promise.all([
            ref1.set({ name: '1', sort: 1, value: 'string value' }),
            ref2.set({ name: '2', sort: 2, value: 42 }),
            ref3.set({ name: '3', sort: 3, value: { nested: 'nested value' } }),
            ref4.set({
                name: '4',
                sort: 4,
                value: src_1.FieldValue.serverTimestamp(),
            }),
        ]);
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('succeeds when there are no results', async () => {
        const bundle = firestore.bundle(bundle_1.TEST_BUNDLE_ID);
        const query = testCol.where('value', '==', '42');
        const snap = await query.get();
        bundle.add('query', snap);
        // `elements` is expected to be [bundleMeta, query].
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        const meta = elements[0].metadata;
        (0, bundle_1.verifyMetadata)(meta, snap.readTime.toProto().timestampValue, 0);
        const namedQuery = elements[1].namedQuery;
        // Verify saved query.
        (0, chai_1.expect)(namedQuery).to.deep.equal({
            name: 'query',
            readTime: snap.readTime.toProto().timestampValue,
            // TODO(wuandy): Fix query.toProto to skip undefined fields, so we can stop using `extend` here.
            bundledQuery: extend(true, {}, {
                parent: query.toProto().parent,
                structuredQuery: query.toProto().structuredQuery,
            }),
        });
    });
    (0, mocha_1.it)('succeeds when added document does not exist', async () => {
        const bundle = firestore.bundle(bundle_1.TEST_BUNDLE_ID);
        const snap = await testCol.doc('doc5-not-exist').get();
        bundle.add(snap);
        // `elements` is expected to be [bundleMeta, docMeta].
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(2);
        const meta = elements[0].metadata;
        (0, bundle_1.verifyMetadata)(meta, snap.readTime.toProto().timestampValue, 1);
        const docMeta = elements[1].documentMetadata;
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: snap.toDocumentProto().name,
            readTime: snap.readTime.toProto().timestampValue,
            exists: false,
        });
    });
    (0, mocha_1.it)('succeeds to save limit and limitToLast queries', async () => {
        const bundle = firestore.bundle(bundle_1.TEST_BUNDLE_ID);
        const limitQuery = testCol.orderBy('sort', 'desc').limit(1);
        const limitSnap = await limitQuery.get();
        const limitToLastQuery = testCol.orderBy('sort', 'asc').limitToLast(1);
        const limitToLastSnap = await limitToLastQuery.get();
        bundle.add('limitQuery', limitSnap);
        bundle.add('limitToLastQuery', limitToLastSnap);
        // `elements` is expected to be [bundleMeta, limitQuery, limitToLastQuery, doc4Meta, doc4Snap].
        const elements = await (0, helpers_1.bundleToElementArray)(await bundle.build());
        const meta = elements[0].metadata;
        (0, bundle_1.verifyMetadata)(meta, limitToLastSnap.readTime.toProto().timestampValue, 1);
        let namedQuery1 = elements[1].namedQuery;
        let namedQuery2 = elements[2].namedQuery;
        // We might need to swap them.
        if (namedQuery1.name === 'limitToLastQuery') {
            const temp = namedQuery2;
            namedQuery2 = namedQuery1;
            namedQuery1 = temp;
        }
        // Verify saved limit query.
        (0, chai_1.expect)(namedQuery1).to.deep.equal({
            name: 'limitQuery',
            readTime: limitSnap.readTime.toProto().timestampValue,
            bundledQuery: extend(true, {}, {
                parent: limitQuery.toProto().parent,
                structuredQuery: limitQuery.toProto().structuredQuery,
                limitType: 'FIRST',
            }),
        });
        // `limitToLastQuery`'s structured query should be the same as this one. This together with
        // `limitType` can re-construct a limitToLast client query by client SDKs.
        const q = testCol.orderBy('sort', 'asc').limit(1);
        // Verify saved limitToLast query.
        (0, chai_1.expect)(namedQuery2).to.deep.equal({
            name: 'limitToLastQuery',
            readTime: limitToLastSnap.readTime.toProto().timestampValue,
            bundledQuery: extend(true, {}, {
                parent: q.toProto().parent,
                structuredQuery: q.toProto().structuredQuery,
                limitType: 'LAST',
            }),
        });
        // Verify bundled document
        const docMeta = elements[3].documentMetadata;
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: limitToLastSnap.docs[0].toDocumentProto().name,
            readTime: limitToLastSnap.readTime.toProto().timestampValue,
            exists: true,
            queries: ['limitQuery', 'limitToLastQuery'],
        });
        const bundledDoc = elements[4].document;
        // The `valueType` is auxiliary and does not exist in proto.
        const expected = limitToLastSnap.docs[0].toDocumentProto();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete expected.fields.name.valueType;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete expected.fields.sort.valueType;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete expected.fields.value.valueType;
        (0, chai_1.expect)(bundledDoc).to.deep.equal(expected);
    });
});
(0, mocha_1.describe)('Types test', () => {
    let firestore;
    let randomCol;
    let doc;
    class TestObject {
        constructor(outerString, outerArr, nested) {
            this.outerString = outerString;
            this.outerArr = outerArr;
            this.nested = nested;
        }
    }
    const testConverter = {
        toFirestore(testObj) {
            return { ...testObj };
        },
        fromFirestore(snapshot) {
            const data = snapshot.data();
            return new TestObject(data.outerString, data.outerArr, data.nested);
        },
    };
    const initialData = {
        outerString: 'foo',
        outerArr: [],
        nested: {
            innerNested: {
                innerNestedNum: 2,
            },
            innerArr: src_1.FieldValue.arrayUnion(2),
            timestamp: src_1.FieldValue.serverTimestamp(),
        },
    };
    (0, mocha_1.beforeEach)(async () => {
        randomCol = getTestRoot();
        firestore = randomCol.firestore;
        doc = randomCol.doc();
        await doc.set(initialData);
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.describe)('Nested partial support', () => {
        const testConverterMerge = {
            toFirestore(testObj, options) {
                if (options) {
                    (0, chai_1.expect)(testObj).to.not.be.an.instanceOf(TestObject);
                }
                else {
                    (0, chai_1.expect)(testObj).to.be.an.instanceOf(TestObject);
                }
                return { ...testObj };
            },
            fromFirestore(snapshot) {
                const data = snapshot.data();
                return new TestObject(data.outerString, data.outerArr, data.nested);
            },
        };
        (0, mocha_1.it)('supports FieldValues', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Allow Field Values in nested partials.
            await ref.set({
                outerString: src_1.FieldValue.delete(),
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
            // Allow setting FieldValue on entire object field.
            await ref.set({
                nested: src_1.FieldValue.delete(),
            }, { merge: true });
        });
        (0, mocha_1.it)('validates types in outer and inner fields', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Check top-level fields.
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                outerString: 3,
                // @ts-expect-error Should fail to transpile.
                outerArr: null,
            }, { merge: true });
            // Check nested fields.
            await ref.set({
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        innerNestedNum: 'string',
                    },
                    // @ts-expect-error Should fail to transpile.
                    innerArr: null,
                },
            }, { merge: true });
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                nested: 3,
            }, { merge: true });
        });
        (0, mocha_1.it)('checks for nonexistent properties', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Top-level property.
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                nonexistent: 'foo',
            }, { merge: true });
            // Nested property
            await ref.set({
                nested: {
                    // @ts-expect-error Should fail to transpile.
                    nonexistent: 'foo',
                },
            }, { merge: true });
        });
        (0, mocha_1.it)('allows omitting fields', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Omit outer fields.
            await ref.set({
                outerString: '',
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
            // Omit inner fields
            await ref.set({
                outerString: '',
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
        });
    });
    (0, mocha_1.describe)('NestedPartial', () => {
        const testConverterMerge = {
            toFirestore(testObj, options) {
                if (options) {
                    (0, chai_1.expect)(testObj).to.not.be.an.instanceOf(TestObject);
                }
                else {
                    (0, chai_1.expect)(testObj).to.be.an.instanceOf(TestObject);
                }
                return { ...testObj };
            },
            fromFirestore(snapshot) {
                const data = snapshot.data();
                return new TestObject(data.outerString, data.outerArr, data.nested);
            },
        };
        (0, mocha_1.it)('supports FieldValues', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Allow Field Values in nested partials.
            await ref.set({
                outerString: src_1.FieldValue.delete(),
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
            // Allow setting FieldValue on entire object field.
            await ref.set({
                nested: src_1.FieldValue.delete(),
            }, { merge: true });
        });
        (0, mocha_1.it)('validates types in outer and inner fields', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Check top-level fields.
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                outerString: 3,
                // @ts-expect-error Should fail to transpile.
                outerArr: null,
            }, { merge: true });
            // Check nested fields.
            await ref.set({
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        innerNestedNum: 'string',
                    },
                    // @ts-expect-error Should fail to transpile.
                    innerArr: null,
                },
            }, { merge: true });
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                nested: 3,
            }, { merge: true });
        });
        (0, mocha_1.it)('checks for nonexistent properties', async () => {
            const ref = doc.withConverter(testConverterMerge);
            // Top-level property.
            await ref.set({
                // @ts-expect-error Should fail to transpile.
                nonexistent: 'foo',
            }, { merge: true });
            // Nested property
            await ref.set({
                nested: {
                    // @ts-expect-error Should fail to transpile.
                    nonexistent: 'foo',
                },
            }, { merge: true });
        });
    });
    (0, mocha_1.describe)('WithFieldValue', () => {
        (0, mocha_1.it)('supports FieldValues', async () => {
            const ref = doc.withConverter(testConverter);
            // Allow Field Values and nested partials.
            await ref.set({
                outerString: 'foo',
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('requires all outer fields to be present', async () => {
            const ref = doc.withConverter(testConverter);
            // @ts-expect-error Should fail to transpile.
            await ref.set({
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('requires all inner fields to be present', async () => {
            const ref = doc.withConverter(testConverter);
            await ref.set({
                outerString: '',
                outerArr: [],
                // @ts-expect-error Should fail to transpile.
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('validates inner and outer fields', async () => {
            const ref = doc.withConverter(testConverter);
            await ref.set({
                outerString: 'foo',
                // @ts-expect-error Should fail to transpile.
                outerArr: 2,
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        innerNestedNum: 'string',
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('checks for nonexistent properties', async () => {
            const ref = doc.withConverter(testConverter);
            // Top-level nonexistent fields should error
            await ref.set({
                outerString: 'foo',
                // @ts-expect-error Should fail to transpile.
                outerNum: 3,
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: 2,
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
            // Nested nonexistent fields should error
            await ref.set({
                outerString: 'foo',
                outerNum: 3,
                outerArr: [],
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        nonexistent: 'string',
                        innerNestedNum: 2,
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('allows certain types for not others', async () => {
            const withTryCatch = async (fn) => {
                try {
                    await fn();
                }
                catch (_a) {
                    // This is expected.
                }
            };
            // These tests exist to establish which object types are allowed to be
            // passed in by default when `T = DocumentData`. Some objects extend
            // the Javascript `{}`, which is why they're allowed whereas others
            // throw an error.
            // @ts-expect-error This should fail to transpile.
            await withTryCatch(() => doc.set(1));
            // @ts-expect-error This should fail to transpile.
            await withTryCatch(() => doc.set('foo'));
            // @ts-expect-error This should fail to transpile.
            await withTryCatch(() => doc.set(false));
            // @ts-expect-error This should fail to transpile.
            await withTryCatch(() => doc.set(undefined));
            // @ts-expect-error This should fail to transpile.
            await withTryCatch(() => doc.set(null));
            await withTryCatch(() => doc.set([0]));
            await withTryCatch(() => doc.set(new Set()));
            await withTryCatch(() => doc.set(new Map()));
        });
        (0, mocha_1.describe)('used as a type', () => {
            class ObjectWrapper {
                withFieldValueT(value) {
                    return value;
                }
                withPartialFieldValueT(value) {
                    return value;
                }
                // Wrapper to avoid having Firebase types in non-Firebase code.
                withT(value) {
                    this.withFieldValueT(value);
                }
                // Wrapper to avoid having Firebase types in non-Firebase code.
                withPartialT(value) {
                    this.withPartialFieldValueT(value);
                }
            }
            (0, mocha_1.it)('supports passing in the object as `T`', () => {
                const foo = new ObjectWrapper();
                foo.withFieldValueT({ id: '', foo: src_1.FieldValue.increment(1) });
                foo.withPartialFieldValueT({ foo: src_1.FieldValue.increment(1) });
                foo.withT({ id: '', foo: 1 });
                foo.withPartialT({ foo: 1 });
            });
            (0, mocha_1.it)('does not allow primitive types to use FieldValue', () => {
                const bar = new ObjectWrapper();
                // @ts-expect-error This should fail to transpile.
                bar.withFieldValueT(src_1.FieldValue.increment(1));
                // @ts-expect-error This should fail to transpile.
                bar.withPartialFieldValueT(src_1.FieldValue.increment(1));
            });
        });
    });
    (0, mocha_1.describe)('UpdateData', () => {
        (0, mocha_1.it)('supports FieldValues', async () => {
            const ref = doc.withConverter(testConverter);
            await ref.update({
                outerString: src_1.FieldValue.delete(),
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(2),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(3),
                },
            });
        });
        (0, mocha_1.it)('validates inner and outer fields', async () => {
            const ref = doc.withConverter(testConverter);
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                outerString: 3,
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        innerNestedNum: 'string',
                    },
                    // @ts-expect-error Should fail to transpile.
                    innerArr: 2,
                },
            });
        });
        (0, mocha_1.it)('supports string-separated fields', async () => {
            const ref = doc.withConverter(testConverter);
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                outerString: 3,
                // @ts-expect-error Should fail to transpile.
                'nested.innerNested.innerNestedNum': 'string',
                // @ts-expect-error Should fail to transpile.
                'nested.innerArr': 3,
                'nested.timestamp': src_1.FieldValue.serverTimestamp(),
            });
            // String comprehension works in nested fields.
            await ref.update({
                nested: {
                    innerNested: {
                        // @ts-expect-error Should fail to transpile.
                        innerNestedNum: 'string',
                    },
                    // @ts-expect-error Should fail to transpile.
                    innerArr: 3,
                },
            });
        });
        (0, mocha_1.it)('supports optional fields', async () => {
            const testConverterOptional = {
                toFirestore(testObj) {
                    return { ...testObj };
                },
                fromFirestore(snapshot) {
                    const data = snapshot.data();
                    return {
                        optionalStr: data.optionalStr,
                        nested: data.nested,
                    };
                },
            };
            const ref = doc.withConverter(testConverterOptional);
            await ref.update({
                optionalStr: 'foo',
            });
            await ref.update({
                optionalStr: 'foo',
            });
            await ref.update({
                nested: {
                    requiredStr: 'foo',
                },
            });
            await ref.update({
                'nested.requiredStr': 'foo',
            });
        });
        (0, mocha_1.it)('supports null fields', async () => {
            const testConverterOptional = {
                toFirestore(testObj) {
                    return { ...testObj };
                },
                fromFirestore(snapshot) {
                    const data = snapshot.data();
                    return {
                        optionalStr: data.optionalStr,
                        nested: data.nested,
                    };
                },
            };
            const ref = doc.withConverter(testConverterOptional);
            await ref.update({
                nested: {
                    strOrNull: null,
                },
            });
            await ref.update({
                'nested.strOrNull': null,
            });
        });
        (0, mocha_1.it)('supports union fields', async () => {
            const testConverterUnion = {
                toFirestore(testObj) {
                    return { ...testObj };
                },
                fromFirestore(snapshot) {
                    const data = snapshot.data();
                    return {
                        optionalStr: data.optionalStr,
                        nested: data.nested,
                    };
                },
            };
            const ref = doc.withConverter(testConverterUnion);
            await ref.update({
                nested: {
                    requiredStr: 'foo',
                },
            });
            await ref.update({
                'nested.requiredStr': 'foo',
            });
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                'nested.requiredStr': 1,
            });
            await ref.update({
                'nested.requiredNumber': 1,
            });
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                'nested.requiredNumber': 'foo',
            });
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                'nested.requiredNumber': null,
            });
        });
        (0, mocha_1.it)('checks for nonexistent fields', async () => {
            const ref = doc.withConverter(testConverter);
            // Top-level fields.
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                nonexistent: 'foo',
            });
            // Nested Fields.
            await ref.update({
                nested: {
                    // @ts-expect-error Should fail to transpile.
                    nonexistent: 'foo',
                },
            });
            // String fields.
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                nonexistent: 'foo',
            });
            await ref.update({
                // @ts-expect-error Should fail to transpile.
                'nested.nonexistent': 'foo',
            });
        });
    });
    (0, mocha_1.describe)('methods', () => {
        (0, mocha_1.it)('CollectionReference.add()', async () => {
            const ref = randomCol.withConverter(testConverter);
            // Requires all fields to be present
            // @ts-expect-error Should fail to transpile.
            await ref.add({
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: 2,
                    },
                    innerArr: [],
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('WriteBatch.set()', () => {
            const ref = doc.withConverter(testConverter);
            const batch = firestore.batch();
            // Requires full object if {merge: true} is not set.
            // @ts-expect-error Should fail to transpile.
            batch.set(ref, {
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
            batch.set(ref, {
                outerArr: [],
                nested: {
                    innerNested: {
                        innerNestedNum: src_1.FieldValue.increment(1),
                    },
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
        });
        (0, mocha_1.it)('WriteBatch.update()', () => {
            const ref = doc.withConverter(testConverter);
            const batch = firestore.batch();
            batch.update(ref, {
                outerArr: [],
                nested: {
                    'innerNested.innerNestedNum': src_1.FieldValue.increment(1),
                    innerArr: src_1.FieldValue.arrayUnion(2),
                    timestamp: src_1.FieldValue.serverTimestamp(),
                },
            });
        });
        (0, mocha_1.it)('Transaction.set()', async () => {
            const ref = doc.withConverter(testConverter);
            return firestore.runTransaction(async (tx) => {
                // Requires full object if {merge: true} is not set.
                // @ts-expect-error Should fail to transpile.
                tx.set(ref, {
                    outerArr: [],
                    nested: {
                        innerNested: {
                            innerNestedNum: src_1.FieldValue.increment(1),
                        },
                        innerArr: src_1.FieldValue.arrayUnion(2),
                        timestamp: src_1.FieldValue.serverTimestamp(),
                    },
                });
                tx.set(ref, {
                    outerArr: [],
                    nested: {
                        innerNested: {
                            innerNestedNum: src_1.FieldValue.increment(1),
                        },
                        innerArr: src_1.FieldValue.arrayUnion(2),
                        timestamp: src_1.FieldValue.serverTimestamp(),
                    },
                }, { merge: true });
            });
        });
        (0, mocha_1.it)('Transaction.update()', async () => {
            const ref = doc.withConverter(testConverter);
            return firestore.runTransaction(async (tx) => {
                tx.update(ref, {
                    outerArr: [],
                    nested: {
                        innerNested: {
                            innerNestedNum: src_1.FieldValue.increment(1),
                        },
                        innerArr: src_1.FieldValue.arrayUnion(2),
                        timestamp: src_1.FieldValue.serverTimestamp(),
                    },
                });
            });
        });
    });
});
//# sourceMappingURL=firestore.js.map
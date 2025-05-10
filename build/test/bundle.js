"use strict";
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_BUNDLE_ID = void 0;
exports.verifyMetadata = verifyMetadata;
const chai_1 = require("chai");
const extend = require("extend");
const mocha_1 = require("mocha");
const src_1 = require("../src");
const helpers_1 = require("./util/helpers");
exports.TEST_BUNDLE_ID = 'test-bundle';
const TEST_BUNDLE_VERSION = 1;
function verifyMetadata(meta, createTime, totalDocuments, expectEmptyContent = false) {
    if (!expectEmptyContent) {
        (0, chai_1.expect)(parseInt(meta.totalBytes.toString())).greaterThan(0);
    }
    else {
        (0, chai_1.expect)(parseInt(meta.totalBytes.toString())).to.equal(0);
    }
    (0, chai_1.expect)(meta.id).to.equal(exports.TEST_BUNDLE_ID);
    (0, chai_1.expect)(meta.version).to.equal(TEST_BUNDLE_VERSION);
    (0, chai_1.expect)(meta.totalDocuments).to.equal(totalDocuments);
    (0, chai_1.expect)(meta.createTime).to.deep.equal(createTime);
}
(0, mocha_1.describe)('Bundle Builder', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    // Tests the testing helper function bundleToElementArray works as expected.
    (0, mocha_1.it)('succeeds to read length prefixed json with testing function', async () => {
        const bundleString = '20{"a":"string value"}9{"b":123}26{"c":{"d":"nested value"}}';
        const elements = await (0, helpers_1.bundleToElementArray)(Buffer.from(bundleString));
        (0, chai_1.expect)(elements).to.deep.equal([
            { a: 'string value' },
            { b: 123 },
            { c: { d: 'nested value' } },
        ]);
    });
    (0, mocha_1.it)('succeeds with document snapshots', async () => {
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        const snap1 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc1`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, 
        // This should be the bundle read time.
        '2020-01-01T00:00:05.000000006Z', 'json');
        // Same document but older read time.
        const snap2 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc1`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '-42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, '1970-01-01T00:00:05.000000006Z', 'json');
        bundle.add(snap1);
        bundle.add(snap2);
        // Bundle is expected to be [bundleMeta, snap2Meta, snap2] because `snap1` is newer.
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(3);
        const meta = elements[0].metadata;
        verifyMetadata(meta, 
        // `snap1.readTime` is the bundle createTime, because it is larger than `snap2.readTime`.
        snap1.readTime.toProto().timestampValue, 1);
        // Verify doc1Meta and doc1Snap
        const docMeta = elements[1].documentMetadata;
        const docSnap = elements[2].document;
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: snap1.toDocumentProto().name,
            readTime: snap1.readTime.toProto().timestampValue,
            exists: true,
        });
        (0, chai_1.expect)(docSnap).to.deep.equal(snap1.toDocumentProto());
    });
    (0, mocha_1.it)('succeeds with query snapshots', async () => {
        var _a;
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        const snap = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc1`,
            fields: { foo: { stringValue: 'value' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, 
        // This should be the bundle read time.
        '2020-01-01T00:00:05.000000006Z', 'json');
        const query = firestore
            .collection('collectionId')
            .where('value', '==', 'string');
        const querySnapshot = new src_1.QuerySnapshot(query, snap.readTime, 1, () => [snap], () => []);
        const newQuery = firestore.collection('collectionId');
        const newQuerySnapshot = new src_1.QuerySnapshot(newQuery, snap.readTime, 1, () => [snap], () => []);
        bundle.add('test-query', querySnapshot);
        bundle.add('test-query-new', newQuerySnapshot);
        // Bundle is expected to be [bundleMeta, namedQuery, newNamedQuery, snapMeta, snap]
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(5);
        const meta = elements[0].metadata;
        verifyMetadata(meta, 
        // `snap.readTime` is the bundle createTime, because it is larger than `snap2.readTime`.
        snap.readTime.toProto().timestampValue, 1);
        // Verify named query
        const namedQuery = elements.find(e => { var _a; return ((_a = e.namedQuery) === null || _a === void 0 ? void 0 : _a.name) === 'test-query'; }).namedQuery;
        const newNamedQuery = elements.find(e => { var _a; return ((_a = e.namedQuery) === null || _a === void 0 ? void 0 : _a.name) === 'test-query-new'; }).namedQuery;
        (0, chai_1.expect)(namedQuery).to.deep.equal({
            name: 'test-query',
            readTime: snap.readTime.toProto().timestampValue,
            bundledQuery: extend(true, {}, {
                parent: query.toProto().parent,
                structuredQuery: query.toProto().structuredQuery,
            }),
        });
        (0, chai_1.expect)(newNamedQuery).to.deep.equal({
            name: 'test-query-new',
            readTime: snap.readTime.toProto().timestampValue,
            bundledQuery: extend(true, {}, {
                parent: newQuery.toProto().parent,
                structuredQuery: newQuery.toProto().structuredQuery,
            }),
        });
        // Verify docMeta and docSnap
        const docMeta = elements[3].documentMetadata;
        const docSnap = elements[4].document;
        (_a = docMeta === null || docMeta === void 0 ? void 0 : docMeta.queries) === null || _a === void 0 ? void 0 : _a.sort();
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: snap.toDocumentProto().name,
            readTime: snap.readTime.toProto().timestampValue,
            exists: true,
            queries: ['test-query', 'test-query-new'],
        });
        (0, chai_1.expect)(docSnap).to.deep.equal(snap.toDocumentProto());
    });
    (0, mocha_1.it)('succeeds with multiple calls to build()', async () => {
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        const snap1 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc1`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, 
        // This should be the bundle read time.
        '2020-01-01T00:00:05.000000006Z', 'json');
        bundle.add(snap1);
        // Bundle is expected to be [bundleMeta, doc1Meta, doc1Snap].
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(3);
        const meta = elements[0].metadata;
        verifyMetadata(meta, 
        // `snap1.readTime` is the bundle createTime, because it is larger than `snap2.readTime`.
        snap1.readTime.toProto().timestampValue, 1);
        // Verify doc1Meta and doc1Snap
        const doc1Meta = elements[1].documentMetadata;
        const doc1Snap = elements[2].document;
        (0, chai_1.expect)(doc1Meta).to.deep.equal({
            name: snap1.toDocumentProto().name,
            readTime: snap1.readTime.toProto().timestampValue,
            exists: true,
        });
        (0, chai_1.expect)(doc1Snap).to.deep.equal(snap1.toDocumentProto());
        // Add another document
        const snap2 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc2`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '-42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, '1970-01-01T00:00:05.000000006Z', 'json');
        bundle.add(snap2);
        // Bundle is expected to be [bundleMeta, doc1Meta, doc1Snap, doc2Meta, doc2Snap].
        const newElements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(newElements.length).to.equal(5);
        const newMeta = newElements[0].metadata;
        verifyMetadata(newMeta, 
        // `snap1.readTime` is the bundle createTime, because it is larger than `snap2.readTime`.
        snap1.readTime.toProto().timestampValue, 2);
        (0, chai_1.expect)(newElements.slice(1, 3)).to.deep.equal(elements.slice(1));
        // Verify doc2Meta and doc2Snap
        const doc2Meta = newElements[3].documentMetadata;
        const doc2Snap = newElements[4].document;
        (0, chai_1.expect)(doc2Meta).to.deep.equal({
            name: snap2.toDocumentProto().name,
            readTime: snap2.readTime.toProto().timestampValue,
            exists: true,
        });
        (0, chai_1.expect)(doc2Snap).to.deep.equal(snap2.toDocumentProto());
    });
    (0, mocha_1.it)('succeeds when nothing is added', async () => {
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        // `elements` is expected to be [bundleMeta].
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(1);
        const meta = elements[0].metadata;
        verifyMetadata(meta, new src_1.Timestamp(0, 0).toProto().timestampValue, 0, true);
    });
    (0, mocha_1.it)('handles identical document id from different collections', async () => {
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        const snap1 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId_A/doc1`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, 
        // This should be the bundle read time.
        '2020-01-01T00:00:05.000000006Z', 'json');
        // Same document id but different collection
        const snap2 = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId_B/doc1`,
            fields: { foo: { stringValue: 'value' }, bar: { integerValue: '-42' } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, '1970-01-01T00:00:05.000000006Z', 'json');
        bundle.add(snap1);
        bundle.add(snap2);
        // Bundle is expected to be [bundleMeta, snap1Meta, snap1, snap2Meta, snap2] because `snap1` is newer.
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        (0, chai_1.expect)(elements.length).to.equal(5);
        const meta = elements[0].metadata;
        verifyMetadata(meta, 
        // `snap1.readTime` is the bundle createTime, because it is larger than `snap2.readTime`.
        snap1.readTime.toProto().timestampValue, 2);
        // Verify doc1Meta and doc1Snap
        let docMeta = elements[1].documentMetadata;
        let docSnap = elements[2].document;
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: snap1.toDocumentProto().name,
            readTime: snap1.readTime.toProto().timestampValue,
            exists: true,
        });
        (0, chai_1.expect)(docSnap).to.deep.equal(snap1.toDocumentProto());
        // Verify doc2Meta and doc2Snap
        docMeta = elements[3].documentMetadata;
        docSnap = elements[4].document;
        (0, chai_1.expect)(docMeta).to.deep.equal({
            name: snap2.toDocumentProto().name,
            readTime: snap2.readTime.toProto().timestampValue,
            exists: true,
        });
        (0, chai_1.expect)(docSnap).to.deep.equal(snap2.toDocumentProto());
    });
});
(0, mocha_1.describe)('Bundle Builder using BigInt', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)(undefined, { useBigInt: true }).then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.it)('succeeds with document snapshots with BigInt field', async () => {
        var _a;
        const bundle = firestore.bundle(exports.TEST_BUNDLE_ID);
        const bigIntValue = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(Number.MAX_SAFE_INTEGER);
        const snap = firestore.snapshot_({
            name: `${helpers_1.DATABASE_ROOT}/documents/collectionId/doc1`,
            fields: { foo: { integerValue: bigIntValue.toString() } },
            createTime: '1970-01-01T00:00:01.002Z',
            updateTime: '1970-01-01T00:00:03.000004Z',
        }, 
        // This should be the bundle read time.
        '2020-01-01T00:00:05.000000006Z', 'json');
        bundle.add(snap);
        // Bundle is expected to be [bundleMeta, snapMeta, snap]
        const elements = await (0, helpers_1.bundleToElementArray)(bundle.build());
        // The point is to make sure BigInt gets encoded correctly into a string without losing
        // precision.
        (0, chai_1.expect)((_a = elements[2].document) === null || _a === void 0 ? void 0 : _a.fields).to.deep.equal({
            foo: { integerValue: bigIntValue.toString() },
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
});
//# sourceMappingURL=bundle.js.map
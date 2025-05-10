"use strict";
/*!
 * Copyright 2024 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexTestHelper = exports.INDEX_TEST_COLLECTION = void 0;
const src_1 = require("../src");
const util_1 = require("../src/util");
exports.INDEX_TEST_COLLECTION = 'index-test-collection';
/**
 * This helper class is designed to facilitate integration testing of Firestore queries that
 * require manually created indexes within a controlled testing environment.
 *
 * <p>Key Features:
 *
 * <ul>
 *   <li>Runs tests against the dedicated test collection with predefined indexes.
 *   <li>Automatically associates a test ID with documents for data isolation.
 *   <li>Utilizes TTL policy for automatic test data cleanup.
 *   <li>Constructs Firestore queries with test ID filters.
 * </ul>
 */
class IndexTestHelper {
    // Creates a new instance of the CompositeIndexTestHelper class, with a unique test
    // identifier for data isolation.
    constructor(db) {
        this.db = db;
        this.TEST_ID_FIELD = 'testId';
        this.TTL_FIELD = 'expireAt';
        this.testId = 'test-id-' + (0, util_1.autoId)();
    }
    // Runs a test with specified documents in the INDEX_TEST_COLLECTION.
    async setTestDocs(docs) {
        const testDocs = this.prepareTestDocuments(docs);
        const collectionRef = this.db.collection(exports.INDEX_TEST_COLLECTION);
        for (const id in testDocs) {
            const ref = collectionRef.doc(id);
            await ref.set(testDocs[id]);
        }
        return collectionRef;
    }
    // Runs a test with specified documents in the INDEX_TEST_COLLECTION.
    async createTestDocs(docs) {
        // convert docsArray without IDs to a map with IDs
        const docsMap = docs.reduce((result, doc) => {
            result[(0, util_1.autoId)()] = doc;
            return result;
        }, {});
        return this.setTestDocs(docsMap);
    }
    // Runs a test on INDEX_TEST_COLLECTION.
    async withTestCollection() {
        const collectionRef = this.db.collection(exports.INDEX_TEST_COLLECTION);
        return collectionRef;
    }
    // Hash the document key with testId.
    toHashedId(docId) {
        return docId + '-' + this.testId;
    }
    toHashedIds(docs) {
        return docs.map(docId => this.toHashedId(docId));
    }
    // Adds test-specific fields to a document, including the testId and expiration date.
    addTestSpecificFieldsToDoc(doc) {
        return {
            ...doc,
            [this.TEST_ID_FIELD]: this.testId,
            [this.TTL_FIELD]: new src_1.Timestamp(// Expire test data after 24 hours
            src_1.Timestamp.now().seconds + 24 * 60 * 60, src_1.Timestamp.now().nanoseconds),
        };
    }
    // Remove test-specific fields from a document, including the testId and expiration date.
    removeTestSpecificFieldsFromDoc(doc) {
        var _a, _b, _c, _d;
        (_b = (_a = doc._document) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.delete(new src_1.FieldPath(this.TEST_ID_FIELD));
        (_d = (_c = doc._document) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.delete(new src_1.FieldPath(this.TTL_FIELD));
    }
    // Helper method to hash document keys and add test-specific fields for the provided documents.
    prepareTestDocuments(docs) {
        const result = {};
        for (const key in docs) {
            // eslint-disable-next-line no-prototype-builtins
            if (docs.hasOwnProperty(key)) {
                result[this.toHashedId(key)] = this.addTestSpecificFieldsToDoc(docs[key]);
            }
        }
        return result;
    }
    // Adds a filter on test id for a query.
    query(query_, ...filters) {
        return filters.reduce((query, filter) => {
            return query.where(filter);
        }, query_.where(this.TEST_ID_FIELD, '==', this.testId));
    }
    // Get document reference from a document key.
    getDocRef(coll, docId) {
        if (!docId.includes('test-id-')) {
            docId = this.toHashedId(docId);
        }
        return coll.doc(docId);
    }
    // Adds a document to a Firestore collection with test-specific fields.
    addDoc(reference, data) {
        const processedData = this.addTestSpecificFieldsToDoc(data);
        return reference.add(processedData);
    }
    // Sets a document in Firestore with test-specific fields.
    async setDoc(reference, data) {
        const processedData = this.addTestSpecificFieldsToDoc(data);
        await reference.set(processedData);
    }
    async updateDoc(reference, data) {
        await reference.update(data);
    }
    async deleteDoc(reference) {
        await reference.delete();
    }
    // Retrieves a single document from Firestore with test-specific fields removed.
    async getDoc(docRef) {
        const docSnapshot = await docRef.get();
        this.removeTestSpecificFieldsFromDoc(docSnapshot);
        return docSnapshot;
    }
    // Retrieves multiple documents from Firestore with test-specific fields removed.
    async getDocs(query_) {
        const querySnapshot = await this.query(query_).get();
        querySnapshot.forEach(doc => {
            this.removeTestSpecificFieldsFromDoc(doc);
        });
        return querySnapshot;
    }
}
exports.IndexTestHelper = IndexTestHelper;
//# sourceMappingURL=index_test_helper.js.map
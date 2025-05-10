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
import { CollectionReference, DocumentReference, DocumentSnapshot, Filter, Firestore, Query } from '../src';
import { DocumentData, QuerySnapshot, UpdateData } from '@google-cloud/firestore';
export declare const INDEX_TEST_COLLECTION = "index-test-collection";
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
export declare class IndexTestHelper {
    readonly db: Firestore;
    private readonly testId;
    private readonly TEST_ID_FIELD;
    private readonly TTL_FIELD;
    constructor(db: Firestore);
    setTestDocs(docs: {
        [key: string]: DocumentData;
    }): Promise<CollectionReference>;
    createTestDocs(docs: DocumentData[]): Promise<CollectionReference>;
    withTestCollection(): Promise<CollectionReference>;
    private toHashedId;
    private toHashedIds;
    addTestSpecificFieldsToDoc(doc: DocumentData): DocumentData;
    private removeTestSpecificFieldsFromDoc;
    private prepareTestDocuments;
    query<T>(query_: Query<T>, ...filters: Filter[]): Query<T>;
    getDocRef<T>(coll: CollectionReference<T>, docId: string): DocumentReference<T>;
    addDoc<T>(reference: CollectionReference<T>, data: object): Promise<DocumentReference<T>>;
    setDoc<T>(reference: DocumentReference<T>, data: object): Promise<void>;
    updateDoc<T, DbModelType extends DocumentData>(reference: DocumentReference<T, DbModelType>, data: UpdateData<DbModelType>): Promise<void>;
    deleteDoc<T>(reference: DocumentReference<T>): Promise<void>;
    getDoc<T>(docRef: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
    getDocs<T>(query_: Query<T>): Promise<QuerySnapshot<T>>;
}

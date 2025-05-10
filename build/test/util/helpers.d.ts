import { DocumentData, Settings, SetOptions, PartialWithFieldValue } from '@google-cloud/firestore';
import { Duplex } from 'stream';
import { firestore } from '../../protos/firestore_v1_proto_api';
import * as proto from '../../protos/firestore_v1_proto_api';
import { Firestore, QueryDocumentSnapshot } from '../../src';
import { GapicClient } from '../../src/types';
import api = proto.google.firestore.v1;
export declare const PROJECT_ID = "test-project";
export declare const DATABASE_ROOT = "projects/test-project/databases/(default)";
export declare const COLLECTION_ROOT = "projects/test-project/databases/(default)/documents/collectionId";
export declare const DOCUMENT_NAME = "projects/test-project/databases/(default)/documents/collectionId/documentId";
export type InvalidApiUsage = any;
/** Defines the request handlers used by Firestore. */
export type ApiOverride = Partial<GapicClient>;
/**
 * Creates a new Firestore instance for testing. Request handlers can be
 * overridden by providing `apiOverrides`.
 *
 * @param apiOverrides An object with request handlers to override.
 * @param firestoreSettings Firestore Settings to configure the client.
 * @return A Promise that resolves with the new Firestore client.
 */
export declare function createInstance(apiOverrides?: ApiOverride, firestoreSettings?: Settings): Promise<Firestore>;
/**
 * Verifies that all streams have been properly shutdown at the end of a test
 * run.
 */
export declare function verifyInstance(firestore: Firestore): Promise<void>;
export declare function updateMask(...fieldPaths: string[]): api.IDocumentMask;
export declare function set(opts: {
    document: api.IDocument;
    transforms?: api.DocumentTransform.IFieldTransform[];
    mask?: api.IDocumentMask;
}): api.ICommitRequest;
export declare function update(opts: {
    document: api.IDocument;
    transforms?: api.DocumentTransform.IFieldTransform[];
    mask?: api.IDocumentMask;
    precondition?: api.IPrecondition;
}): api.ICommitRequest;
export declare function create(opts: {
    document: api.IDocument;
    transforms?: api.DocumentTransform.IFieldTransform[];
    mask?: api.IDocumentMask;
}): api.ICommitRequest;
export declare function retrieve(id: string): api.IBatchGetDocumentsRequest;
export declare function remove(id: string, precondition?: api.IPrecondition): api.ICommitRequest;
export declare function found(dataOrId: api.IDocument | string): api.IBatchGetDocumentsResponse;
export declare function missing(id: string): api.IBatchGetDocumentsResponse;
export declare function document(id: string, field?: string, value?: string | api.IValue, ...fieldOrValues: Array<string | api.IValue>): api.IDocument;
export declare function serverTimestamp(field: string): api.DocumentTransform.IFieldTransform;
export declare function incrementTransform(field: string, n: number): api.DocumentTransform.IFieldTransform;
export declare function arrayTransform(field: string, transform: 'appendMissingElements' | 'removeAllFromArray', ...values: Array<string | api.IValue>): api.DocumentTransform.IFieldTransform;
export declare function writeResult(count: number): api.IWriteResponse;
export declare function requestEquals(actual: object | undefined, expected: object): void;
export declare function stream<T>(...elements: Array<T | Error>): Duplex;
/**
 * Query streams with no results always at least emit a read time.
 */
export declare function emptyQueryStream(readTime?: {
    seconds: number;
    nanos: number;
}): Duplex;
export declare function streamWithoutEnd<T>(...elements: Array<T | Error>): Duplex;
/** Creates a response as formatted by the GAPIC request methods.  */
export declare function response<T>(result: T): Promise<[T, unknown, unknown]>;
/** Sample user object class used in tests. */
export declare class Post {
    readonly title: string;
    readonly author: string;
    constructor(title: string, author: string);
    toString(): string;
}
/** Converts Post objects to and from Firestore in tests. */
export declare const postConverter: {
    toFirestore(post: Post): DocumentData;
    fromFirestore(snapshot: QueryDocumentSnapshot): Post;
};
export declare const postConverterMerge: {
    toFirestore(post: PartialWithFieldValue<Post>, options?: SetOptions): DocumentData;
    fromFirestore(snapshot: QueryDocumentSnapshot): Post;
};
export declare function bundleToElementArray(bundle: Buffer): Promise<Array<firestore.IBundleElement>>;
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
export declare function collect<T, TReturn, TNext>(iterator: AsyncIterator<T, TReturn, TNext>): Promise<Array<T>>;
/**
 * Returns a value indicating whether preferRest is enabled
 * via the environment variable `FIRESTORE_PREFER_REST`.
 *
 * @return `true` if preferRest is enabled via the environment variable `FIRESTORE_PREFER_REST`.
 */
export declare function isPreferRest(): boolean;

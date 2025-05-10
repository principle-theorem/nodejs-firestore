import { firestore, google } from '../protos/firestore_v1_proto_api';
import IBundleMetadata = firestore.IBundleMetadata;
import ITimestamp = google.protobuf.ITimestamp;
export declare const TEST_BUNDLE_ID = "test-bundle";
export declare function verifyMetadata(meta: IBundleMetadata, createTime: ITimestamp, totalDocuments: number, expectEmptyContent?: boolean): void;

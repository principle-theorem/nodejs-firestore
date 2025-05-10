import { google } from '../protos/firestore_v1_proto_api';
import api = google.firestore.v1;
export declare function partitionQueryEquals(actual: api.IPartitionQueryRequest | undefined, partitionCount: number): void;

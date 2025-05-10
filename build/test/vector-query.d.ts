import { google } from '../protos/firestore_v1_proto_api';
import api = google.firestore.v1;
export declare function findNearestQuery(fieldPath: string, queryVector: Array<number>, limit: number, measure: api.StructuredQuery.FindNearest.DistanceMeasure): api.IStructuredQuery;

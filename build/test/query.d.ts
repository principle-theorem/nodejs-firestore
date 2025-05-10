import { google } from '../protos/firestore_v1_proto_api';
import api = google.firestore.v1;
import protobuf = google.protobuf;
export declare function fieldFiltersQuery(fieldPath: string, op: api.StructuredQuery.FieldFilter.Operator, value: string | api.IValue, ...fieldPathOpAndValues: Array<string | api.StructuredQuery.FieldFilter.Operator | string | api.IValue>): api.IStructuredQuery;
export declare function fieldFilters(fieldPath: string, op: api.StructuredQuery.FieldFilter.Operator, value: string | api.IValue, ...fieldPathOpAndValues: Array<string | api.StructuredQuery.FieldFilter.Operator | string | api.IValue>): api.StructuredQuery.IFilter;
export declare function fieldFilter(fieldPath: string, op: api.StructuredQuery.FieldFilter.Operator, value: string | api.IValue): api.StructuredQuery.IFilter;
export declare function compositeFilter(op: api.StructuredQuery.CompositeFilter.Operator, ...filters: api.StructuredQuery.IFilter[]): api.StructuredQuery.IFilter;
export declare function orFilter(op: api.StructuredQuery.CompositeFilter.Operator, ...filters: api.StructuredQuery.IFilter[]): api.StructuredQuery.IFilter;
export declare function andFilter(op: api.StructuredQuery.CompositeFilter.Operator, ...filters: api.StructuredQuery.IFilter[]): api.StructuredQuery.IFilter;
export declare function orderBy(fieldPath: string, direction: api.StructuredQuery.Direction, ...fieldPathAndOrderBys: Array<string | api.StructuredQuery.Direction>): api.IStructuredQuery;
export declare function limit(n: number): api.IStructuredQuery;
export declare function allDescendants(kindless?: boolean): api.IStructuredQuery;
export declare function select(...fields: string[]): api.IStructuredQuery;
export declare function startAt(before: boolean, ...values: Array<string | api.IValue>): api.IStructuredQuery;
/**
 * Returns the timestamp value for the provided readTimes, or the default
 * readTime value used in tests if no values are provided.
 */
export declare function readTime(seconds?: number, nanos?: number): protobuf.ITimestamp;
export declare function queryEqualsWithParent(actual: api.IRunQueryRequest | undefined, parent: string, ...protoComponents: api.IStructuredQuery[]): void;
export declare function queryEquals(actual: api.IRunQueryRequest | undefined, ...protoComponents: api.IStructuredQuery[]): void;
export declare function result(documentId: string, setDone?: boolean): api.IRunQueryResponse;
export declare function heartbeat(count: number): api.IRunQueryResponse;

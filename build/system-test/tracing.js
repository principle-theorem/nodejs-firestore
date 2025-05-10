"use strict";
// Copyright 2024 Google LLC
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
const chaiAsPromised = require("chai-as-promised");
const chai_1 = require("chai");
const mocha_1 = require("mocha");
const api_1 = require("@opentelemetry/api");
const opentelemetry_cloud_trace_exporter_1 = require("@google-cloud/opentelemetry-cloud-trace-exporter");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const src_1 = require("../src");
const helpers_1 = require("../test/util/helpers");
const trace_util_1 = require("../src/telemetry/trace-util");
const context_async_hooks_1 = require("@opentelemetry/context-async-hooks");
const cloudtrace_1 = require("@googleapis/cloudtrace");
const logger_1 = require("../src/logger");
(0, chai_1.use)(chaiAsPromised);
const NUM_TRACE_ID_BYTES = 32;
const NUM_SPAN_ID_BYTES = 16;
const SPAN_NAME_TEST_ROOT = 'TestRootSpan';
const GET_TRACE_INITIAL_WAIT_MILLIS = 2000;
const GET_TRACE_RETRY_BACKOFF_MILLIS = 2000;
const GET_TRACE_MAX_RETRY_COUNT = 10;
const E2E_TEST_SUITE_TITLE = 'E2E';
const IN_MEMORY_TEST_SUITE_TITLE = 'IN-MEMORY';
const GLOBAL_OTEL_TEST_SUITE_TITLE = 'GLOBAL-OTEL';
const NON_GLOBAL_OTEL_TEST_SUITE_TITLE = 'NON-GLOBAL-OTEL';
const GRPC_TEST_SUITE_TITLE = 'GRPC';
const REST_TEST_SUITE_TITLE = 'REST';
// Enable OpenTelemetry debug message for local debugging.
api_1.diag.setLogger(new api_1.DiagConsoleLogger(), api_1.DiagLogLevel.DEBUG);
// Enable Firestore debug messages for local debugging.
(0, src_1.setLogFunction)((msg) => {
    console.log(`LOG: ${msg}`);
});
// Unfortunately the in-memory spans and Cloud Trace spans do not share the
// same data-structures. This interface is useful to abstract that away for
// testing.
// Also note that Cloud Trace currently does NOT return span attributes nor
// span events. So we'll have to leave those as empty and not check them for
// end-to-end tests.
class SpanData {
    constructor(id, parentId, traceId, name, attributes, events) {
        this.id = id;
        this.parentId = parentId;
        this.traceId = traceId;
        this.name = name;
        this.attributes = attributes;
        this.events = events;
    }
    static fromInMemorySpan(span) {
        return new SpanData(span.spanContext().spanId, span.parentSpanId, span.spanContext().traceId, span.name, span.attributes, span.events);
    }
    static fromCloudTraceSpan(span, traceId) {
        return new SpanData(span.spanId, span.parentSpanId, traceId, span.name, {}, []);
    }
}
(0, mocha_1.describe)('Tracing Tests', () => {
    let firestore;
    let tracerProvider;
    let inMemorySpanExporter;
    let consoleSpanExporter;
    let gcpTraceExporter;
    let tracer;
    let cloudTraceInfo;
    let testConfig;
    // Custom SpanContext for each test, required for trace ID injection.
    let customSpanContext;
    // Custom Context for each test, required for trace ID injection.
    let customContext;
    const spanIdToChildrenSpanIds = new Map();
    const spanIdToSpanData = new Map();
    let rootSpanIds = [];
    function afterEachTest() {
        spanIdToChildrenSpanIds.clear();
        spanIdToSpanData.clear();
        rootSpanIds = [];
        return (0, helpers_1.verifyInstance)(firestore);
    }
    function getOpenTelemetryOptions(tracerProvider) {
        const options = {
            tracerProvider: undefined,
        };
        // If we are *not* using a global OpenTelemetry instance, a TracerProvider
        // must be passed to the Firestore SDK.
        if (!testConfig.useGlobalOpenTelemetry) {
            options.tracerProvider = tracerProvider;
        }
        return options;
    }
    function generateRandomHexString(length) {
        if (length <= 0) {
            throw new Error('Length must be a positive integer');
        }
        const hexCharacters = '0123456789abcdef';
        let hexString = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * hexCharacters.length);
            hexString += hexCharacters[randomIndex];
        }
        return hexString;
    }
    function getNewSpanContext() {
        const spanContext = {
            traceId: generateRandomHexString(NUM_TRACE_ID_BYTES),
            spanId: generateRandomHexString(NUM_SPAN_ID_BYTES),
            traceFlags: api_1.TraceFlags.SAMPLED,
        };
        (0, logger_1.logger)('getNewSpanContext', null, `custom span context:${spanContext}`);
        return spanContext;
    }
    function beforeEachTest(test) {
        var _a, _b, _c, _d, _e, _f;
        testConfig = {
            preferRest: ((_a = test.parent) === null || _a === void 0 ? void 0 : _a.title) === REST_TEST_SUITE_TITLE,
            useGlobalOpenTelemetry: ((_c = (_b = test.parent) === null || _b === void 0 ? void 0 : _b.parent) === null || _c === void 0 ? void 0 : _c.title) === GLOBAL_OTEL_TEST_SUITE_TITLE,
            e2e: ((_f = (_e = (_d = test.parent) === null || _d === void 0 ? void 0 : _d.parent) === null || _e === void 0 ? void 0 : _e.parent) === null || _f === void 0 ? void 0 : _f.title) === E2E_TEST_SUITE_TITLE,
        };
        (0, logger_1.logger)('beforeEach', null, 'Starting test with config:', testConfig);
        // Remove the global tracer provider in case anything was registered
        // in order to avoid duplicate global tracers.
        api_1.trace.disable();
        api_1.context.disable();
        // Set up a context manager.
        const contextManager = new context_async_hooks_1.AsyncLocalStorageContextManager();
        contextManager.enable();
        api_1.context.setGlobalContextManager(contextManager);
        // Create a new tracer and span processor for each test to make sure there
        // are no overlaps when reading the results.
        tracerProvider = new sdk_trace_node_1.NodeTracerProvider({
            sampler: new sdk_trace_node_1.AlwaysOnSampler(),
        });
        inMemorySpanExporter = new sdk_trace_node_1.InMemorySpanExporter();
        consoleSpanExporter = new sdk_trace_node_1.ConsoleSpanExporter();
        gcpTraceExporter = new opentelemetry_cloud_trace_exporter_1.TraceExporter();
        // Always add the console exporter for local debugging.
        tracerProvider.addSpanProcessor(new sdk_trace_node_1.BatchSpanProcessor(consoleSpanExporter));
        if (testConfig.e2e) {
            tracerProvider.addSpanProcessor(new sdk_trace_node_1.BatchSpanProcessor(gcpTraceExporter));
        }
        else {
            tracerProvider.addSpanProcessor(new sdk_trace_node_1.BatchSpanProcessor(inMemorySpanExporter));
        }
        if (testConfig.useGlobalOpenTelemetry) {
            api_1.trace.setGlobalTracerProvider(tracerProvider);
        }
        // Using a unique tracer name for each test.
        tracer = tracerProvider.getTracer(`${test.title}${Date.now()}`);
        customSpanContext = getNewSpanContext();
        customContext = api_1.trace.setSpanContext(api_1.ROOT_CONTEXT, customSpanContext);
        const settings = {
            preferRest: testConfig.preferRest,
            openTelemetry: getOpenTelemetryOptions(tracerProvider),
        };
        // Named-database tests use an environment variable to specify the database ID. Add it to the settings.
        if (process.env.FIRESTORE_NAMED_DATABASE) {
            settings.databaseId = process.env.FIRESTORE_NAMED_DATABASE;
        }
        // If a database ID has not been specified in the settings, check whether
        // it's been specified using an environment variable.
        if (!settings.databaseId && process.env.DATABASE_ID) {
            settings.databaseId = process.env.DATABASE_ID;
        }
        // If a Project ID has not been specified in the settings, check whether
        // it's been specified using an environment variable.
        if (!settings.projectId && process.env.PROJECT_ID) {
            settings.projectId = process.env.PROJECT_ID;
        }
        firestore = new src_1.Firestore(settings);
    }
    function getSettingsAttributes() {
        const settingsAttributes = {};
        settingsAttributes['otel.scope.name'] = require('../../package.json').name;
        settingsAttributes['otel.scope.version'] =
            require('../../package.json').version;
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.database_id`] =
            firestore.databaseId;
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.host`] =
            'firestore.googleapis.com:443';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.prefer_REST`] =
            testConfig.preferRest;
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.max_idle_channels`] = 1;
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.initial_retry_delay`] =
            '0.1s';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.initial_rpc_timeout`] =
            '60s';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.total_timeout`] = '600s';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.max_retry_delay`] = '60s';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.max_rpc_timeout`] = '60s';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.retry_delay_multiplier`] =
            '1.3';
        settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.rpc_timeout_multiplier`] =
            '1';
        // Project ID is not set on the Firestore object until _after_ the first
        // operation is done. Therefore, the spans that are created _before_ the
        // first operation do not contain a project ID.
        try {
            const projectId = firestore.projectId;
            settingsAttributes[`${trace_util_1.ATTRIBUTE_SETTINGS_PREFIX}.project_id`] = projectId;
        }
        catch (e) {
            // Project ID has not been set yet.
        }
        return settingsAttributes;
    }
    // Take a function and runs it inside a new root span. This makes it possible to
    // encapsulate all the SDK-generated spans inside a test root span. It also makes
    // it easy to query a trace storage backend for a known trace ID and span Id.
    function runFirestoreOperationInRootSpan(fn) {
        return tracer.startActiveSpan(SPAN_NAME_TEST_ROOT, {}, customContext, async (span) => {
            await fn();
            span.end();
        });
    }
    // Returns true on success, and false otherwise.
    async function waitForCompletedInMemorySpans() {
        await tracerProvider.forceFlush();
        await inMemorySpanExporter.forceFlush();
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    }
    // Returns true on success, and false otherwise.
    async function waitForCompletedCloudTraceSpans(numExpectedSpans) {
        var _a, _b;
        const auth = new cloudtrace_1.auth.GoogleAuth({
            projectId: firestore.projectId,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        const client = new cloudtrace_1.cloudtrace_v1.Cloudtrace({ auth });
        const projectTraces = new cloudtrace_1.cloudtrace_v1.Resource$Projects$Traces(client.context);
        // Querying the trace from Cloud Trace immediately is almost always going
        // to fail. So we have an initial delay before making our first attempt.
        await new Promise(resolve => setTimeout(resolve, GET_TRACE_INITIAL_WAIT_MILLIS));
        let remainingAttempts = GET_TRACE_MAX_RETRY_COUNT;
        let receivedFullTrace = false;
        do {
            try {
                const getTraceResponse = await projectTraces.get({
                    projectId: firestore.projectId,
                    traceId: customSpanContext.traceId,
                });
                cloudTraceInfo = getTraceResponse.data;
                receivedFullTrace = ((_a = cloudTraceInfo.spans) === null || _a === void 0 ? void 0 : _a.length) === numExpectedSpans;
                (0, logger_1.logger)('waitForCompletedCloudTraceSpans', null, `fetched a trace with ${(_b = cloudTraceInfo.spans) === null || _b === void 0 ? void 0 : _b.length} spans`);
            }
            catch (error) {
                (0, logger_1.logger)('waitForCompletedCloudTraceSpans', null, 'failed with error:', error);
            }
            // Using a constant backoff for each attempt.
            if (!receivedFullTrace) {
                (0, logger_1.logger)('waitForCompletedCloudTraceSpans', null, `Could not fetch a full trace from the server. Retrying in ${GET_TRACE_RETRY_BACKOFF_MILLIS}ms.`);
                await new Promise(resolve => setTimeout(resolve, GET_TRACE_RETRY_BACKOFF_MILLIS));
            }
        } while (!receivedFullTrace && --remainingAttempts > 0);
        return receivedFullTrace;
    }
    async function waitForCompletedSpans(numExpectedSpans) {
        let success = false;
        if (testConfig.e2e) {
            success = await waitForCompletedCloudTraceSpans(numExpectedSpans);
        }
        else {
            success = await waitForCompletedInMemorySpans();
        }
        if (success) {
            buildSpanMaps();
        }
        // Tests are able to perform some Firestore operations inside
        // `runFirestoreOperationInRootSpan`, and some Firestore operations outside
        // of it. Therefore, if a given test intends to capture some (but not all) spans,
        // the in-memory trace will have more spans than `numExpectedSpans`.
        (0, chai_1.expect)(spanIdToSpanData.size).to.greaterThanOrEqual(numExpectedSpans, `Could not find expected number of spans (${numExpectedSpans})`);
    }
    function buildSpanMapsFromInMemorySpanExporter() {
        const spans = inMemorySpanExporter.getFinishedSpans();
        spans.forEach(span => {
            const id = span === null || span === void 0 ? void 0 : span.spanContext().spanId;
            const parentId = span === null || span === void 0 ? void 0 : span.parentSpanId;
            if (!parentId || span.name === SPAN_NAME_TEST_ROOT) {
                rootSpanIds.push(id);
            }
            else {
                let children = spanIdToChildrenSpanIds.get(parentId);
                // Initialize to empty array if it hasn't been seen before.
                if (!children) {
                    children = [];
                }
                // Add the new child.
                children.push(id);
                spanIdToChildrenSpanIds.set(parentId, children);
            }
            spanIdToSpanData.set(id, SpanData.fromInMemorySpan(span));
        });
    }
    function buildSpanMapsFromCloudTraceInfo() {
        const spans = cloudTraceInfo.spans;
        spans === null || spans === void 0 ? void 0 : spans.forEach(span => {
            const id = span.spanId;
            const parentId = span.parentSpanId;
            if (!parentId || span.name === SPAN_NAME_TEST_ROOT) {
                rootSpanIds.push(id);
            }
            else {
                let children = spanIdToChildrenSpanIds.get(parentId);
                if (!children) {
                    children = [];
                }
                children.push(id);
                spanIdToChildrenSpanIds.set(parentId, children);
            }
            spanIdToSpanData.set(id, SpanData.fromCloudTraceSpan(span, customSpanContext.traceId));
        });
    }
    function buildSpanMaps() {
        if (testConfig.e2e) {
            buildSpanMapsFromCloudTraceInfo();
        }
        else {
            buildSpanMapsFromInMemorySpanExporter();
        }
        (0, logger_1.logger)('buildSpanMaps', null, 'Built the following spans:', rootSpanIds, spanIdToSpanData, spanIdToChildrenSpanIds);
    }
    function getChildSpans(spanId) {
        return spanIdToChildrenSpanIds.get(spanId);
    }
    // Returns the first span it can find with the given name, or null if it cannot find a span with the given name.
    // If there are multiple spans with the same name, it'll return the first one.
    function getSpanByName(spanName) {
        for (const spanData of spanIdToSpanData.values()) {
            if (spanData.name === spanName) {
                return spanData;
            }
        }
        return null;
    }
    // Returns the array of spans that match the given span hierarchy names starting
    // at the given root. Returns an empty list if it cannot find such hierarchy under
    // the given root.
    function dfsSpanHierarchy(rootSpanId, spanNamesHierarchy) {
        var _a;
        // This function returns an empty list if it cannot find a full match.
        const notAMatch = [];
        const rootSpan = spanIdToSpanData.get(rootSpanId);
        if (spanNamesHierarchy.length === 0 || !rootSpan) {
            return notAMatch;
        }
        if (((_a = spanIdToSpanData.get(rootSpanId)) === null || _a === void 0 ? void 0 : _a.name) !== spanNamesHierarchy[0]) {
            // The root names didn't match.
            return notAMatch;
        }
        else {
            // The root names matched. The new hierarchy to match can be obtained by
            // popping the first element of `spanNamesHierarchy`.
            const newSpanNamesHierarchy = spanNamesHierarchy.slice(1);
            const children = getChildSpans(rootSpanId);
            if (!children || children.length === 0) {
                if (newSpanNamesHierarchy.length === 0) {
                    // The root span doesn't have any more children, and there are no
                    // more span names to match. This is a successful match, and it is
                    // a base case for the recursion.
                    return [rootSpan];
                }
                else {
                    // The root span doesn't have any more children, but there are still
                    // more span names to match.
                    return notAMatch;
                }
            }
            else {
                // See which (if any) of the child trees matches `newSpanNamesHierarchy`.
                for (let childIndex = 0; childIndex < children.length; ++childIndex) {
                    const newRootSpanId = children[childIndex];
                    const subtreeMatch = dfsSpanHierarchy(newRootSpanId, newSpanNamesHierarchy);
                    if (subtreeMatch.length > 0) {
                        // We found a full match in the child tree.
                        return [rootSpan].concat(subtreeMatch);
                    }
                }
                // If none of the child trees matched `newSpanNamesHierarchy`, we were
                // not able to find a full match anywhere in our child trees.
                return notAMatch;
            }
        }
    }
    // Asserts that the span hierarchy exists for the given span names.
    // The hierarchy starts with the root span, followed by the child span,
    // grandchild span, and so on. It also asserts that all the given spans belong
    // to the same trace, and that Firestore-generated spans contain the expected
    // Firestore attributes.
    function expectSpanHierarchy(...spanNamesHierarchy) {
        (0, chai_1.expect)(spanNamesHierarchy.length).to.be.greaterThan(0, 'The expected spans hierarchy was empty');
        let matchingSpanHierarchy = [];
        // The Firestore operations that have been executed generate a number of
        // spans. The span names, however, are not unique. For example, we could have:
        // "DocRef.Get" (id:1) -> "grpc.GET" (id:2) -> "POST" (id:3)
        // "DocRef.Set" (id:4) -> "grpc.SET" (id:5) -> "POST" (id:6)
        // Note that span names are not unique (e.g. span 3 and span 6).
        // Let's say we want to check if the following span hierarchy exists:
        // [DocRef.Set -> grpc.SET -> POST]
        // We start at each root span (span 1 and span 4 in this case), and check if
        // the span hierarchy matches the given `spanNamesHierarchy`.
        for (let i = 0; i < rootSpanIds.length; ++i) {
            matchingSpanHierarchy = dfsSpanHierarchy(rootSpanIds[i], spanNamesHierarchy);
            if (matchingSpanHierarchy.length > 0)
                break;
        }
        (0, chai_1.expect)(matchingSpanHierarchy.length).to.be.greaterThan(0, `Was not able to find the following span hierarchy: ${spanNamesHierarchy}`);
        (0, logger_1.logger)('expectSpanHierarchy', null, 'Found the following span hierarchy:', matchingSpanHierarchy);
        for (let i = 0; i + 1 < matchingSpanHierarchy.length; ++i) {
            const parentSpan = matchingSpanHierarchy[i];
            const childSpan = matchingSpanHierarchy[i + 1];
            (0, chai_1.expect)(childSpan.traceId).to.equal(parentSpan.traceId, `'${childSpan.name}' and '${parentSpan.name}' spans do not belong to the same trace`);
            // The Cloud Trace API does not return span attributes and events.
            if (!testConfig.e2e) {
                const settingsAttributes = getSettingsAttributes();
                for (const attributesKey in settingsAttributes) {
                    if (attributesKey.endsWith('.project_id') &&
                        i + 1 !== matchingSpanHierarchy.length) {
                        // Project ID is not set on the Firestore object until _after_ the first
                        // operation is done. Therefore, the spans that are created _before_ the
                        // first operation do not contain a project ID. So, we'll just compare
                        // this attribute on the leaf spans.
                    }
                    else {
                        (0, chai_1.expect)(childSpan.attributes[attributesKey]).to.be.equal(settingsAttributes[attributesKey]);
                    }
                }
            }
        }
    }
    // Ensures that the given span exists and has exactly all the given attributes.
    function expectSpanHasAttributes(spanName, attributes) {
        // The Cloud Trace API does not return span attributes and events.
        if (testConfig.e2e) {
            return;
        }
        // Expect that the span exists first.
        const span = getSpanByName(spanName);
        (0, chai_1.expect)(span, `Could not find the span named ${spanName}`).to.not.be.null;
        // Assert that the expected attributes are present in the span attributes.
        // Note that the span attributes may be a superset of the attributes passed
        // to this function.
        for (const attributesKey in attributes) {
            (0, chai_1.expect)(span.attributes[attributesKey]).to.be.equal(attributes[attributesKey]);
        }
    }
    // Ensures that the given span exists and has the given attributes.
    function expectSpanHasEvents(spanName, eventNames) {
        // The Cloud Trace API does not return span attributes and events.
        if (testConfig.e2e) {
            return;
        }
        // Expect that the span exists first.
        const span = getSpanByName(spanName);
        (0, chai_1.expect)(span, `Could not find the span named ${spanName}`).to.not.be.null;
        // Assert that the expected attributes are present in the span attributes.
        // Note that the span attributes may be a superset of the attributes passed
        // to this function.
        if (span === null || span === void 0 ? void 0 : span.events) {
            const numEvents = eventNames.length;
            (0, chai_1.expect)(numEvents).to.equal(span.events.length);
            for (let i = 0; i < numEvents; ++i) {
                (0, chai_1.expect)(span.events[i].name).to.equal(eventNames[i]);
            }
        }
    }
    (0, mocha_1.describe)(IN_MEMORY_TEST_SUITE_TITLE, () => {
        (0, mocha_1.describe)(NON_GLOBAL_OTEL_TEST_SUITE_TITLE, () => {
            (0, mocha_1.describe)(GRPC_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
            (0, mocha_1.describe)(REST_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
        });
        (0, mocha_1.describe)(GLOBAL_OTEL_TEST_SUITE_TITLE, () => {
            (0, mocha_1.describe)(GRPC_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
            (0, mocha_1.describe)(REST_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
        });
    });
    (0, mocha_1.describe)(E2E_TEST_SUITE_TITLE, () => {
        (0, mocha_1.describe)(NON_GLOBAL_OTEL_TEST_SUITE_TITLE, () => {
            (0, mocha_1.describe)(GRPC_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
            (0, mocha_1.describe)(REST_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
        });
        (0, mocha_1.describe)(GLOBAL_OTEL_TEST_SUITE_TITLE, () => {
            (0, mocha_1.describe)(GRPC_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
            (0, mocha_1.describe)(REST_TEST_SUITE_TITLE, () => {
                (0, mocha_1.beforeEach)(function () {
                    beforeEachTest(this.currentTest);
                });
                runTestCases();
                (0, mocha_1.afterEach)(async () => afterEachTest());
            });
        });
    });
    function runTestCases() {
        (0, mocha_1.it)('document reference get()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc('bar').get());
            await waitForCompletedSpans(3);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_GET, trace_util_1.SPAN_NAME_BATCH_GET_DOCUMENTS);
            expectSpanHasEvents(trace_util_1.SPAN_NAME_BATCH_GET_DOCUMENTS, [
                'Firestore.batchGetDocuments: Start',
                'Firestore.batchGetDocuments: First response received',
                'Firestore.batchGetDocuments: Completed',
            ]);
        });
        (0, mocha_1.it)('document reference create()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc().create({}));
            await waitForCompletedSpans(3);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_CREATE, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('document reference delete()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc('bar').delete());
            await waitForCompletedSpans(3);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_DELETE, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('document reference set()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc('bar').set({ foo: 'bar' }));
            await waitForCompletedSpans(3);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_SET, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('document reference update()', async () => {
            // Make sure the document exists before updating it.
            // Perform the `set` operation outside of the root span.
            await firestore.collection('foo').doc('bar').set({ foo: 'bar' });
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc('bar').update('foo', 'bar2'));
            await waitForCompletedSpans(3);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_UPDATE, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('document reference list collections', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').doc('bar').listCollections());
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_DOC_REF_LIST_COLLECTIONS);
        });
        (0, mocha_1.it)('aggregate query get()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').count().get());
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_AGGREGATION_QUERY_GET);
            expectSpanHasEvents(trace_util_1.SPAN_NAME_AGGREGATION_QUERY_GET, [
                'Firestore.runAggregationQuery: Start',
                'Firestore.runAggregationQuery: First response received',
                'Firestore.runAggregationQuery: Completed',
            ]);
        });
        (0, mocha_1.it)('collection reference add()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').add({ foo: 'bar' }));
            await waitForCompletedSpans(4);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_COL_REF_ADD, trace_util_1.SPAN_NAME_DOC_REF_CREATE, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('collection reference list documents', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').listDocuments());
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_COL_REF_LIST_DOCUMENTS);
        });
        (0, mocha_1.it)('query get()', async () => {
            await runFirestoreOperationInRootSpan(() => firestore.collection('foo').where('foo', '==', 'bar').limit(1).get());
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_QUERY_GET);
            expectSpanHasEvents(trace_util_1.SPAN_NAME_QUERY_GET, [
                'RunQuery',
                'Firestore.runQuery: Start',
                'Firestore.runQuery: First response received',
                'Firestore.runQuery: Completed',
            ]);
        });
        (0, mocha_1.it)('firestore getAll()', async () => {
            const docRef1 = firestore.collection('foo').doc('1');
            const docRef2 = firestore.collection('foo').doc('2');
            await runFirestoreOperationInRootSpan(() => firestore.getAll(docRef1, docRef2));
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_BATCH_GET_DOCUMENTS);
            expectSpanHasEvents(trace_util_1.SPAN_NAME_BATCH_GET_DOCUMENTS, [
                'Firestore.batchGetDocuments: Start',
                'Firestore.batchGetDocuments: First response received',
                'Firestore.batchGetDocuments: Completed',
            ]);
        });
        (0, mocha_1.it)('transaction', async () => {
            const docRef1 = firestore.collection('foo').doc('bar');
            const docRef2 = firestore.collection('foo').doc('bar');
            await runFirestoreOperationInRootSpan(async () => {
                return firestore.runTransaction(async (transaction) => {
                    await transaction.get(docRef1);
                    await transaction.getAll(docRef1, docRef2);
                    await transaction.get(firestore.collection('foo').limit(1));
                    await transaction.get(firestore.collection('nonexistent').count());
                    transaction.set(firestore.collection('foo').doc(), { foo: 'bar' });
                });
            });
            await waitForCompletedSpans(7);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_TRANSACTION_RUN, trace_util_1.SPAN_NAME_TRANSACTION_GET_DOCUMENT);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_TRANSACTION_RUN, trace_util_1.SPAN_NAME_TRANSACTION_GET_DOCUMENTS);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_TRANSACTION_RUN, trace_util_1.SPAN_NAME_TRANSACTION_GET_QUERY);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_TRANSACTION_RUN, trace_util_1.SPAN_NAME_TRANSACTION_GET_AGGREGATION_QUERY);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_TRANSACTION_RUN, trace_util_1.SPAN_NAME_TRANSACTION_COMMIT);
        });
        (0, mocha_1.it)('batch', async () => {
            const writeBatch = firestore.batch();
            const documentRef = firestore.doc('col/doc');
            writeBatch.set(documentRef, { foo: 'bar' });
            await runFirestoreOperationInRootSpan(() => writeBatch.commit());
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_BATCH_COMMIT);
        });
        (0, mocha_1.it)('partition query', async () => {
            await runFirestoreOperationInRootSpan(async () => {
                const query = firestore.collectionGroup('foo');
                let numPartitions = 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for await (const partition of query.getPartitions(3)) {
                    numPartitions++;
                }
                return numPartitions;
            });
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_PARTITION_QUERY);
        });
        (0, mocha_1.it)('bulk writer', async () => {
            await runFirestoreOperationInRootSpan(async () => {
                const bulkWriter = firestore.bulkWriter();
                // No need to await the set operations as 'close()' will commit all writes before closing.
                bulkWriter.set(firestore.collection('foo').doc(), { foo: 1 });
                bulkWriter.set(firestore.collection('foo').doc(), { foo: 2 });
                bulkWriter.set(firestore.collection('foo').doc(), { foo: 3 });
                bulkWriter.set(firestore.collection('foo').doc(), { foo: 4 });
                bulkWriter.set(firestore.collection('foo').doc(), { foo: 5 });
                await bulkWriter.close();
            });
            await waitForCompletedSpans(2);
            expectSpanHierarchy(SPAN_NAME_TEST_ROOT, trace_util_1.SPAN_NAME_BULK_WRITER_COMMIT);
            expectSpanHasAttributes(trace_util_1.SPAN_NAME_BULK_WRITER_COMMIT, {
                [trace_util_1.ATTRIBUTE_KEY_DOC_COUNT]: 5,
            });
        });
    }
});
//# sourceMappingURL=tracing.js.map
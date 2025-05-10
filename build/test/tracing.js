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
const mocha_1 = require("mocha");
const helpers_1 = require("./util/helpers");
const chai_1 = require("chai");
const disabled_trace_util_1 = require("../src/telemetry/disabled-trace-util");
const enabled_trace_util_1 = require("../src/telemetry/enabled-trace-util");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const api_1 = require("@opentelemetry/api");
(0, mocha_1.describe)('Firestore Tracing Controls', () => {
    let originalEnvVarValue;
    beforeEach(() => {
        // Remove any prior global OpenTelemetry registrations.
        api_1.trace.disable();
        originalEnvVarValue = process.env.FIRESTORE_ENABLE_TRACING;
    });
    afterEach(() => {
        if (originalEnvVarValue === undefined) {
            delete process.env.FIRESTORE_ENABLE_TRACING;
        }
        else {
            process.env.FIRESTORE_ENABLE_TRACING = originalEnvVarValue;
        }
    });
    (0, mocha_1.it)('default firestore settings, no env var', async () => {
        const firestore = await (0, helpers_1.createInstance)();
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    /// Tests to make sure environment variable can override settings.
    (0, mocha_1.it)('default firestore settings, env var disabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'OFF';
        const firestore = await (0, helpers_1.createInstance)();
        (0, chai_1.expect)(firestore._traceUtil instanceof disabled_trace_util_1.DisabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('default firestore settings, env var enabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'ON';
        const firestore = await (0, helpers_1.createInstance)();
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('no openTelemetry settings, no env var', async () => {
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: undefined,
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
        const firestore2 = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: undefined,
            },
        });
        (0, chai_1.expect)(firestore2._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('no openTelemetry settings, env var disabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'OFF';
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: undefined,
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof disabled_trace_util_1.DisabledTraceUtil).to.be.true;
        const firestore2 = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: undefined,
            },
        });
        (0, chai_1.expect)(firestore2._traceUtil instanceof disabled_trace_util_1.DisabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('no openTelemetry settings, env var enabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'ON';
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: undefined,
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
        const firestore2 = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: undefined,
            },
        });
        (0, chai_1.expect)(firestore2._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('valid tracerProvider, no env var', async () => {
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: new sdk_trace_node_1.NodeTracerProvider(),
            },
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('valid tracerProvider, env var disabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'OFF';
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: new sdk_trace_node_1.NodeTracerProvider(),
            },
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof disabled_trace_util_1.DisabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('valid tracerProvider, env var enabled', async () => {
        process.env.FIRESTORE_ENABLE_TRACING = 'ON';
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: new sdk_trace_node_1.NodeTracerProvider(),
            },
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
    });
    (0, mocha_1.it)('uses the tracerProvider passed to it', async () => {
        const myTracerProvider = new sdk_trace_node_1.NodeTracerProvider();
        // Make another tracer provider the global tracer provider.
        const globalTracerProvider = new sdk_trace_node_1.NodeTracerProvider();
        globalTracerProvider.register();
        const firestore = await (0, helpers_1.createInstance)(undefined, {
            openTelemetry: {
                tracerProvider: myTracerProvider,
            },
        });
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
        // Make sure the SDK uses the one that was given to it, not the global one.
        (0, chai_1.expect)(firestore._traceUtil.tracerProvider ===
            myTracerProvider).to.be.true;
        (0, chai_1.expect)(firestore._traceUtil.tracerProvider !==
            globalTracerProvider).to.be.true;
    });
    (0, mocha_1.it)('uses the global tracerProvider if nothing was passed to it', async () => {
        // Make another tracer provider the global tracer provider.
        const globalTracerProvider = new sdk_trace_node_1.NodeTracerProvider();
        globalTracerProvider.register();
        const firestore = await (0, helpers_1.createInstance)();
        (0, chai_1.expect)(firestore._traceUtil instanceof enabled_trace_util_1.EnabledTraceUtil).to.be.true;
        const enabledTraceUtil = firestore._traceUtil;
        // Since a TracerProvider is not provided to the SDK directly, the SDK obtains
        // the tracer provider from the global `TraceAPI`. The `TraceAPI` returns a
        // `ProxyTracerProvider` instance. To check equality, we need to compare our
        // `globalTracerProvider` with the proxy's delegate.
        const tracerProviderUsed = enabledTraceUtil.tracerProvider;
        const actual = tracerProviderUsed.getDelegate();
        (0, chai_1.expect)(actual === globalTracerProvider).to.be.true;
    });
    (0, mocha_1.it)('Generates an error if the given tracerProvider is not valid', async () => {
        try {
            await (0, helpers_1.createInstance)(undefined, {
                openTelemetry: { tracerProvider: 123 },
            });
        }
        catch (e) {
            (0, chai_1.expect)(e.toString() ===
                "The object provided for 'tracerProvider' does not conform to the TracerProvider interface.");
        }
    });
});
//# sourceMappingURL=tracing.js.map
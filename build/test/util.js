"use strict";
// Copyright 2020 Google LLC
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
const chai_1 = require("chai");
const util_1 = require("../src/util");
const sinon = require("sinon");
(0, mocha_1.describe)('isPlainObject()', () => {
    (0, mocha_1.it)('allows Object.create()', () => {
        (0, chai_1.expect)((0, util_1.isPlainObject)(Object.create({}))).to.be.true;
        (0, chai_1.expect)((0, util_1.isPlainObject)(Object.create(Object.prototype))).to.be.true;
        (0, chai_1.expect)((0, util_1.isPlainObject)(Object.create(null))).to.be.true;
    });
    (0, mocha_1.it)(' allows plain types', () => {
        (0, chai_1.expect)((0, util_1.isPlainObject)({ foo: 'bar' })).to.be.true;
        (0, chai_1.expect)((0, util_1.isPlainObject)({})).to.be.true;
    });
    (0, mocha_1.it)('rejects custom types', () => {
        class Foo {
        }
        (0, chai_1.expect)((0, util_1.isPlainObject)(new Foo())).to.be.false;
        (0, chai_1.expect)((0, util_1.isPlainObject)(Object.create(new Foo()))).to.be.false;
    });
    (0, mocha_1.describe)('tryGetPreferRestEnvironmentVariable', () => {
        const sandbox = sinon.createSandbox();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let warnSpy;
        let originalValue;
        beforeEach(() => {
            warnSpy = sandbox.spy(console, 'warn');
            originalValue = process.env.FIRESTORE_PREFER_REST;
        });
        afterEach(() => {
            sandbox.restore();
            if (originalValue === undefined) {
                delete process.env.FIRESTORE_PREFER_REST;
            }
            else {
                process.env.FIRESTORE_PREFER_REST = originalValue;
            }
        });
        (0, mocha_1.it)('reads true', async () => {
            process.env.FIRESTORE_PREFER_REST = 'true';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.true;
        });
        (0, mocha_1.it)('reads 1', async () => {
            process.env.FIRESTORE_PREFER_REST = '1';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.true;
        });
        (0, mocha_1.it)('reads false', async () => {
            process.env.FIRESTORE_PREFER_REST = 'false';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.false;
        });
        (0, mocha_1.it)('reads 0', async () => {
            process.env.FIRESTORE_PREFER_REST = '0';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.false;
        });
        (0, mocha_1.it)('ignores case', async () => {
            process.env.FIRESTORE_PREFER_REST = 'True';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.true;
        });
        (0, mocha_1.it)('trims whitespace', async () => {
            process.env.FIRESTORE_PREFER_REST = '  true  ';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.true;
        });
        (0, mocha_1.it)('returns undefined when the environment variable is not set', async () => {
            delete process.env.FIRESTORE_PREFER_REST;
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.undefined;
            (0, chai_1.expect)(warnSpy.calledOnce).to.be.false;
        });
        (0, mocha_1.it)('returns undefined and warns when the environment variable is set to an unsupported value', async () => {
            process.env.FIRESTORE_PREFER_REST = 'enable';
            (0, chai_1.expect)((0, util_1.tryGetPreferRestEnvironmentVariable)()).to.be.undefined;
            (0, chai_1.expect)(warnSpy.calledOnce).to.be.true;
            (0, chai_1.expect)(warnSpy.getCall(0).args[0]).to.match(/unsupported value.*FIRESTORE_PREFER_REST/);
        });
    });
});
//# sourceMappingURL=util.js.map
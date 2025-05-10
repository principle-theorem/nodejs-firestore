"use strict";
// Copyright 2017 Google LLC
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
const chaiAsPromised = require("chai-as-promised");
const backoff_1 = require("../src/backoff");
(0, chai_1.use)(chaiAsPromised);
const nop = () => { };
(0, mocha_1.describe)('ExponentialBackoff', () => {
    let observedDelays = [];
    (0, mocha_1.before)(() => {
        (0, backoff_1.setTimeoutHandler)((callback, timeout) => {
            observedDelays.push(timeout);
            callback();
        });
    });
    (0, mocha_1.beforeEach)(() => {
        observedDelays = [];
    });
    (0, mocha_1.after)(() => (0, backoff_1.setTimeoutHandler)(setTimeout));
    function assertDelayEquals(expected) {
        (0, chai_1.expect)(observedDelays.shift()).to.equal(expected);
    }
    function assertDelayBetween(low, high) {
        const actual = observedDelays.shift();
        (0, chai_1.expect)(actual).to.be.at.least(low);
        (0, chai_1.expect)(actual).to.be.at.most(high);
    }
    (0, mocha_1.it)("doesn't delay first attempt", async () => {
        const backoff = new backoff_1.ExponentialBackoff();
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
    });
    (0, mocha_1.it)('respects the initial retry delay', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            jitterFactor: 0,
        });
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(10);
    });
    (0, mocha_1.it)('exponentially increases the delay', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            backoffFactor: 2,
            jitterFactor: 0,
        });
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(10);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(20);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(40);
    });
    (0, mocha_1.it)('increases until maximum', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            backoffFactor: 2,
            maxDelayMs: 35,
            jitterFactor: 0,
        });
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(10);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(20);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(35);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(35);
    });
    (0, mocha_1.it)('can reset delay', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            backoffFactor: 2,
            maxDelayMs: 35,
            jitterFactor: 0,
        });
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(10);
        backoff.reset();
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(10);
    });
    (0, mocha_1.it)('can reset delay to maximum', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            maxDelayMs: 35,
            jitterFactor: 0,
        });
        backoff.resetToMax();
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(35);
    });
    (0, mocha_1.it)('applies jitter', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            backoffFactor: 2,
            jitterFactor: 0.1,
        });
        await backoff.backoffAndWait().then(nop);
        assertDelayEquals(0);
        await backoff.backoffAndWait().then(nop);
        assertDelayBetween(9, 11);
        await backoff.backoffAndWait().then(nop);
        assertDelayBetween(18, 22);
        await backoff.backoffAndWait().then(nop);
        assertDelayBetween(36, 44);
    });
    (0, mocha_1.it)('tracks the number of retry attempts', async () => {
        const backoff = new backoff_1.ExponentialBackoff({
            initialDelayMs: 10,
            backoffFactor: 2,
            jitterFactor: 0.1,
        });
        (0, chai_1.expect)(backoff.retryCount).to.equal(0);
        await backoff.backoffAndWait().then(nop);
        (0, chai_1.expect)(backoff.retryCount).to.equal(1);
        await backoff.backoffAndWait().then(nop);
        (0, chai_1.expect)(backoff.retryCount).to.equal(2);
        backoff.reset();
        (0, chai_1.expect)(backoff.retryCount).to.equal(0);
    });
    (0, mocha_1.it)('cannot queue two backoffAndWait() operations simultaneously', async () => {
        const backoff = new backoff_1.ExponentialBackoff();
        // The timeout handler for this test simply idles forever.
        (0, backoff_1.setTimeoutHandler)(() => { });
        backoff.backoffAndWait().then(nop);
        await (0, chai_1.expect)(backoff.backoffAndWait()).to.eventually.be.rejectedWith('A backoff operation is already in progress.');
    });
});
//# sourceMappingURL=backoff.js.map
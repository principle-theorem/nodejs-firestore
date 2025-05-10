"use strict";
// Copyright 2018 Google LLC
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
const google_gax_1 = require("google-gax");
const chaiAsPromised = require("chai-as-promised");
const pool_1 = require("../src/pool");
const util_1 = require("../src/util");
(0, chai_1.use)(chaiAsPromised);
const REQUEST_TAG = 'tag';
const USE_REST = false;
const USE_GRPC = true;
function deferredPromises(count) {
    const deferred = [];
    for (let i = 0; i < count; ++i) {
        deferred.push(new util_1.Deferred());
    }
    return deferred;
}
function assertOpCount(pool, grpcClientOpCount, restClientOpCount) {
    let actualGrpcClientOpCount = 0;
    let actualRestClientOpCount = 0;
    pool._activeClients.forEach(clientConfig => {
        if (clientConfig.grpcEnabled) {
            actualGrpcClientOpCount += clientConfig.activeRequestCount;
        }
        else {
            actualRestClientOpCount += clientConfig.activeRequestCount;
        }
    });
    (0, chai_1.expect)(actualGrpcClientOpCount).to.equal(grpcClientOpCount);
    (0, chai_1.expect)(actualRestClientOpCount).to.equal(restClientOpCount);
}
(0, mocha_1.describe)('Client pool', () => {
    (0, mocha_1.it)('creates new instances as needed', () => {
        const clientPool = new pool_1.ClientPool(3, 0, () => {
            return {};
        });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
        const operationPromises = deferredPromises(4);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[3].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
    });
    (0, mocha_1.it)('re-uses instances with remaining capacity', () => {
        const clientPool = new pool_1.ClientPool(2, 0, () => {
            return {};
        });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
        const operationPromises = deferredPromises(5);
        const completionPromise = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[3].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        operationPromises[0].resolve();
        return completionPromise.then(() => {
            clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[4].promise);
            (0, chai_1.expect)(clientPool.size).to.equal(2);
        });
    });
    (0, mocha_1.it)('re-uses idle instances', async () => {
        let instanceCount = 0;
        const clientPool = new pool_1.ClientPool(1, 1, () => {
            ++instanceCount;
            return {};
        });
        const operationPromises = deferredPromises(2);
        let completionPromise = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        operationPromises[0].resolve();
        await completionPromise;
        completionPromise = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        operationPromises[1].resolve();
        await completionPromise;
        (0, chai_1.expect)(instanceCount).to.equal(1);
    });
    (0, mocha_1.it)('does not re-use rest instance for grpc call', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(2);
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        void clientPool.run(REQUEST_TAG, USE_GRPC, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        assertOpCount(clientPool, 1, 1);
        operationPromises[0].resolve();
        operationPromises[1].resolve();
    });
    (0, mocha_1.it)('re-uses grpc instance for rest calls', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(2);
        void clientPool.run(REQUEST_TAG, USE_GRPC, () => operationPromises[0].promise);
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        assertOpCount(clientPool, 2, 0);
        operationPromises[0].resolve();
        operationPromises[1].resolve();
    });
    (0, mocha_1.it)('does not re-use rest instance after beginning the transition to grpc', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(3);
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        void clientPool.run(REQUEST_TAG, USE_GRPC, () => operationPromises[1].promise);
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        assertOpCount(clientPool, 2, 1);
        operationPromises[0].resolve();
        operationPromises[1].resolve();
        operationPromises[2].resolve();
    });
    (0, mocha_1.it)('does not re-use rest instance after beginning the transition to grpc - rest operation resolved', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(3);
        const restOperation = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        void clientPool.run(REQUEST_TAG, USE_GRPC, () => operationPromises[1].promise);
        // resolve rest operation
        operationPromises[0].resolve();
        await restOperation;
        (0, chai_1.expect)(clientPool.opCount).to.equal(1);
        // Run new rest operation
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise);
        // Assert client pool status
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        assertOpCount(clientPool, 2, 0);
        operationPromises[1].resolve();
        operationPromises[2].resolve();
    });
    (0, mocha_1.it)('does not re-use rest instance after beginning the transition to grpc - grpc client full', async () => {
        const operationLimit = 10;
        const clientPool = new pool_1.ClientPool(operationLimit, 1, () => {
            return {};
        });
        const restPromises = deferredPromises(operationLimit);
        const grpcPromises = deferredPromises(1);
        // First operation use GRPC
        void clientPool.run(REQUEST_TAG, USE_GRPC, () => grpcPromises[0].promise);
        // Next X operations can use rest, this will fill the first
        // client and create a new client.
        // The new client should use GRPC since we have transitioned.
        restPromises.forEach(restPromise => {
            void clientPool.run(REQUEST_TAG, USE_REST, () => restPromise.promise);
        });
        (0, chai_1.expect)(clientPool.opCount).to.equal(11);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        assertOpCount(clientPool, 11, 0);
        grpcPromises.forEach(grpcPromise => grpcPromise.resolve());
        restPromises.forEach(restPromise => restPromise.resolve());
    });
    (0, mocha_1.it)('does not re-use rest instance after beginning the transition to grpc - multiple rest clients', async () => {
        const operationLimit = 10;
        const clientPool = new pool_1.ClientPool(operationLimit, 1, () => {
            return {};
        });
        const restPromises = deferredPromises(15);
        const grpcPromises = deferredPromises(5);
        // First 15 operations can use rest, this will fill the first
        // client and create a new client.
        restPromises.forEach(restPromise => {
            void clientPool.run(REQUEST_TAG, USE_REST, () => restPromise.promise);
        });
        (0, chai_1.expect)(clientPool.opCount).to.equal(15);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        assertOpCount(clientPool, 0, 15);
        // Next 5 operations alternate between gRPC and REST, this will create a new client using gRPC
        let transport = USE_GRPC;
        grpcPromises.forEach(grpcPromise => {
            void clientPool.run(REQUEST_TAG, transport, () => grpcPromise.promise);
            transport = !transport;
        });
        (0, chai_1.expect)(clientPool.opCount).to.equal(20);
        (0, chai_1.expect)(clientPool.size).to.equal(3);
        assertOpCount(clientPool, 5, 15);
        grpcPromises.forEach(grpcPromise => grpcPromise.resolve());
        restPromises.forEach(restPromise => restPromise.resolve());
    });
    (0, mocha_1.it)('does not re-use rest instance after beginning the transition to grpc - grpc client RST_STREAM', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(1);
        const grpcOperation = clientPool.run(REQUEST_TAG, USE_GRPC, () => Promise.reject(new google_gax_1.GoogleError('13 INTERNAL: Received RST_STREAM with code 2')));
        await grpcOperation.catch(e => e);
        // Run new rest operation
        void clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        // Assert client pool status
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        assertOpCount(clientPool, 1, 0);
        operationPromises[0].resolve();
    });
    (0, mocha_1.it)('bin packs operations', async () => {
        let clientCount = 0;
        const clientPool = new pool_1.ClientPool(2, 0, () => {
            return ++clientCount;
        });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
        // Create 5 operations, which should schedule 2 operations on the first
        // client, 2 on the second and 1 on the third.
        const operationPromises = deferredPromises(7);
        clientPool.run(REQUEST_TAG, USE_REST, client => {
            (0, chai_1.expect)(client).to.be.equal(1);
            return operationPromises[0].promise;
        });
        clientPool.run(REQUEST_TAG, USE_REST, client => {
            (0, chai_1.expect)(client).to.be.equal(1);
            return operationPromises[1].promise;
        });
        const thirdOperation = clientPool.run(REQUEST_TAG, USE_REST, client => {
            (0, chai_1.expect)(client).to.be.equal(2);
            return operationPromises[2].promise;
        });
        clientPool.run(REQUEST_TAG, USE_REST, client => {
            (0, chai_1.expect)(client).to.be.equal(2);
            return operationPromises[3].promise;
        });
        clientPool.run(REQUEST_TAG, USE_REST, client => {
            (0, chai_1.expect)(client).to.be.equal(3);
            return operationPromises[4].promise;
        });
        // Free one slot on the second client.
        operationPromises[2].resolve();
        await thirdOperation;
        // A newly scheduled operation should use the first client that has a free
        // slot.
        clientPool.run(REQUEST_TAG, USE_REST, async (client) => {
            (0, chai_1.expect)(client).to.be.equal(2);
        });
    });
    (0, mocha_1.it)('garbage collects after success', () => {
        const clientPool = new pool_1.ClientPool(2, 0, () => {
            return {};
        });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
        const operationPromises = deferredPromises(4);
        const completionPromises = [];
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[3].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        operationPromises.forEach(deferred => deferred.resolve());
        return Promise.all(completionPromises).then(() => {
            (0, chai_1.expect)(clientPool.size).to.equal(0);
        });
    });
    (0, mocha_1.it)('garbage collects after error', () => {
        const clientPool = new pool_1.ClientPool(2, 0, () => {
            return {};
        });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
        const operationPromises = deferredPromises(4);
        const completionPromises = [];
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(1);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        completionPromises.push(clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[3].promise));
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        operationPromises.forEach(deferred => deferred.reject(new Error()));
        return Promise.all(completionPromises.map(p => p.catch(() => { }))).then(() => (0, chai_1.expect)(clientPool.size).to.equal(0));
    });
    (0, mocha_1.it)('garbage collection calls destructor', () => {
        const garbageCollect = new util_1.Deferred();
        const clientPool = new pool_1.ClientPool(1, 0, () => ({}), () => Promise.resolve(garbageCollect.resolve()));
        const operationPromises = deferredPromises(2);
        // Create two pending operations that each spawn their own client
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        operationPromises.forEach(deferred => deferred.resolve());
        return garbageCollect.promise;
    });
    (0, mocha_1.it)('forwards success', () => {
        const clientPool = new pool_1.ClientPool(1, 0, () => {
            return {};
        });
        const op = clientPool.run(REQUEST_TAG, USE_REST, () => Promise.resolve('Success'));
        return (0, chai_1.expect)(op).to.become('Success');
    });
    (0, mocha_1.it)('forwards failure', () => {
        const clientPool = new pool_1.ClientPool(1, 0, () => {
            return {};
        });
        const op = clientPool.run(REQUEST_TAG, USE_REST, () => Promise.reject('Generated error'));
        return (0, chai_1.expect)(op).to.eventually.be.rejectedWith('Generated error');
    });
    (0, mocha_1.it)('does not re-use clients after RST_STREAM', async () => {
        let instanceCount = 0;
        const clientPool = new pool_1.ClientPool(1, 1, () => {
            ++instanceCount;
            return {};
        });
        const op = clientPool.run(REQUEST_TAG, USE_REST, () => Promise.reject(new google_gax_1.GoogleError('13 INTERNAL: Received RST_STREAM with code 2')));
        await op.catch(() => { });
        await clientPool.run(REQUEST_TAG, USE_REST, async () => { });
        (0, chai_1.expect)(instanceCount).to.equal(2);
    });
    (0, mocha_1.it)('garbage collects after RST_STREAM', async () => {
        const clientPool = new pool_1.ClientPool(1, 1, () => {
            return {};
        });
        const op = clientPool.run(REQUEST_TAG, USE_REST, () => Promise.reject(new google_gax_1.GoogleError('13 INTERNAL: Received RST_STREAM with code 2')));
        await op.catch(() => { });
        (0, chai_1.expect)(clientPool.size).to.equal(0);
    });
    (0, mocha_1.it)('garbage collects rest clients after GRPC', async () => {
        const clientPool = new pool_1.ClientPool(10, 1, () => {
            return {};
        });
        await clientPool.run(REQUEST_TAG, USE_REST, () => Promise.resolve());
        await clientPool.run(REQUEST_TAG, USE_GRPC, () => Promise.resolve());
        (0, chai_1.expect)(clientPool.size).to.equal(1);
    });
    (0, mocha_1.it)('keeps pool of idle clients', async () => {
        const clientPool = new pool_1.ClientPool(
        /* concurrentOperationLimit= */ 1, 
        /* maxIdleClients= */ 3, () => {
            return {};
        });
        const operationPromises = deferredPromises(4);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[2].promise);
        const lastOp = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[3].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(4);
        // Resolve all pending operations. Note that one client is removed, while
        // 3 are kept for further usage.
        operationPromises.forEach(deferred => deferred.resolve());
        await lastOp;
        (0, chai_1.expect)(clientPool.size).to.equal(3);
    });
    (0, mocha_1.it)('default setting keeps at least one idle client', async () => {
        const clientPool = new pool_1.ClientPool(1, 
        /* maxIdleClients= git c*/ 1, () => {
            return {};
        });
        const operationPromises = deferredPromises(2);
        clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[0].promise);
        const completionPromise = clientPool.run(REQUEST_TAG, USE_REST, () => operationPromises[1].promise);
        (0, chai_1.expect)(clientPool.size).to.equal(2);
        operationPromises[0].resolve();
        operationPromises[1].resolve();
        await completionPromise;
        (0, chai_1.expect)(clientPool.size).to.equal(1);
    });
    (0, mocha_1.it)('rejects subsequent operations after being terminated', () => {
        const clientPool = new pool_1.ClientPool(1, 0, () => {
            return {};
        });
        return clientPool
            .terminate()
            .then(() => {
            return clientPool.run(REQUEST_TAG, USE_REST, () => Promise.reject('Call to run() should have failed'));
        })
            .catch((err) => {
            (0, chai_1.expect)(err.message).to.equal(pool_1.CLIENT_TERMINATED_ERROR_MSG);
        });
    });
    (0, mocha_1.it)('waits for existing operations to complete before releasing clients', done => {
        const clientPool = new pool_1.ClientPool(1, 0, () => {
            return {};
        });
        const deferred = new util_1.Deferred();
        let terminated = false;
        // Run operation that completes after terminate() is called.
        clientPool.run(REQUEST_TAG, USE_REST, () => {
            return deferred.promise;
        });
        const terminateOp = clientPool.terminate().then(() => {
            terminated = true;
        });
        (0, chai_1.expect)(terminated).to.be.false;
        // Mark the mock operation as "complete".
        deferred.resolve();
        terminateOp.then(() => {
            (0, chai_1.expect)(terminated).to.be.true;
            done();
        });
    });
});
//# sourceMappingURL=pool.js.map
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
const through2 = require("through2");
const Firestore = require("../src/index");
const helpers_1 = require("../test/util/helpers");
function createInstance(opts, document) {
    const overrides = {
        batchGetDocuments: () => {
            const stream = through2.obj();
            setImmediate(() => {
                stream.push({ found: document, readTime: { seconds: 5, nanos: 6 } });
                stream.push(null);
            });
            return stream;
        },
    };
    return (0, helpers_1.createInstance)(overrides, opts);
}
const DOCUMENT_WITH_TIMESTAMP = (0, helpers_1.document)('documentId', 'moonLanding', {
    timestampValue: {
        nanos: 123000123,
        seconds: -14182920,
    },
});
const DOCUMENT_WITH_EMPTY_TIMESTAMP = (0, helpers_1.document)('documentId', 'moonLanding', {
    timestampValue: {},
});
(0, mocha_1.describe)('timestamps', () => {
    (0, mocha_1.it)('returned by default', () => {
        return createInstance({}, DOCUMENT_WITH_TIMESTAMP).then(firestore => {
            const expected = new Firestore.Timestamp(-14182920, 123000123);
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.data()['moonLanding'].isEqual(expected)).to.be.true;
                (0, chai_1.expect)(res.get('moonLanding').isEqual(expected)).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('retain seconds and nanoseconds', () => {
        return createInstance({}, DOCUMENT_WITH_TIMESTAMP).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                const timestamp = res.get('moonLanding');
                (0, chai_1.expect)(timestamp.seconds).to.equal(-14182920);
                (0, chai_1.expect)(timestamp.nanoseconds).to.equal(123000123);
            });
        });
    });
    (0, mocha_1.it)('convert to date', () => {
        return createInstance({}, DOCUMENT_WITH_TIMESTAMP).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                const timestamp = res.get('moonLanding');
                (0, chai_1.expect)(new Date(-14182920 * 1000 + 123).getTime()).to.equal(timestamp.toDate().getTime());
            });
        });
    });
    (0, mocha_1.it)('convert to millis', () => {
        return createInstance({}, DOCUMENT_WITH_TIMESTAMP).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                const timestamp = res.get('moonLanding');
                (0, chai_1.expect)(-14182920 * 1000 + 123).to.equal(timestamp.toMillis());
            });
        });
    });
    (0, mocha_1.it)('support missing values', () => {
        return createInstance({}, DOCUMENT_WITH_EMPTY_TIMESTAMP).then(firestore => {
            const expected = new Firestore.Timestamp(0, 0);
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('moonLanding').isEqual(expected)).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('constructed using helper', () => {
        (0, chai_1.expect)(Firestore.Timestamp.now()).to.be.an.instanceOf(Firestore.Timestamp);
        let actual = Firestore.Timestamp.fromDate(new Date(123123));
        let expected = new Firestore.Timestamp(123, 123000000);
        (0, chai_1.expect)(actual.isEqual(expected)).to.be.true;
        actual = Firestore.Timestamp.fromMillis(123123);
        expected = new Firestore.Timestamp(123, 123000000);
        (0, chai_1.expect)(actual.isEqual(expected)).to.be.true;
    });
    (0, mocha_1.it)('handles decimal inputs in fromMillis()', () => {
        const actual = Firestore.Timestamp.fromMillis(1000.1);
        const expected = new Firestore.Timestamp(1, 100000);
        (0, chai_1.expect)(actual.isEqual(expected)).to.be.true;
    });
    (0, mocha_1.it)('validates seconds', () => {
        (0, chai_1.expect)(() => new Firestore.Timestamp(0.1, 0)).to.throw('Value for argument "seconds" is not a valid integer.');
        (0, chai_1.expect)(() => new Firestore.Timestamp(-62135596801, 0)).to.throw('Value for argument "seconds" must be within [-62135596800, 253402300799] inclusive, but was: -62135596801');
        (0, chai_1.expect)(() => new Firestore.Timestamp(253402300800, 0)).to.throw('Value for argument "seconds" must be within [-62135596800, 253402300799] inclusive, but was: 253402300800');
    });
    (0, mocha_1.it)('validates nanoseconds', () => {
        (0, chai_1.expect)(() => new Firestore.Timestamp(0, 0.1)).to.throw('Value for argument "nanoseconds" is not a valid integer.');
        (0, chai_1.expect)(() => new Firestore.Timestamp(0, -1)).to.throw('Value for argument "nanoseconds" must be within [0, 999999999] inclusive, but was: -1');
        (0, chai_1.expect)(() => new Firestore.Timestamp(0, 1000000000)).to.throw('Value for argument "nanoseconds" must be within [0, 999999999] inclusive, but was: 1000000000');
    });
    (0, mocha_1.it)('valueOf', () => {
        (0, chai_1.expect)(new Firestore.Timestamp(-62135596677, 456).valueOf()).to.equal('000000000123.000000456');
        (0, chai_1.expect)(new Firestore.Timestamp(-62135596800, 0).valueOf()).to.equal('000000000000.000000000');
        (0, chai_1.expect)(new Firestore.Timestamp(253402300799, 1e9 - 1).valueOf()).to.equal('315537897599.999999999');
    });
    (0, mocha_1.it)('arithmetic comparison of a Timestamp object to itself', () => {
        const timestamp = new Firestore.Timestamp(1, 1);
        (0, chai_1.expect)(timestamp < timestamp).to.be.false;
        (0, chai_1.expect)(timestamp <= timestamp).to.be.true;
        (0, chai_1.expect)(timestamp > timestamp).to.be.false;
        (0, chai_1.expect)(timestamp >= timestamp).to.be.true;
    });
    (0, mocha_1.it)('arithmetic comparison of equivalent, but distinct, Timestamp objects', () => {
        const t1 = new Firestore.Timestamp(1, 1);
        const t2 = new Firestore.Timestamp(1, 1);
        (0, chai_1.expect)(t1 < t2).to.be.false;
        (0, chai_1.expect)(t1 <= t2).to.be.true;
        (0, chai_1.expect)(t1 > t2).to.be.false;
        (0, chai_1.expect)(t1 >= t2).to.be.true;
    });
    (0, mocha_1.it)('arithmetic comparison of Timestamp objects whose nanoseconds differ', () => {
        const t1 = new Firestore.Timestamp(1, 1);
        const t2 = new Firestore.Timestamp(1, 2);
        (0, chai_1.expect)(t1 < t2).to.be.true;
        (0, chai_1.expect)(t1 <= t2).to.be.true;
        (0, chai_1.expect)(t1 > t2).to.be.false;
        (0, chai_1.expect)(t1 >= t2).to.be.false;
    });
    (0, mocha_1.it)('arithmetic comparison of Timestamp objects whose seconds differ', () => {
        const t1 = new Firestore.Timestamp(100, 0);
        const t2 = new Firestore.Timestamp(200, 0);
        (0, chai_1.expect)(t1 < t2).to.be.true;
        (0, chai_1.expect)(t1 <= t2).to.be.true;
        (0, chai_1.expect)(t1 > t2).to.be.false;
        (0, chai_1.expect)(t1 >= t2).to.be.false;
    });
    (0, mocha_1.it)('arithmetic comparison of the smallest and largest Timestamp objects', () => {
        const t1 = new Firestore.Timestamp(-62135596800, 0);
        const t2 = new Firestore.Timestamp(253402300799, 999999999);
        (0, chai_1.expect)(t1 < t2).to.be.true;
        (0, chai_1.expect)(t1 <= t2).to.be.true;
        (0, chai_1.expect)(t1 > t2).to.be.false;
        (0, chai_1.expect)(t1 >= t2).to.be.false;
    });
});
//# sourceMappingURL=timestamp.js.map
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
const src_1 = require("../src");
const src_2 = require("../src");
const src_3 = require("../src");
const order = require("../src/order");
const path_1 = require("../src/path");
const helpers_1 = require("./util/helpers");
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
(0, mocha_1.describe)('Order', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    /** Converts a value into its proto representation. */
    function wrap(value) {
        const val = firestore._serializer.encodeValue(value);
        (0, chai_1.expect)(val).to.not.be.null;
        return val;
    }
    function blob(data) {
        return wrap(Buffer.from(data));
    }
    function resource(pathString) {
        return wrap(new src_3.DocumentReference(firestore, path_1.QualifiedResourcePath.fromSlashSeparatedString(pathString)));
    }
    function geopoint(lat, lng) {
        return wrap(new src_2.GeoPoint(lat, lng));
    }
    function int(n) {
        return {
            integerValue: n,
        };
    }
    function double(n) {
        return {
            doubleValue: n,
        };
    }
    (0, mocha_1.it)('throws on invalid value', () => {
        (0, chai_1.expect)(() => {
            order.compare({ valueType: 'foo' }, { valueType: 'foo' });
        }).to.throw('Unexpected value type: foo');
    });
    (0, mocha_1.it)('throws on invalid blob', () => {
        (0, chai_1.expect)(() => {
            order.compare({
                bytesValue: new Uint8Array([1, 2, 3]),
            }, {
                bytesValue: new Uint8Array([1, 2, 3]),
            });
        }).to.throw('Blobs can only be compared if they are Buffers');
    });
    (0, mocha_1.it)('compares document snapshots by name', () => {
        const docs = [
            new src_1.QueryDocumentSnapshot(firestore.doc('col/doc3'), {}, src_1.Timestamp.now(), src_1.Timestamp.now(), src_1.Timestamp.now()),
            new src_1.QueryDocumentSnapshot(firestore.doc('col/doc2'), {}, src_1.Timestamp.now(), src_1.Timestamp.now(), src_1.Timestamp.now()),
            new src_1.QueryDocumentSnapshot(firestore.doc('col/doc2'), {}, src_1.Timestamp.now(), src_1.Timestamp.now(), src_1.Timestamp.now()),
            new src_1.QueryDocumentSnapshot(firestore.doc('col/doc1'), {}, src_1.Timestamp.now(), src_1.Timestamp.now(), src_1.Timestamp.now()),
        ];
        docs.sort(firestore.collection('col').comparator());
        (0, chai_1.expect)(docs.map(doc => doc.id)).to.deep.eq([
            'doc1',
            'doc2',
            'doc2',
            'doc3',
        ]);
    });
    (0, mocha_1.it)('is correct', () => {
        const groups = [
            // null first
            [wrap(null)],
            // booleans
            [wrap(false)],
            [wrap(true)],
            // numbers
            [double(NaN), double(NaN)],
            [double(-Infinity)],
            [double(-Number.MAX_VALUE)],
            [int(Number.MIN_SAFE_INTEGER - 1)],
            [int(Number.MIN_SAFE_INTEGER)],
            [double(-1.1)],
            // Integers and Doubles order the same.
            [int(-1), double(-1.0)],
            [double(-Number.MIN_VALUE)],
            // zeros all compare the same.
            [int(0), double(0.0), double(-0)],
            [double(Number.MIN_VALUE)],
            [int(1), double(1.0)],
            [double(1.1)],
            [int(2)],
            [int(10)],
            [int(Number.MAX_SAFE_INTEGER)],
            [int(Number.MAX_SAFE_INTEGER + 1)],
            [double(Infinity)],
            // timestamps
            [wrap(new Date(2016, 5, 20, 10, 20))],
            [wrap(new Date(2016, 10, 21, 15, 32))],
            // strings
            [wrap('')],
            [wrap('\u0000\ud7ff\ue000\uffff')],
            [wrap('(╯°□°）╯︵ ┻━┻')],
            [wrap('a')],
            [wrap('abc def')],
            // latin small letter e + combining acute accent + latin small letter b
            [wrap('e\u0301b')],
            [wrap('æ')],
            // latin small letter e with acute accent + latin small letter a
            [wrap('\u00e9a')],
            // blobs
            [blob([])],
            [blob([0])],
            [blob([0, 1, 2, 3, 4])],
            [blob([0, 1, 2, 4, 3])],
            [blob([255])],
            // resource names
            [resource('projects/p1/databases/d1/documents/c1/doc1')],
            [resource('projects/p1/databases/d1/documents/c1/doc2')],
            [resource('projects/p1/databases/d1/documents/c1/doc2/c2/doc1')],
            [resource('projects/p1/databases/d1/documents/c1/doc2/c2/doc2')],
            [resource('projects/p1/databases/d1/documents/c10/doc1')],
            [resource('projects/p1/databases/d1/documents/c2/doc1')],
            [resource('projects/p2/databases/d2/documents/c1/doc1')],
            [resource('projects/p2/databases/d2/documents/c1-/doc1')],
            [resource('projects/p2/databases/d3/documents/c1-/doc1')],
            // geo points
            [geopoint(-90, -180)],
            [geopoint(-90, 0)],
            [geopoint(-90, 180)],
            [geopoint(0, -180)],
            [geopoint(0, 0)],
            [geopoint(0, 180)],
            [geopoint(1, -180)],
            [geopoint(1, 0)],
            [geopoint(1, 180)],
            [geopoint(90, -180)],
            [geopoint(90, 0)],
            [geopoint(90, 180)],
            // arrays
            [wrap([])],
            [wrap(['bar'])],
            [wrap(['foo'])],
            [wrap(['foo', 1])],
            [wrap(['foo', 2])],
            [wrap(['foo', '0'])],
            // objects
            [wrap({ bar: 0 })],
            [wrap({ bar: 0, foo: 1 })],
            [wrap({ foo: 1 })],
            [wrap({ foo: 2 })],
            [wrap({ foo: '0' })],
        ];
        for (let i = 0; i < groups.length; i++) {
            for (const left of groups[i]) {
                for (let j = 0; j < groups.length; j++) {
                    for (const right of groups[j]) {
                        let expected = order.primitiveComparator(i, j);
                        (0, chai_1.expect)(order.compare(left, right)).to.equal(expected, 'comparing ' +
                            left +
                            ' (' +
                            JSON.stringify(left) +
                            ') to ' +
                            right +
                            ' (' +
                            JSON.stringify(right) +
                            ') at (' +
                            i +
                            ', ' +
                            j +
                            ')');
                        expected = order.primitiveComparator(j, i);
                        (0, chai_1.expect)(order.compare(right, left)).to.equal(expected, 'comparing ' +
                            right +
                            ' (' +
                            JSON.stringify(right) +
                            ') to ' +
                            left +
                            ' (' +
                            JSON.stringify(left) +
                            ') at (' +
                            j +
                            ', ' +
                            i +
                            ')');
                    }
                }
            }
        }
    });
});
class StringPair {
    constructor(s1, s2) {
        this.s1 = s1;
        this.s2 = s2;
    }
}
class StringPairGenerator {
    constructor(stringGenerator) {
        this.stringGenerator = stringGenerator;
    }
    next() {
        const prefix = this.stringGenerator.next();
        const s1 = prefix + this.stringGenerator.next();
        const s2 = prefix + this.stringGenerator.next();
        return new StringPair(s1, s2);
    }
}
class StringGenerator {
    constructor(seedOrRnd, surrogatePairProbability, maxLength) {
        if (typeof seedOrRnd === 'number') {
            this.rnd = new Random(seedOrRnd);
            this.surrogatePairProbability =
                StringGenerator.DEFAULT_SURROGATE_PAIR_PROBABILITY;
            this.maxLength = StringGenerator.DEFAULT_MAX_LENGTH;
        }
        else {
            this.rnd = seedOrRnd;
            this.surrogatePairProbability = StringGenerator.validateProbability(surrogatePairProbability);
            this.maxLength = StringGenerator.validateLength(maxLength);
        }
    }
    static validateProbability(probability) {
        if (!Number.isFinite(probability)) {
            throw new Error(`invalid surrogate pair probability: ${probability} (must be between 0.0 and 1.0, inclusive)`);
        }
        else if (probability < 0.0) {
            throw new Error(`invalid surrogate pair probability: ${probability} (must be greater than or equal to zero)`);
        }
        else if (probability > 1.0) {
            throw new Error(`invalid surrogate pair probability: ${probability} (must be less than or equal to 1)`);
        }
        return probability;
    }
    static validateLength(length) {
        if (length < 0) {
            throw new Error(`invalid maximum string length: ${length} (must be greater than or equal to zero)`);
        }
        return length;
    }
    next() {
        const length = this.rnd.nextInt(this.maxLength + 1);
        const sb = new StringBuilder();
        while (sb.length() < length) {
            const codePoint = this.nextCodePoint();
            sb.appendCodePoint(codePoint);
        }
        return sb.toString();
    }
    isNextSurrogatePair() {
        return StringGenerator.nextBoolean(this.rnd, this.surrogatePairProbability);
    }
    static nextBoolean(rnd, probability) {
        if (probability === 0.0) {
            return false;
        }
        else if (probability === 1.0) {
            return true;
        }
        else {
            return rnd.nextFloat() < probability;
        }
    }
    nextCodePoint() {
        if (this.isNextSurrogatePair()) {
            return this.nextSurrogateCodePoint();
        }
        else {
            return this.nextNonSurrogateCodePoint();
        }
    }
    nextSurrogateCodePoint() {
        const highSurrogateMin = 0xd800;
        const highSurrogateMax = 0xdbff;
        const lowSurrogateMin = 0xdc00;
        const lowSurrogateMax = 0xdfff;
        const highSurrogate = this.nextCodePointRange(highSurrogateMin, highSurrogateMax);
        const lowSurrogate = this.nextCodePointRange(lowSurrogateMin, lowSurrogateMax);
        return (highSurrogate - 0xd800) * 0x400 + (lowSurrogate - 0xdc00) + 0x10000;
    }
    nextNonSurrogateCodePoint() {
        let codePoint;
        do {
            codePoint = this.nextCodePointRange(0, 0xffff); // BMP range
        } while (codePoint >= 0xd800 && codePoint <= 0xdfff); // Exclude surrogate range
        return codePoint;
    }
    nextCodePointRange(min, max) {
        const rangeSize = max - min + 1;
        const offset = this.rnd.nextInt(rangeSize);
        return min + offset;
    }
}
StringGenerator.DEFAULT_SURROGATE_PAIR_PROBABILITY = 0.33;
StringGenerator.DEFAULT_MAX_LENGTH = 20;
class Random {
    constructor(seed) {
        this.seed = seed;
    }
    nextInt(max) {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        const rnd = this.seed / 233280;
        return Math.floor(rnd * max);
    }
    nextFloat() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}
class StringBuilder {
    constructor() {
        this.buffer = [];
    }
    append(str) {
        this.buffer.push(str);
        return this;
    }
    appendCodePoint(codePoint) {
        this.buffer.push(String.fromCodePoint(codePoint));
        return this;
    }
    toString() {
        return this.buffer.join('');
    }
    length() {
        return this.buffer.join('').length;
    }
}
(0, mocha_1.describe)('CompareUtf8Strings', () => {
    (0, mocha_1.it)('compareUtf8Strings should return correct results', () => {
        const errors = [];
        const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        let passCount = 0;
        const stringGenerator = new StringGenerator(new Random(seed), 0.33, 20);
        const stringPairGenerator = new StringPairGenerator(stringGenerator);
        for (let i = 0; i < 1000000 && errors.length < 10; i++) {
            const { s1, s2 } = stringPairGenerator.next();
            const actual = order.compareUtf8Strings(s1, s2);
            const expected = Buffer.from(s1, 'utf8').compare(Buffer.from(s2, 'utf8'));
            if (actual === expected) {
                passCount++;
            }
            else {
                errors.push(`compareUtf8Strings(s1="${s1}", s2="${s2}") returned ${actual}, ` +
                    `but expected ${expected} (i=${i}, s1.length=${s1.length}, s2.length=${s2.length})`);
            }
        }
        if (errors.length > 0) {
            console.error(`${errors.length} test cases failed, ${passCount} test cases passed, seed=${seed};`);
            errors.forEach((error, index) => console.error(`errors[${index}]: ${error}`));
            throw new Error('Test failed');
        }
    }).timeout(20000);
});
//# sourceMappingURL=order.js.map
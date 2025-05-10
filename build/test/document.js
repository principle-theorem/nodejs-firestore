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
const google_gax_1 = require("google-gax");
const through2 = require("through2");
const src_1 = require("../src");
const helpers_1 = require("./util/helpers");
const PROJECT_ID = 'test-project';
const INVALID_ARGUMENTS_TO_UPDATE = new RegExp('Update\\(\\) requires either ' +
    'a single JavaScript object or an alternating list of field/value pairs ' +
    'that can be followed by an optional precondition.');
// Change the argument to 'console.log' to enable debug output.
(0, src_1.setLogFunction)(null);
(0, mocha_1.describe)('DocumentReference interface', () => {
    let firestore;
    let documentRef;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
            documentRef = firestore.doc('collectionId/documentId');
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('has collection() method', () => {
        (0, chai_1.expect)(() => documentRef.collection(42)).to.throw('Value for argument "collectionPath" is not a valid resource path. Path must be a non-empty string.');
        let collection = documentRef.collection('col');
        (0, chai_1.expect)(collection.id).to.equal('col');
        (0, chai_1.expect)(() => documentRef.collection('col/doc')).to.throw('Value for argument "collectionPath" must point to a collection, but was "col/doc". Your path does not contain an odd number of components.');
        collection = documentRef.collection('col/doc/col');
        (0, chai_1.expect)(collection.id).to.equal('col');
    });
    (0, mocha_1.it)('has path property', () => {
        (0, chai_1.expect)(documentRef.path).to.equal('collectionId/documentId');
    });
    (0, mocha_1.it)('has parent property', () => {
        (0, chai_1.expect)(documentRef.parent.path).to.equal('collectionId');
    });
    (0, mocha_1.it)('has isEqual() method', () => {
        const doc1 = firestore.doc('coll/doc1');
        const doc1Equals = firestore.doc('coll/doc1');
        const doc2 = firestore.doc('coll/doc1/coll/doc1');
        (0, chai_1.expect)(doc1.isEqual(doc1Equals)).to.be.true;
        (0, chai_1.expect)(doc1.isEqual(doc2)).to.be.false;
    });
});
(0, mocha_1.describe)('serialize document', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('serializes to Protobuf JS', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'bytes', {
                        bytesValue: Buffer.from('AG=', 'base64'),
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                bytes: Buffer.from('AG=', 'base64'),
            });
        });
    });
    (0, mocha_1.it)("doesn't serialize unsupported types", () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set({ foo: undefined });
        }).to.throw('Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "foo").');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set({
                foo: src_1.FieldPath.documentId(),
            });
        }).to.throw('Value for argument "data" is not a valid Firestore document. Cannot use object of type "FieldPath" as a Firestore value (found in field "foo").');
        (0, chai_1.expect)(() => {
            class Foo {
            }
            firestore.doc('collectionId/documentId').set({ foo: new Foo() });
        }).to.throw('Value for argument "data" is not a valid Firestore document. Couldn\'t serialize object of type "Foo" (found in field "foo"). Firestore doesn\'t support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).');
        (0, chai_1.expect)(() => {
            class Foo {
            }
            firestore
                .doc('collectionId/documentId')
                .set(new Foo());
        }).to.throw('Value for argument "data" is not a valid Firestore document. Couldn\'t serialize object of type "Foo". Firestore doesn\'t support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).');
        (0, chai_1.expect)(() => {
            class Foo {
            }
            class Bar extends Foo {
            }
            firestore
                .doc('collectionId/documentId')
                .set(new Bar());
        }).to.throw('Value for argument "data" is not a valid Firestore document. Couldn\'t serialize object of type "Bar". Firestore doesn\'t support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).');
    });
    (0, mocha_1.it)('provides custom error for objects from different Firestore instance', () => {
        class FieldPath {
        }
        class GeoPoint {
        }
        class Timestamp {
        }
        const customClasses = [new FieldPath(), new GeoPoint(), new Timestamp()];
        for (const customClass of customClasses) {
            (0, chai_1.expect)(() => {
                firestore
                    .doc('collectionId/documentId')
                    .set(customClass);
            }).to.throw('Value for argument "data" is not a valid Firestore document. ' +
                `Detected an object of type "${customClass.constructor.name}" that doesn't match the expected instance.`);
        }
    });
    (0, mocha_1.it)('serializes large numbers into doubles', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'largeNumber', {
                        doubleValue: 18014398509481984,
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                // Set to 2^54, which should be stored as a double.
                largeNumber: 18014398509481984,
            });
        });
    });
    (0, mocha_1.it)('serializes negative zero into double', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'negativeZero', {
                        doubleValue: -0,
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                // Set to -0, which should be stored as a double.
                negativeZero: -0,
            });
        });
    });
    (0, mocha_1.it)('serializes date before 1970', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'moonLanding', {
                        timestampValue: {
                            nanos: 123000000,
                            seconds: -14182920,
                        },
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                moonLanding: new Date('Jul 20 1969 20:18:00.123 UTC'),
            });
        });
    });
    (0, mocha_1.it)('supports Moment.js', () => {
        class Moment {
            toDate() {
                return new Date('Jul 20 1969 20:18:00.123 UTC');
            }
        }
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'moonLanding', {
                        timestampValue: {
                            nanos: 123000000,
                            seconds: -14182920,
                        },
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                moonLanding: new Moment(),
            });
        });
    });
    (0, mocha_1.it)('supports BigInt', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'bigIntValue', {
                        integerValue: '9007199254740992',
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                bigIntValue: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
            });
        });
    });
    (0, mocha_1.it)('serializes unicode keys', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', '😀', '😜'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                '😀': '😜',
            });
        });
    });
    (0, mocha_1.it)('accepts both blob formats', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'blob1', { bytesValue: new Uint8Array([0, 1, 2]) }, 'blob2', {
                        bytesValue: Buffer.from([0, 1, 2]),
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                blob1: new Uint8Array([0, 1, 2]),
                blob2: Buffer.from([0, 1, 2]),
            });
        });
    });
    (0, mocha_1.it)('supports NaN and Infinity', () => {
        const overrides = {
            commit: request => {
                const fields = request.writes[0].update.fields;
                (0, chai_1.expect)(fields.nanValue.doubleValue).to.be.a('number');
                (0, chai_1.expect)(fields.nanValue.doubleValue).to.be.NaN;
                (0, chai_1.expect)(fields.posInfinity.doubleValue).to.equal(Infinity);
                (0, chai_1.expect)(fields.negInfinity.doubleValue).to.equal(-Infinity);
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                nanValue: NaN,
                posInfinity: Infinity,
                negInfinity: -Infinity,
            });
        });
    });
    (0, mocha_1.it)('with invalid geopoint', () => {
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint(57.2999988, 'INVALID');
        }).to.throw('Value for argument "longitude" is not a valid number');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint('INVALID', -4.4499982);
        }).to.throw('Value for argument "latitude" is not a valid number');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint();
        }).to.throw('Value for argument "latitude" is not a valid number');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint(NaN, 0);
        }).to.throw('Value for argument "latitude" is not a valid number');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint(Infinity, 0);
        }).to.throw('Value for argument "latitude" must be within [-90, 90] inclusive, but was: Infinity');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint(91, 0);
        }).to.throw('Value for argument "latitude" must be within [-90, 90] inclusive, but was: 91');
        (0, chai_1.expect)(() => {
            new src_1.GeoPoint(90, 181);
        }).to.throw('Value for argument "longitude" must be within [-180, 180] inclusive, but was: 181');
    });
    (0, mocha_1.it)('resolves infinite nesting', () => {
        const obj = {};
        obj.foo = obj;
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update(obj);
        }).to.throw('Value for argument "dataOrField" is not a valid Firestore value. Input object is deeper than 20 levels or contains a cycle.');
    });
    (0, mocha_1.it)('is able to write a document reference with cycles', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'ref', {
                        referenceValue: `projects/${PROJECT_ID}/databases/(default)/documents/collectionId/documentId`,
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            // The Firestore Admin SDK adds a cyclic reference to the 'Firestore'
            // member of 'DocumentReference'. We emulate this behavior in this
            // test to verify that we can properly serialize DocumentReference
            // instances, even if they have cyclic references (we shouldn't try to
            // validate them beyond the instanceof check).
            const ref = firestore.doc('collectionId/documentId');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref.firestore.firestore = firestore;
            return ref.set({ ref });
        });
    });
    (0, mocha_1.it)('is able to translate FirestoreVector to internal representation with set', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'embedding1', {
                        mapValue: {
                            fields: {
                                __type__: {
                                    stringValue: '__vector__',
                                },
                                value: {
                                    arrayValue: {
                                        values: [
                                            { doubleValue: 0 },
                                            { doubleValue: 1 },
                                            { doubleValue: 2 },
                                        ],
                                    },
                                },
                            },
                        },
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                embedding1: src_1.FieldValue.vector([0, 1, 2]),
            });
        });
    });
});
(0, mocha_1.describe)('deserialize document', () => {
    (0, mocha_1.it)('deserializes Protobuf JS', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'foo', {
                    bytesValue: Buffer.from('AG=', 'base64'),
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.data()).to.deep.eq({ foo: Buffer.from('AG=', 'base64') });
            });
        });
    });
    (0, mocha_1.it)('deserializes date before 1970', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'moonLanding', {
                    timestampValue: {
                        nanos: 123000000,
                        seconds: -14182920,
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('moonLanding').toMillis()).to.equal(new Date('Jul 20 1969 20:18:00.123 UTC').getTime());
            });
        });
    });
    (0, mocha_1.it)('returns undefined for unknown fields', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId')));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('bar')).to.not.exist;
                (0, chai_1.expect)(res.get('bar.foo')).to.not.exist;
            });
        });
    });
    (0, mocha_1.it)('supports NaN and Infinity', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'nanValue', { doubleValue: NaN }, 'posInfinity', { doubleValue: Infinity }, 'negInfinity', { doubleValue: -Infinity })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('nanValue')).to.be.a('number');
                (0, chai_1.expect)(res.get('nanValue')).to.be.NaN;
                (0, chai_1.expect)(res.get('posInfinity')).to.equal(Infinity);
                (0, chai_1.expect)(res.get('negInfinity')).to.equal(-Infinity);
            });
        });
    });
    (0, mocha_1.it)('deserializes BigInt', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'bigIntValue', {
                    integerValue: '9007199254740992',
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { useBigInt: true }).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('bigIntValue')).to.be.a('bigint');
                (0, chai_1.expect)(res.get('bigIntValue')).to.equal(BigInt('9007199254740992'));
            });
        });
    });
    (0, mocha_1.it)('deserializes FirestoreVector', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'embedding', {
                    mapValue: {
                        fields: {
                            __type__: {
                                stringValue: '__vector__',
                            },
                            value: {
                                arrayValue: {
                                    values: [
                                        { doubleValue: -41.0 },
                                        { doubleValue: 0 },
                                        { doubleValue: 42 },
                                    ],
                                },
                            },
                        },
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(res => {
                (0, chai_1.expect)(res.get('embedding')).to.deep.equal(src_1.FieldValue.vector([-41.0, 0, 42]));
            });
        });
    });
    (0, mocha_1.it)("doesn't deserialize unsupported types", () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'moonLanding', {
                    valueType: 'foo',
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(doc => {
                (0, chai_1.expect)(() => {
                    doc.data();
                }).to.throw('Cannot decode type from Firestore Value: {"valueType":"foo"}');
            });
        });
    });
    (0, mocha_1.it)("doesn't deserialize invalid latitude", () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'geoPointValue', {
                    geoPointValue: {
                        latitude: 'foo',
                        longitude: -122.947778,
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(doc => {
                (0, chai_1.expect)(() => doc.data()).to.throw('Value for argument "latitude" is not a valid number.');
            });
        });
    });
    (0, mocha_1.it)("doesn't deserialize invalid longitude", () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'geoPointValue', {
                    geoPointValue: {
                        latitude: 50.1430847,
                        longitude: 'foo',
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(doc => {
                (0, chai_1.expect)(() => doc.data()).to.throw('Value for argument "longitude" is not a valid number.');
            });
        });
    });
});
(0, mocha_1.describe)('get document', () => {
    (0, mocha_1.it)('returns document', () => {
        const overrides = {
            batchGetDocuments: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.retrieve)('documentId'));
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'foo', {
                    mapValue: {
                        fields: {
                            bar: {
                                stringValue: 'foobar',
                            },
                        },
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(result => {
                (0, chai_1.expect)(result.data()).to.deep.eq({ foo: { bar: 'foobar' } });
                (0, chai_1.expect)(result.get('foo')).to.deep.eq({ bar: 'foobar' });
                (0, chai_1.expect)(result.get('foo.bar')).to.equal('foobar');
                (0, chai_1.expect)(result.get(new src_1.FieldPath('foo', 'bar'))).to.equal('foobar');
                (0, chai_1.expect)(result.ref.id).to.equal('documentId');
            });
        });
    });
    (0, mocha_1.it)('returns read, update and create times', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId')));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(result => {
                (0, chai_1.expect)(result.createTime.isEqual(new src_1.Timestamp(1, 2))).to.be.true;
                (0, chai_1.expect)(result.updateTime.isEqual(new src_1.Timestamp(3, 4))).to.be.true;
                (0, chai_1.expect)(result.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
            });
        });
    });
    (0, mocha_1.it)('returns not found', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.missing)('documentId'));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(result => {
                (0, chai_1.expect)(result.exists).to.be.false;
                (0, chai_1.expect)(result.readTime.isEqual(new src_1.Timestamp(5, 6))).to.be.true;
                (0, chai_1.expect)(result.data()).to.not.exist;
                (0, chai_1.expect)(result.get('foo')).to.not.exist;
            });
        });
    });
    (0, mocha_1.it)('throws error', done => {
        const overrides = {
            batchGetDocuments: () => {
                const error = new google_gax_1.GoogleError('RPC Error');
                error.code = google_gax_1.Status.PERMISSION_DENIED;
                return (0, helpers_1.stream)(error);
            },
        };
        (0, helpers_1.createInstance)(overrides).then(firestore => {
            firestore
                .doc('collectionId/documentId')
                .get()
                .catch(err => {
                (0, chai_1.expect)(err.message).to.equal('RPC Error');
                done();
            });
        });
    });
    (0, mocha_1.it)('cannot obtain field value without field path', () => {
        const overrides = {
            batchGetDocuments: () => {
                return (0, helpers_1.stream)((0, helpers_1.found)((0, helpers_1.document)('documentId', 'foo', {
                    mapValue: {
                        fields: {
                            bar: {
                                stringValue: 'foobar',
                            },
                        },
                    },
                })));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .get()
                .then(doc => {
                (0, chai_1.expect)(() => doc.get()).to.throw('Value for argument "field" is not a valid field path. The path cannot be omitted.');
            });
        });
    });
});
(0, mocha_1.describe)('delete document', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.remove)('documentId'));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').delete();
        });
    });
    (0, mocha_1.it)('returns update time', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.remove)('documentId'));
                return (0, helpers_1.response)({
                    commitTime: {
                        nanos: 123000000,
                        seconds: 479978400,
                    },
                    writeResults: [{}],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .delete()
                .then(res => {
                (0, chai_1.expect)(res.writeTime.isEqual(new src_1.Timestamp(479978400, 123000000))).to
                    .be.true;
            });
        });
    });
    (0, mocha_1.it)('with last update time precondition', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.remove)('documentId', {
                    updateTime: {
                        nanos: 123000000,
                        seconds: '479978400',
                    },
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            const docRef = firestore.doc('collectionId/documentId');
            return Promise.all([
                docRef.delete({
                    lastUpdateTime: new src_1.Timestamp(479978400, 123000000),
                }),
                docRef.delete({
                    lastUpdateTime: src_1.Timestamp.fromMillis(479978400123),
                }),
                docRef.delete({
                    lastUpdateTime: src_1.Timestamp.fromDate(new Date(479978400123)),
                }),
            ]);
        });
    });
    (0, mocha_1.it)('with invalid last update time precondition', () => {
        (0, chai_1.expect)(() => {
            return firestore.doc('collectionId/documentId').delete({
                lastUpdateTime: 1337,
            });
        }).to.throw('"lastUpdateTime" is not a Firestore Timestamp.');
    });
    (0, mocha_1.it)('throws if "exists" is not a boolean', () => {
        (0, chai_1.expect)(() => {
            return firestore.doc('collectionId/documentId').delete({
                exists: 42,
            });
        }).to.throw('"exists" is not a boolean.');
    });
    (0, mocha_1.it)('throws if no delete conditions are provided', () => {
        (0, chai_1.expect)(() => {
            return firestore
                .doc('collectionId/documentId')
                .delete(42);
        }).to.throw('Input is not an object.');
    });
    (0, mocha_1.it)('throws if more than one condition is provided', () => {
        (0, chai_1.expect)(() => {
            return firestore.doc('collectionId/documentId').delete({
                exists: false,
                lastUpdateTime: src_1.Timestamp.now(),
            });
        }).to.throw('Input specifies more than one precondition.');
    });
});
(0, mocha_1.describe)('set document', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('supports empty map', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({});
        });
    });
    (0, mocha_1.it)('supports nested empty map', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {},
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({ a: {} });
        });
    });
    (0, mocha_1.it)('skips merges with just field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                    transforms: [(0, helpers_1.serverTimestamp)('a'), (0, helpers_1.serverTimestamp)('b.c')],
                    mask: (0, helpers_1.updateMask)(),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                a: src_1.FieldValue.serverTimestamp(),
                b: { c: src_1.FieldValue.serverTimestamp() },
            }, { merge: true });
        });
    });
    (0, mocha_1.it)('sends empty non-merge write even with just field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                    transforms: [(0, helpers_1.serverTimestamp)('a'), (0, helpers_1.serverTimestamp)('b.c')],
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                a: src_1.FieldValue.serverTimestamp(),
                b: { c: src_1.FieldValue.serverTimestamp() },
            });
        });
    });
    (0, mocha_1.it)('supports document merges', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a', 'b', 'c', {
                        mapValue: {
                            fields: {
                                d: {
                                    stringValue: 'e',
                                },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('a', 'c.d', 'f'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .set({ a: 'b', c: { d: 'e' }, f: src_1.FieldValue.delete() }, { merge: true });
        });
    });
    (0, mocha_1.it)('supports document merges with field mask', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a', 'foo', 'b', {
                        mapValue: {
                            fields: {
                                c: {
                                    stringValue: 'foo',
                                },
                            },
                        },
                    }, 'd', {
                        mapValue: {
                            fields: {
                                e: {
                                    stringValue: 'foo',
                                },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('a', 'b', 'd.e', 'f'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                a: 'foo',
                b: { c: 'foo' },
                d: { e: 'foo', ignore: 'foo' },
                f: src_1.FieldValue.delete(),
                ignore: 'foo',
                ignoreMap: { a: 'foo' },
            }, { mergeFields: ['a', new src_1.FieldPath('b'), 'd.e', 'f'] });
        });
    });
    (0, mocha_1.it)('supports document merges with empty field mask', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                    mask: (0, helpers_1.updateMask)(),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({}, {
                mergeFields: [],
            });
        });
    });
    (0, mocha_1.it)('supports document merges with field mask and empty maps', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {
                            fields: {
                                b: {
                                    mapValue: {},
                                },
                            },
                        },
                    }, 'c', {
                        mapValue: {
                            fields: {
                                d: {
                                    mapValue: {},
                                },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('a', 'c.d'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                a: { b: {} },
                c: { d: {} },
            }, { mergeFields: ['a', new src_1.FieldPath('c', 'd')] });
        });
    });
    (0, mocha_1.it)('supports document merges with field mask and field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                    mask: (0, helpers_1.updateMask)('b', 'f'),
                    transforms: [
                        (0, helpers_1.serverTimestamp)('a'),
                        (0, helpers_1.serverTimestamp)('b.c'),
                        (0, helpers_1.serverTimestamp)('d.e'),
                    ],
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                a: src_1.FieldValue.serverTimestamp(),
                b: { c: src_1.FieldValue.serverTimestamp() },
                d: {
                    e: src_1.FieldValue.serverTimestamp(),
                    ignore: src_1.FieldValue.serverTimestamp(),
                },
                f: src_1.FieldValue.delete(),
                ignore: src_1.FieldValue.serverTimestamp(),
                ignoreMap: { a: src_1.FieldValue.serverTimestamp() },
            }, { mergeFields: ['a', new src_1.FieldPath('b'), 'd.e', 'f'] });
        });
    });
    (0, mocha_1.it)('supports empty merge', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId'),
                    mask: (0, helpers_1.updateMask)(),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({}, { merge: true });
        });
    });
    (0, mocha_1.it)('supports nested empty merge', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {},
                    }),
                    mask: (0, helpers_1.updateMask)('a'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({ a: {} }, {
                merge: true,
            });
        });
    });
    (0, mocha_1.it)('supports partials with merge', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'title', {
                        stringValue: 'story',
                    }),
                    mask: (0, helpers_1.updateMask)('title'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .withConverter(helpers_1.postConverterMerge)
                .set({ title: 'story' }, {
                merge: true,
            });
        });
    });
    (0, mocha_1.it)('supports partials with mergeFields', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'title', {
                        stringValue: 'story',
                    }),
                    mask: (0, helpers_1.updateMask)('title'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .withConverter(helpers_1.postConverterMerge)
                .set({ title: 'story', author: 'writer' }, {
                mergeFields: ['title'],
            });
        });
    });
    (0, mocha_1.it)("doesn't split on dots", () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'a.b', 'c'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').set({ 'a.b': 'c' });
        });
    });
    (0, mocha_1.it)('validates merge option', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set({ foo: 'bar' }, {
                mergeFields: ['foobar'],
            });
        }).to.throw('Input data is missing for field "foobar".');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set({ foo: 'bar' }, {
                mergeFields: ['foobar..'],
            });
        }).to.throw('Value for argument "options" is not a valid set() options argument. ' +
            '"mergeFields" is not valid: Element at index 0 is not a valid ' +
            'field path. Paths must not contain ".." in them.');
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .set({ foo: 'bar' }, { merge: true, mergeFields: [] });
        }).to.throw('Value for argument "options" is not a valid set() options argument. You cannot specify both "merge" and "mergeFields".');
    });
    (0, mocha_1.it)('requires an object', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set(null);
        }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)("doesn't support non-merge deletes", () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set({ foo: src_1.FieldValue.delete() });
        }).to.throw('Value for argument "data" is not a valid Firestore document. FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true} (found in field "foo").');
    });
    (0, mocha_1.it)("doesn't accept arrays", () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').set([42]);
        }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
});
(0, mocha_1.describe)('create document', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('creates document', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.create)({ document: (0, helpers_1.document)('documentId') }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').create({});
        });
    });
    (0, mocha_1.it)('returns update time', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.create)({ document: (0, helpers_1.document)('documentId') }));
                return (0, helpers_1.response)({
                    commitTime: {
                        nanos: 0,
                        seconds: 0,
                    },
                    writeResults: [
                        {
                            updateTime: {
                                nanos: 123000000,
                                seconds: 479978400,
                            },
                        },
                    ],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .create({})
                .then(res => {
                (0, chai_1.expect)(res.writeTime.isEqual(new src_1.Timestamp(479978400, 123000000))).to
                    .be.true;
            });
        });
    });
    (0, mocha_1.it)('supports field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.create)({
                    document: (0, helpers_1.document)('documentId'),
                    transforms: [
                        (0, helpers_1.serverTimestamp)('field'),
                        (0, helpers_1.serverTimestamp)('map.field'),
                    ],
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').create({
                field: src_1.FieldValue.serverTimestamp(),
                map: { field: src_1.FieldValue.serverTimestamp() },
            });
        });
    });
    (0, mocha_1.it)('supports nested empty map', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.create)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {
                            fields: {
                                b: {
                                    mapValue: {},
                                },
                            },
                        },
                    }),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').create({ a: { b: {} } });
        });
    });
    (0, mocha_1.it)('requires an object', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').create(null);
        }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)("doesn't accept arrays", () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').create([42]);
        }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
});
(0, mocha_1.describe)('update document', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreClient => {
            firestore = firestoreClient;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('generates proto', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({ foo: 'bar' });
        });
    });
    (0, mocha_1.it)('supports nested field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', {
                        mapValue: {},
                    }),
                    transforms: [(0, helpers_1.serverTimestamp)('a.b'), (0, helpers_1.serverTimestamp)('c.d')],
                    mask: (0, helpers_1.updateMask)('a', 'foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({
                foo: {},
                a: { b: src_1.FieldValue.serverTimestamp() },
                'c.d': src_1.FieldValue.serverTimestamp(),
            });
        });
    });
    (0, mocha_1.it)('skips write for single field transform', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId'),
                    transforms: [(0, helpers_1.serverTimestamp)('a')],
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .update('a', src_1.FieldValue.serverTimestamp());
        });
    });
    (0, mocha_1.it)('supports nested empty map', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {},
                    }),
                    mask: (0, helpers_1.updateMask)('a'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({ a: {} });
        });
    });
    (0, mocha_1.it)('supports nested delete', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({ document: (0, helpers_1.document)('documentId'), mask: (0, helpers_1.updateMask)('a.b') }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({
                'a.b': src_1.FieldValue.delete(),
            });
        });
    });
    (0, mocha_1.it)('allows explicitly specifying {exists:true} precondition', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .update('foo', 'bar', { exists: true });
        });
    });
    (0, mocha_1.it)('returns update time', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)({
                    commitTime: {
                        nanos: 0,
                        seconds: 0,
                    },
                    writeResults: [
                        {
                            updateTime: {
                                nanos: 123000000,
                                seconds: 479978400,
                            },
                        },
                    ],
                });
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .update({ foo: 'bar' })
                .then(res => {
                (0, chai_1.expect)(res.writeTime.isEqual(new src_1.Timestamp(479978400, 123000000))).to
                    .be.true;
            });
        });
    });
    (0, mocha_1.it)('with last update time precondition', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                    precondition: {
                        updateTime: {
                            nanos: 123000000,
                            seconds: '479978400',
                        },
                    },
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return Promise.all([
                firestore.doc('collectionId/documentId').update({ foo: 'bar' }, {
                    lastUpdateTime: new src_1.Timestamp(479978400, 123000000),
                }),
                firestore.doc('collectionId/documentId').update('foo', 'bar', {
                    lastUpdateTime: new src_1.Timestamp(479978400, 123000000),
                }),
            ]);
        });
    });
    (0, mocha_1.it)('with invalid last update time precondition', () => {
        (0, chai_1.expect)(() => {
            const malformedPrecondition = {
                lastUpdateTime: 'foo',
            };
            firestore
                .doc('collectionId/documentId')
                .update({ foo: 'bar' }, malformedPrecondition);
        }).to.throw('"lastUpdateTime" is not a Firestore Timestamp.');
    });
    (0, mocha_1.it)('requires at least one field', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({});
        }).to.throw('At least one field must be updated.');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update();
        }).to.throw('Function "DocumentReference.update()" requires at least 1 argument.');
    });
    (0, mocha_1.it)('rejects nested deletes', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                a: { b: src_1.FieldValue.delete() },
            });
        }).to.throw('Update() requires either a single JavaScript object or an alternating list of field/value pairs that can be followed by an optional precondition. Value for argument "dataOrField" is not a valid Firestore value. FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true} (found in field "a.b").');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update('a', {
                b: src_1.FieldValue.delete(),
            });
        }).to.throw('Update() requires either a single JavaScript object or an alternating list of field/value pairs that can be followed by an optional precondition. Element at index 1 is not a valid Firestore value. FieldValue.delete() must appear at the top-level and can only be used in update() or set() with {merge:true} (found in field "a.b").');
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .update('a', src_1.FieldValue.arrayUnion(src_1.FieldValue.delete()));
        }).to.throw('Element at index 0 is not a valid array element. FieldValue.delete() cannot be used inside of an array.');
    });
    (0, mocha_1.it)('with top-level document', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({
                foo: 'bar',
            });
        });
    });
    (0, mocha_1.it)('with nested document', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {
                            fields: {
                                b: {
                                    mapValue: {
                                        fields: {
                                            c: {
                                                stringValue: 'foobar',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }, 'foo', {
                        mapValue: {
                            fields: {
                                bar: {
                                    stringValue: 'foobar',
                                },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('a.b.c', 'foo.bar'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return Promise.all([
                firestore.doc('collectionId/documentId').update({
                    'foo.bar': 'foobar',
                    'a.b.c': 'foobar',
                }),
                firestore
                    .doc('collectionId/documentId')
                    .update('foo.bar', 'foobar', new src_1.FieldPath('a', 'b', 'c'), 'foobar'),
            ]);
        });
    });
    (0, mocha_1.it)('with two nested fields ', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', {
                        mapValue: {
                            fields: {
                                bar: { stringValue: 'two' },
                                deep: {
                                    mapValue: {
                                        fields: {
                                            bar: { stringValue: 'two' },
                                            foo: { stringValue: 'one' },
                                        },
                                    },
                                },
                                foo: { stringValue: 'one' },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('foo.bar', 'foo.deep.bar', 'foo.deep.foo', 'foo.foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return Promise.all([
                firestore.doc('collectionId/documentId').update({
                    'foo.foo': 'one',
                    'foo.bar': 'two',
                    'foo.deep.foo': 'one',
                    'foo.deep.bar': 'two',
                }),
                firestore
                    .doc('collectionId/documentId')
                    .update('foo.foo', 'one', 'foo.bar', 'two', 'foo.deep.foo', 'one', 'foo.deep.bar', 'two'),
            ]);
        });
    });
    (0, mocha_1.it)('with nested field and document transform ', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'a', {
                        mapValue: {
                            fields: {
                                b: {
                                    mapValue: {
                                        fields: {
                                            keep: {
                                                stringValue: 'keep',
                                            },
                                        },
                                    },
                                },
                                c: {
                                    mapValue: {
                                        fields: {
                                            keep: {
                                                stringValue: 'keep',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    }),
                    mask: (0, helpers_1.updateMask)('a.b.delete', 'a.b.keep', 'a.c.delete', 'a.c.keep'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({
                'a.b.delete': src_1.FieldValue.delete(),
                'a.b.keep': 'keep',
                'a.c.delete': src_1.FieldValue.delete(),
                'a.c.keep': 'keep',
            });
        });
    });
    (0, mocha_1.it)('with field with dot ', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'a.b', 'c'),
                    mask: (0, helpers_1.updateMask)('`a.b`'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('collectionId/documentId')
                .update(new src_1.FieldPath('a.b'), 'c');
        });
    });
    (0, mocha_1.it)('with conflicting update', () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                foo: 'foobar',
                'foo.bar': 'foobar',
            });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                foo: 'foobar',
                'foo.bar.foobar': 'foobar',
            });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                'foo.bar': 'foobar',
                foo: 'foobar',
            });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                'foo.bar': 'foobar',
                'foo.bar.foo': 'foobar',
            });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo.bar" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update({
                'foo.bar': { foo: 'foobar' },
                'foo.bar.foo': 'foobar',
            });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo.bar" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .update('foo.bar', 'foobar', 'foo', 'foobar');
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .update('foo', { foobar: 'foobar' }, 'foo.bar', { foobar: 'foobar' });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .update('foo', { foobar: 'foobar' }, 'foo.bar', { foobar: 'foobar' });
        }).to.throw('Value for argument "dataOrField" is not a valid update map. Field "foo" was specified multiple times.');
    });
    (0, mocha_1.it)('with valid field paths', () => {
        const validFields = ['foo.bar', '_', 'foo.bar.foobar', '\n`'];
        for (let i = 0; i < validFields.length; ++i) {
            firestore.collection('col').select(validFields[i]);
        }
    });
    (0, mocha_1.it)('with empty field path', () => {
        (0, chai_1.expect)(() => {
            const doc = { '': 'foo' };
            firestore.doc('col/doc').update(doc);
        }).to.throw('Update() requires either a single JavaScript object or an alternating list of field/value pairs that can be followed by an optional precondition. Element at index 0 should not be an empty string.');
    });
    (0, mocha_1.it)('with invalid field paths', () => {
        const invalidFields = [
            '.a',
            'a.',
            '.a.',
            'a..a',
            'a*a',
            'a/a',
            'a[a',
            'a]a',
        ];
        for (let i = 0; i < invalidFields.length; ++i) {
            (0, chai_1.expect)(() => {
                const doc = {};
                doc[invalidFields[i]] = 'foo';
                firestore.doc('col/doc').update(doc);
            }).to.throw(/Value for argument ".*" is not a valid field path/);
        }
    });
    (0, mocha_1.it)("doesn't accept argument after precondition", () => {
        (0, chai_1.expect)(() => {
            firestore.doc('collectionId/documentId').update('foo', 'bar', {
                exists: false,
            });
        }).to.throw(INVALID_ARGUMENTS_TO_UPDATE);
        (0, chai_1.expect)(() => {
            firestore
                .doc('collectionId/documentId')
                .update({ foo: 'bar' }, { exists: true }, 'foo');
        }).to.throw(INVALID_ARGUMENTS_TO_UPDATE);
    });
    (0, mocha_1.it)('accepts an object', () => {
        (0, chai_1.expect)(() => firestore.doc('collectionId/documentId').update(null)).to.throw('Value for argument "dataOrField" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)("doesn't accept arrays", () => {
        (0, chai_1.expect)(() => firestore.doc('collectionId/documentId').update([42])).to.throw('Value for argument "dataOrField" is not a valid Firestore document. Input is not a plain JavaScript object.');
    });
    (0, mocha_1.it)('with field delete', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'bar', 'foobar'),
                    mask: (0, helpers_1.updateMask)('bar', 'foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore.doc('collectionId/documentId').update({
                foo: src_1.FieldValue.delete(),
                bar: 'foobar',
            });
        });
    });
});
(0, mocha_1.describe)('listCollections() method', () => {
    (0, mocha_1.it)('sorts results', () => {
        const overrides = {
            listCollectionIds: request => {
                (0, chai_1.expect)(request).to.deep.eq({
                    parent: `projects/${PROJECT_ID}/databases/(default)/documents/coll/doc`,
                });
                return (0, helpers_1.response)(['second', 'first']);
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(firestore => {
            return firestore
                .doc('coll/doc')
                .listCollections()
                .then(collections => {
                (0, chai_1.expect)(collections[0].path).to.equal('coll/doc/first');
                (0, chai_1.expect)(collections[1].path).to.equal('coll/doc/second');
            });
        });
    });
});
(0, mocha_1.describe)('withConverter() support', () => {
    let firestore;
    (0, mocha_1.beforeEach)(() => {
        return (0, helpers_1.createInstance)().then(firestoreInstance => {
            firestore = firestoreInstance;
        });
    });
    (0, mocha_1.afterEach)(() => (0, helpers_1.verifyInstance)(firestore));
    (0, mocha_1.it)('for DocumentReference.get()', async () => {
        const doc = (0, helpers_1.document)('documentId', 'author', 'author', 'title', 'post');
        const overrides = {
            commit: request => {
                const expectedRequest = (0, helpers_1.set)({
                    document: doc,
                });
                (0, helpers_1.requestEquals)(request, expectedRequest);
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
            batchGetDocuments: () => {
                const stream = through2.obj();
                setImmediate(() => {
                    stream.push({ found: doc, readTime: { seconds: 5, nanos: 6 } });
                    stream.push(null);
                });
                return stream;
            },
        };
        return (0, helpers_1.createInstance)(overrides).then(async (firestore) => {
            const docRef = firestore
                .collection('collectionId')
                .doc('documentId')
                .withConverter(helpers_1.postConverter);
            await docRef.set(new helpers_1.Post('post', 'author'));
            const postData = await docRef.get();
            const post = postData.data();
            (0, chai_1.expect)(post).to.not.be.undefined;
            (0, chai_1.expect)(post.toString()).to.equal('post, by author');
        });
    });
    (0, mocha_1.it)('withConverter(null) applies the default converter', async () => {
        return (0, helpers_1.createInstance)().then(async (firestore) => {
            const docRef = firestore
                .collection('collectionId')
                .doc('documentId')
                .withConverter(helpers_1.postConverter)
                .withConverter(null);
            (0, chai_1.expect)(() => docRef.set(new helpers_1.Post('post', 'author'))).to.throw();
        });
    });
});
//# sourceMappingURL=document.js.map
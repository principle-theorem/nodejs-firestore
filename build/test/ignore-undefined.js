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
const query_1 = require("./query");
const helpers_1 = require("./util/helpers");
const FOO_MAP = {
    mapValue: {
        fields: {
            bar: {
                stringValue: 'bar',
            },
        },
    },
};
(0, mocha_1.describe)('ignores undefined values', () => {
    (0, mocha_1.it)('in set()', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                foo: 'foo',
                bar: undefined,
            });
        });
    });
    (0, mocha_1.it)('in set({ merge: true })', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.set)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'foo'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(firestore => {
            return firestore.doc('collectionId/documentId').set({
                foo: 'foo',
                bar: undefined,
            }, { merge: true });
        });
    });
    (0, mocha_1.it)('in create()', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.create)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(firestore => {
            return firestore.doc('collectionId/documentId').create({
                foo: 'foo',
                bar: undefined,
            });
        });
    });
    (0, mocha_1.it)('in update()', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', FOO_MAP),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(async (firestore) => {
            await firestore.doc('collectionId/documentId').update('foo', {
                bar: 'bar',
                baz: undefined,
            });
            await firestore
                .doc('collectionId/documentId')
                .update({ foo: { bar: 'bar', baz: undefined } });
        });
    });
    (0, mocha_1.it)('with top-level field in update()', () => {
        const overrides = {
            commit: request => {
                (0, helpers_1.requestEquals)(request, (0, helpers_1.update)({
                    document: (0, helpers_1.document)('documentId', 'foo', 'bar'),
                    mask: (0, helpers_1.updateMask)('foo'),
                }));
                return (0, helpers_1.response)((0, helpers_1.writeResult)(1));
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(async (firestore) => {
            await firestore.doc('collectionId/documentId').update({
                foo: 'bar',
                ignored: undefined,
            });
        });
    });
    (0, mocha_1.it)('in query filters', () => {
        const overrides = {
            runQuery: request => {
                (0, query_1.queryEquals)(request, (0, query_1.fieldFiltersQuery)('foo', 'EQUAL', FOO_MAP));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(firestore => {
            return firestore
                .collection('collectionId')
                .where('foo', '==', { bar: 'bar', baz: undefined })
                .get();
        });
    });
    (0, mocha_1.it)('in query cursors', () => {
        const overrides = {
            runQuery: request => {
                (0, query_1.queryEquals)(request, (0, query_1.orderBy)('foo', 'ASCENDING'), (0, query_1.startAt)(true, FOO_MAP));
                return (0, helpers_1.emptyQueryStream)();
            },
        };
        return (0, helpers_1.createInstance)(overrides, { ignoreUndefinedProperties: true }).then(firestore => {
            return firestore
                .collection('collectionId')
                .orderBy('foo')
                .startAt({ bar: 'bar', baz: undefined })
                .get();
        });
    });
});
(0, mocha_1.describe)('rejects undefined values', () => {
    (0, mocha_1.describe)('in top-level call', () => {
        (0, mocha_1.it)('to set()', () => {
            return (0, helpers_1.createInstance)({}, { ignoreUndefinedProperties: true }).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .doc('collectionId/documentId')
                        .set(undefined);
                }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
            });
        });
        (0, mocha_1.it)('to create()', () => {
            return (0, helpers_1.createInstance)({}, { ignoreUndefinedProperties: true }).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .doc('collectionId/documentId')
                        .create(undefined);
                }).to.throw('Value for argument "data" is not a valid Firestore document. Input is not a plain JavaScript object.');
            });
        });
        (0, mocha_1.it)('to update()', () => {
            return (0, helpers_1.createInstance)({}, { ignoreUndefinedProperties: true }).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore.doc('collectionId/documentId').update('foo', undefined);
                }).to.throw('"undefined" values are only ignored inside of objects.');
            });
        });
        (0, mocha_1.it)('to Query.where()', () => {
            return (0, helpers_1.createInstance)({}, { ignoreUndefinedProperties: true }).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .doc('collectionId/documentId')
                        .collection('collectionId')
                        .where('foo', '==', undefined);
                }).to.throw('"undefined" values are only ignored inside of objects.');
            });
        });
        (0, mocha_1.it)('to Query.startAt()', () => {
            return (0, helpers_1.createInstance)({}, { ignoreUndefinedProperties: true }).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .doc('collectionId/documentId')
                        .collection('collectionId')
                        .orderBy('foo')
                        .startAt(undefined);
                }).to.throw('"undefined" values are only ignored inside of objects.');
            });
        });
    });
    (0, mocha_1.describe)('when setting is disabled', () => {
        (0, mocha_1.it)('in set()', () => {
            return (0, helpers_1.createInstance)({}).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore.doc('collectionId/documentId').set({
                        foo: 'foo',
                        bar: undefined,
                    });
                }).to.throw('Cannot use "undefined" as a Firestore value (found in field "bar"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
            });
        });
        (0, mocha_1.it)('in create()', () => {
            return (0, helpers_1.createInstance)({}).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore.doc('collectionId/documentId').create({
                        foo: 'foo',
                        bar: undefined,
                    });
                }).to.throw('Cannot use "undefined" as a Firestore value (found in field "bar"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
            });
        });
        (0, mocha_1.it)('in update()', () => {
            return (0, helpers_1.createInstance)({}).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore.doc('collectionId/documentId').update('foo', {
                        foo: 'foo',
                        bar: undefined,
                    });
                }).to.throw('Cannot use "undefined" as a Firestore value (found in field "foo.bar"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
            });
        });
        (0, mocha_1.it)('in query filters', () => {
            return (0, helpers_1.createInstance)({}).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .collection('collectionId')
                        .where('foo', '==', { bar: 'bar', baz: undefined });
                }).to.throw('Cannot use "undefined" as a Firestore value (found in field "baz"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
            });
        });
        (0, mocha_1.it)('in query cursors', () => {
            return (0, helpers_1.createInstance)({}).then(firestore => {
                (0, chai_1.expect)(() => {
                    firestore
                        .collection('collectionId')
                        .orderBy('foo')
                        .startAt({ bar: 'bar', baz: undefined });
                }).to.throw('Cannot use "undefined" as a Firestore value (found in field "baz"). If you want to ignore undefined values, enable `ignoreUndefinedProperties`.');
            });
        });
    });
});
//# sourceMappingURL=ignore-undefined.js.map
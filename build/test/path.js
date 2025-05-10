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
const path_1 = require("../src/path");
const PROJECT_ID = 'test-project';
const DATABASE_ROOT = `projects/${PROJECT_ID}/databases/(default)`;
(0, mocha_1.describe)('ResourcePath', () => {
    (0, mocha_1.it)('has id property', () => {
        (0, chai_1.expect)(new path_1.QualifiedResourcePath(PROJECT_ID, '(default)', 'foo').id).to.equal('foo');
        (0, chai_1.expect)(new path_1.QualifiedResourcePath(PROJECT_ID, '(default)').id).to.be.null;
    });
    (0, mocha_1.it)('has append() method', () => {
        let path = new path_1.QualifiedResourcePath(PROJECT_ID, '(default)');
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents`);
        path = path.append('foo');
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents/foo`);
    });
    (0, mocha_1.it)('has parent() method', () => {
        let path = new path_1.QualifiedResourcePath(PROJECT_ID, '(default)', 'foo');
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents/foo`);
        path = path.parent();
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents`);
        (0, chai_1.expect)(path.parent()).to.be.null;
    });
    (0, mocha_1.it)('parses strings', () => {
        let path = path_1.QualifiedResourcePath.fromSlashSeparatedString(DATABASE_ROOT);
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents`);
        path = path_1.QualifiedResourcePath.fromSlashSeparatedString(`${DATABASE_ROOT}/documents/foo`);
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents/foo`);
        (0, chai_1.expect)(() => {
            path = path_1.QualifiedResourcePath.fromSlashSeparatedString('projects/project/databases');
        }).to.throw("Resource name 'projects/project/databases' is not valid");
    });
    (0, mocha_1.it)('accepts newlines', () => {
        const path = path_1.QualifiedResourcePath.fromSlashSeparatedString(`${DATABASE_ROOT}/documents/foo\nbar`);
        (0, chai_1.expect)(path.formattedName).to.equal(`${DATABASE_ROOT}/documents/foo\nbar`);
    });
});
(0, mocha_1.describe)('FieldPath', () => {
    (0, mocha_1.it)('encodes field names', () => {
        const components = [
            ['foo'],
            ['foo', 'bar'],
            ['.', '`'],
            ['\\'],
            ['\\\\'],
            ['``'],
        ];
        const results = [
            'foo',
            'foo.bar',
            '`.`.`\\``',
            '`\\\\`',
            '`\\\\\\\\`',
            '`\\`\\``',
        ];
        for (let i = 0; i < components.length; ++i) {
            (0, chai_1.expect)(new path_1.FieldPath(...components[i]).toString()).to.equal(results[i]);
        }
    });
    (0, mocha_1.it)("doesn't accept empty path", () => {
        (0, chai_1.expect)(() => {
            new path_1.FieldPath();
        }).to.throw('Function "FieldPath()" requires at least 1 argument.');
    });
    (0, mocha_1.it)('only accepts strings', () => {
        (0, chai_1.expect)(() => {
            new path_1.FieldPath('foo', 'bar', 0);
        }).to.throw('Element at index 2 is not a valid string.');
    });
    (0, mocha_1.it)('has append() method', () => {
        let path = new path_1.FieldPath('foo');
        path = path.append('bar');
        (0, chai_1.expect)(path.formattedName).to.equal('foo.bar');
    });
    (0, mocha_1.it)('has parent() method', () => {
        let path = new path_1.FieldPath('foo', 'bar');
        path = path.parent();
        (0, chai_1.expect)(path.formattedName).to.equal('foo');
    });
    (0, mocha_1.it)('escapes special characters', () => {
        const path = new path_1.FieldPath('f.o.o');
        (0, chai_1.expect)(path.formattedName).to.equal('`f.o.o`');
    });
    (0, mocha_1.it)("doesn't allow empty components", () => {
        (0, chai_1.expect)(() => {
            new path_1.FieldPath('foo', '');
        }).to.throw('Element at index 1 should not be an empty string.');
    });
    (0, mocha_1.it)('has isEqual() method', () => {
        const path = new path_1.FieldPath('a');
        const equals = new path_1.FieldPath('a');
        const notEquals = new path_1.FieldPath('a', 'b', 'a');
        (0, chai_1.expect)(path.isEqual(equals)).to.be.true;
        (0, chai_1.expect)(path.isEqual(notEquals)).to.be.false;
    });
});
//# sourceMappingURL=path.js.map
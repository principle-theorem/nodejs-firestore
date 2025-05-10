"use strict";
// Copyright 2021 Google LLC
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
function isModuleLoaded(moduleName) {
    return !!Object.keys(require.cache).find(path => path.indexOf(`node_modules/${moduleName}`) !== -1);
}
(0, mocha_1.describe)('Index.js', () => {
    (isModuleLoaded('google-gax') ? mocha_1.it.skip : mocha_1.it)('does not load google-gax', () => {
        require('../src/index');
        (0, chai_1.expect)(isModuleLoaded('google-gax')).to.be.false;
    });
    (isModuleLoaded('protobufjs') ? mocha_1.it.skip : mocha_1.it)('does not load protobufjs', () => {
        require('../src/index');
        (0, chai_1.expect)(isModuleLoaded('protobufjs')).to.be.false;
    });
});
//# sourceMappingURL=lazy-load.js.map
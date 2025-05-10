"use strict";
// Copyright 2023 Google LLC
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
const chai_1 = require("chai");
const chaiAsPromised = require("chai-as-promised");
const aggregate_1 = require("../src/aggregate");
(0, chai_1.use)(chaiAsPromised);
describe('aggregate field equality checks', () => {
    it('equates two equal aggregate fields', () => {
        (0, chai_1.expect)(aggregate_1.AggregateField.count().isEqual(aggregate_1.AggregateField.count())).to.be.true;
        (0, chai_1.expect)(aggregate_1.AggregateField.sum('foo').isEqual(aggregate_1.AggregateField.sum('foo'))).to.be
            .true;
        (0, chai_1.expect)(aggregate_1.AggregateField.average('bar').isEqual(aggregate_1.AggregateField.average('bar')))
            .to.be.true;
        (0, chai_1.expect)(aggregate_1.AggregateField.sum('foo.bar').isEqual(aggregate_1.AggregateField.sum('foo.bar')))
            .to.be.true;
        (0, chai_1.expect)(aggregate_1.AggregateField.average('bar.baz').isEqual(aggregate_1.AggregateField.average('bar.baz'))).to.be.true;
    });
    it('differentiates two different aggregate fields', () => {
        (0, chai_1.expect)(aggregate_1.AggregateField.sum('foo').isEqual(aggregate_1.AggregateField.sum('bar'))).to.be
            .false;
        (0, chai_1.expect)(aggregate_1.AggregateField.average('foo').isEqual(aggregate_1.AggregateField.average('bar')))
            .to.be.false;
        (0, chai_1.expect)(aggregate_1.AggregateField.average('foo').isEqual(aggregate_1.AggregateField.sum('foo'))).to
            .be.false;
        (0, chai_1.expect)(aggregate_1.AggregateField.sum('foo').isEqual(aggregate_1.AggregateField.average('foo'))).to
            .be.false;
    });
});
//# sourceMappingURL=aggregate.js.map
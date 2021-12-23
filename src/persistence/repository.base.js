'use strict';

import { v1 } from 'uuid';


export class RepositoryBase {
  _model;

  constructor(schemaModel) {
    this._model = schemaModel;
  }

  getModel() {
    return this._model;
  }

  async create(item) {
    try {
      const self = this;
      const x = await self._model.create(item);
      return x;
    } catch (e) {
      console.error(e);
    }
  }

  async retrieve(){
    const self = this;
    return await self._model.find({});
  }

  async findById(id) {
    const self = this;
    return await self._model.findById(id);
  }

  async findOne(cond, fields, options) {
    const self = this;

    return await self._model.findOne(cond, fields, options);
  }

  async find(
    cond,
    fields,
    options,
    sortOptions,
  ){
    let query = this._model.find(cond, fields, options);
    if (sortOptions) {
      query = query.sort(sortOptions);
    }
    return await query.exec();
  }

  async count(cond) {
    const self = this;
    return await self._model.count(cond);
  }

  save(item) {
    return item.save(item);
  }

  async upsert(cond, item){
    const self = this;
    const options = {
      upsert: true,
      new: true,
    };
    if (!item._id) {
      item['$setOnInsert'] = { _id: v1() };
    }
    return await self._model.findOneAndUpdate(cond, item, options);
  }

  async delete(_id) {
    const self = this;
    return await self._model.remove({ _id: _id });
  }

  async deleteAll() {
    const self = this;
    return await self._model.remove({});
  }
}

import {v4} from "uuid"
import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();
class BaseRepository {
  /**
   * @type {Model}
   * @private
   */
  _model;

  /**
   *
   * @param { Model} schemaModel
   */
  constructor(schemaModel) {
    this._model = schemaModel;
  }

  getModel() {
    return this._model;
  }

  async create(item) {
    try {
      Logger.trace(`Base repository: creating item ${JSON.stringify(item)}`);
      return await this._model.create(item);
    } catch (e) {
      Logger.error(e);
    }
  }

  async retrieve(){
    return this._model.find({});
  }

  async findById(id) {
    Logger.trace(`Base repository: find by id: ${id}`);
    return this._model.findById(id);
  }

  async findOne(cond, fields, options) {
    Logger.trace(`Base repository: find One: cond:${JSON.stringify(cond)}`);
    return this._model.findOne(cond, fields, options);
  }

  async find(
    cond,
    fields,
    options,
    sortOptions,
  ){
    Logger.trace(`Base repository: find: cond:${JSON.stringify(cond)}`);
    let query = this._model.find(cond, fields, options);
    if (sortOptions) {
      query = query.sort(sortOptions);
    }
    return await query.exec();
  }

  async count(cond) {
    Logger.trace(`Base repository: count: cond:${JSON.stringify(cond)}`);
    return this._model.count(cond);
  }

  async upsert(cond, item){
    Logger.trace(`Base repository: upsert: cond:${JSON.stringify(cond)}, item : ${JSON.stringify(item)}`);
    const options = {
      upsert: true,
      new: true,
    };
    if (!item._id) {
      item['$setOnInsert'] = { _id: v4() };
    }
    return  this._model.findOneAndUpdate(cond, item, options);
  }

  async delete(_id) {
    Logger.trace(`Base repository: delete: id:${_id}`);
    return this._model.remove({ _id: _id });
  }

  async deleteAll() {
    Logger.trace(`Base repository: delete all`);
    return this._model.remove({});
  }
}

export  default BaseRepository;
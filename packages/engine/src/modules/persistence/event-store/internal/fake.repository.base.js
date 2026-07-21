'use strict';



export class FakeRepositoryBase {
  objects = []
  constructor() {
  }


  async create(item) {
    try {
      this.objects.push(item);
      return item;
    } catch (e) {
      console.error(e);
    }
  }



  async findById(id) {
    return this.objects.find(e=> e._id === id);
  }

  async findOne(cond = {}, fields, options = {}) {
    let results = this.objects.filter(o =>
      Object.entries(cond).every(([k, v]) => o[k] === v)
    );
    if (options.sort) {
      const [field, dir] = Object.entries(options.sort)[0];
      results = [...results].sort((a, b) => (a[field] - b[field]) * dir);
    }
    return results.length > 0 ? results[0] : null;
  }

  async find(
    cond = {},
    fields,
    options,
    sortOptions,
  ){
    let results = this.objects.filter(o =>
      Object.entries(cond).every(([k, v]) => o[k] === v)
    );
    if (sortOptions) {
      const [field, dir] = Object.entries(sortOptions)[0];
      results = [...results].sort((a, b) => (a[field] - b[field]) * dir);
    }
    return results;
  }

  async retrieve() {
    return this.objects;
  }

  async createMany(items) {
    this.objects.push(...items);
    return items;
  }

  async dumpAll() {
    return [...this.objects];
  }

  async restoreAll(docs) {
    this.objects = docs ? [...docs] : [];
  }

  // supports the {updateOne: {filter, update: {$set, $setOnInsert}, upsert}} shape
  // BaseRepository.bulkWrite callers use (see VariableRepository)
  async bulkWrite(operations) {
    operations.forEach(({updateOne}) => {
      const {filter, update, upsert} = updateOne;
      let match = this.objects.find(o =>
        Object.entries(filter).every(([k, v]) => o[k] === v)
      );
      if (!match) {
        if (!upsert) {
          return;
        }
        match = {...(update['$setOnInsert'] || {})};
        this.objects.push(match);
      }
      Object.assign(match, update['$set'] || {});
    });
  }

  async count(cond) {

    return this.objects.length;
  }

  save(item) {
    return this.objects.push(item);
  }

  async upsert(cond, item){
    const self = this;
    const options = {
      upsert: true,
      new: true,
    };
    throw `not implemented`
  }

  async delete(id) {
    this.objects = this.objects.filter(e=> e._id !== id)
  }

  async deleteAll() {
    this.objects=[];
  }
}

export default FakeRepositoryBase;
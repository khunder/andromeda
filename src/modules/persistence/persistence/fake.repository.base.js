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
    return this.objects.find(e=> e.id === id)[0];
  }

  async findOne(cond, fields, options) {
    throw `not implemented`
  }

  async find(
    cond,
    fields,
    options,
    sortOptions,
  ){
    throw `not implemented`
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
    this.objects = this.objects.filter(e=> e.id !== id)
  }

  async deleteAll() {
    this.objects=[];
  }
}

export default FakeRepositoryBase;
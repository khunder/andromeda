// External Dependancies
const mongoose = require("mongoose");

const processInstanceSchema = new mongoose.Schema({
  title: String,
  brand: String,
  price: String,
  age: Number,
  services: {
    type: Map,
    of: String
  }
})

const ProcessInstance = mongoose.model('ProcessInstance', processInstanceSchema)

module.exports = ProcessInstance;
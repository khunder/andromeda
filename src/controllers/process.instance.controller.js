import boom from "@hapi/boom";
import {ProcessInstance} from "../persistence/models/process.instance.js";
import {RepositoryBase} from "../persistence/repository.base.js";
import {Engine} from "../modules/engine.js";
import {ContainerContext} from "../model/container.context.js";



export const getProcessInstances = async (req, reply) => {
  try {
    let wwp = await new RepositoryBase(ProcessInstance).find({})
    const ProcessInstances = await ProcessInstance.find()
    return ProcessInstances
  } catch (err) {
    throw boom.boomify(err)
  }
}
//
// export const getSingleProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = await ProcessInstance.findById(id)
//     return ProcessInstance
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const addProcessInstance = async (req, reply) => {
//   try {
//     const ProcessInstance = new ProcessInstance(req.body)
//     return ProcessInstance.save()
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const updateProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = req.body
//     const { ...updateData } = ProcessInstance
//     const update = await ProcessInstance.findByIdAndUpdate(id, updateData, { new: true })
//     return update
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const deleteProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = await ProcessInstance.findByIdAndRemove(id)
//     return ProcessInstance
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
// export const getSingleProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = await ProcessInstance.findById(id)
//     return ProcessInstance
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const addProcessInstance = async (req, reply) => {
//   try {
//     const ProcessInstance = new ProcessInstance(req.body)
//     return ProcessInstance.save()
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const updateProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = req.body
//     const { ...updateData } = ProcessInstance
//     const update = await ProcessInstance.findByIdAndUpdate(id, updateData, { new: true })
//     return update
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }
//
// export const deleteProcessInstance = async (req, reply) => {
//   try {
//     const id = req.params.id
//     const ProcessInstance = await ProcessInstance.findByIdAndRemove(id)
//     return ProcessInstance
//   } catch (err) {
//     throw boom.boomify(err)
//   }
// }

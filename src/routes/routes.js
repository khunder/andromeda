// Import our Controllers
// const processInstanceController = require('../controllers/process.instance.controller')
// const {addProcessInstanceSchema} = require("./documentation/process.instance.api");



import * as processInstanceController from "../controllers/process.instance.controller.js";
import {addProcessInstanceSchema} from "./documentation/process.instance.api.js";

export const routes = [
  {
    method: 'GET',
    url: '/',
    handler: (req, res) => {
      res.redirect('/api')
    }
  },
  {
    method: 'GET',
    url: '/api/processInstances',
    handler: processInstanceController.getProcessInstances
  },
  {
    method: 'GET',
    url: '/api/processInstances/:id',
    handler: processInstanceController.getSingleProcessInstance
  },
  {
    method: 'POST',
    url: '/api/processInstances',
    handler: processInstanceController.addProcessInstance,
    schema: addProcessInstanceSchema
  },
  {
    method: 'PUT',
    url: '/api/processInstances/:id',
    handler: processInstanceController.updateProcessInstance
  },
  {
    method: 'DELETE',
    url: '/api/processInstances/:id',
    handler: processInstanceController.deleteProcessInstance
  }
]


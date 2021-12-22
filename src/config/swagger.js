import {constants} from "./constants.js";

export const options = {
  routePrefix: '/api',
  exposeRoute: true,
  swagger: {
    info: {
      title: `${constants.APP_NAME} API`,
      description: 'BPMN Engine made for the cloud era',
      version: '1.0.0'
    },
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
}

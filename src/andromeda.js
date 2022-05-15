/**
 * @Module Andromeda
 * Universally unique identifier.
 * @typedef {string} UUID
 **/

/**
 * @typedef NodeContextArgs
 * @type {object}
 * @property {boolean} executeBody - enable body execution
 * @property {boolean} twoPhaseComponent - specify of the current component can be executed on two phases,
 * Human tasks, catch event and any component that can wait until a certain condition is fulfilled or a human intervention
 * is a two phase component, the first phase is the initialization, the second if the read execution.
 */


/**
 * @typedef NodeContext
 * @type {object}
 * @property {string} id - ID of the node context (bpmn id)
 * @property {string} name - name of the node if
 * @property {string} type - type of the node context
 * @property {ts-morph.ConditionalExpression} conditionExpression - condition to execute the node
 * @property {NodeContextArgs} args - object used to customize code generation by controlling various bpmn processor
 * @property {string} body - body of the method to construct
 */

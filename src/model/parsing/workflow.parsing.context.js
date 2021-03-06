/**
 * Model used for bpmn parsing
 */
class WorkflowParsingContext {
    model;
    bpmnContent;
    processPrefix;

    constructor(config) {
        this.model = config && config.model;
        this.bpmnContent = config && config.bpmnContent;
        this.processPrefix = config && config.processPrefix;
    }
}

export  default WorkflowParsingContext
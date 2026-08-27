/**
 * Model used for bpmn parsing
 */
export class WorkflowParsingContext {
    model;
    bpmnContent;
    processPrefix;
    // <bpmn:definitions version="..."> read off this workflow's own XML, default '1.0.0'
    version;

    constructor(config) {
        this.model = config && config.model;
        this.bpmnContent = config && config.bpmnContent;
        this.processPrefix = config && config.processPrefix;
        this.version = config && config.version;
    }
}


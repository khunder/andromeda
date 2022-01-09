const ContainerCodegenContext = require("./container.codegen.context");

class WorkflowCodegenContext {

    processId
    containerCodegenContext


    constructor(containerCodegenContext) {
        this.containerCodegenContext = containerCodegenContext;
    }
}

module.exports = WorkflowCodegenContext;
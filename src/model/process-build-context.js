const ContainerBuildContext = require("./container-build-context");

class ProcessBuildContext {
    static containerBuildContext = new ContainerBuildContext();
    processId

}

module.exports = ProcessBuildContext;
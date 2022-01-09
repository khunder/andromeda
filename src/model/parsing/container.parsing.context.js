
class ContainerParsingContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.workflowParsingContext= [];
  }

  isTestContainer;
  deploymentId;
  workflowParsingContext;

}

module.exports = ContainerParsingContext
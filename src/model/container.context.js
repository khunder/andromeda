
class ContainerContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.model = config && config.model;
    this.bpmnContent = config && config.bpmnContent;
    this.processPrefix = config && config.processPrefix;
  }

  isTestContainer;
  deploymentId;
  model;
  bpmnContent;
  processPrefix;
}

module.exports = ContainerContext
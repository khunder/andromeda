
class ContainerContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.model = config && config.model;
  }

  isTestContainer;
  deploymentId;
  model;
}

module.exports = ContainerContext
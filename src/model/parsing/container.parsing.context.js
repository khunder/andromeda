/**
 * Model used using container code-gen phase
 */
class ContainerParsingContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.workflowParsingContext= [];
  }

  isTestContainer;
  includeGalaxyModule;
  deploymentId;
  workflowParsingContext;

}

export  default  ContainerParsingContext
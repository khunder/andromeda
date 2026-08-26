/**
 * Model used using container code-gen phase
 */
export class ContainerParsingContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.version = config && config.version;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.workflowParsingContext= [];
  }

  isTestContainer;
  includeGalaxyModule;
  includeWebModule;
  includePersistenceModule;
  deploymentId;
  version;
  workflowParsingContext;

}


/**
 * Model used using container code-gen phase
 */
export class ContainerParsingContext {
  constructor(config) {
    this.deploymentId = config && config.deploymentId;
    this.port = config && config.port;
    this.isTestContainer = config && config.isTestContainer;
    this.workflowParsingContext= [];
  }

  isTestContainer;
  includeGalaxyModule;
  includeWebModule;
  includePersistenceModule;
  deploymentId;
  // raw, client-supplied id (before the resolved version suffix is folded into deploymentId)
  baseDeploymentId;
  version;
  workflowParsingContext;

}


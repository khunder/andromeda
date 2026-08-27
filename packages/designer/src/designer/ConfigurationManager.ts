/**
 * Configuration Manager for BPMN Designer
 * Handles storing and retrieving configuration settings using localStorage
 */

export interface EngineConfiguration {
  url: string;
  galaxyUrl?: string;
  deploymentId?: string;
  lastUsedDeploymentId?: string;
  version?: string;
  resolvedDeploymentId?: string;
}

export class ConfigurationManager {
  private static readonly STORAGE_KEY = 'bpmn-designer-config';
  private static readonly DEFAULT_ENGINE_URL = 'http://127.0.0.1:5000';
  private static readonly DEFAULT_GALAXY_URL = 'http://127.0.0.1:5001';
  private static readonly DEFAULT_VERSION = '1.0.0';
  
  private config: EngineConfiguration;
  
  constructor() {
    this.config = this.loadConfiguration();
  }
  
  /**
   * Load configuration from localStorage or use defaults
   */
  private loadConfiguration(): EngineConfiguration {
    try {
      const stored = localStorage.getItem(ConfigurationManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          url: parsed.url || ConfigurationManager.DEFAULT_ENGINE_URL,
          deploymentId: parsed.deploymentId,
          lastUsedDeploymentId: parsed.lastUsedDeploymentId,
          galaxyUrl: parsed.galaxyUrl || ConfigurationManager.DEFAULT_GALAXY_URL,
          version: parsed.version || ConfigurationManager.DEFAULT_VERSION,
          resolvedDeploymentId: parsed.resolvedDeploymentId
        };
      }
    } catch (error) {
      console.warn('Failed to load configuration:', error);
    }

    return {
      url: ConfigurationManager.DEFAULT_ENGINE_URL,
      deploymentId: '',
      lastUsedDeploymentId: '',
      galaxyUrl: ConfigurationManager.DEFAULT_GALAXY_URL,
      version: ConfigurationManager.DEFAULT_VERSION,
      resolvedDeploymentId: ''
    };
  }
  
  /**
   * Save configuration to localStorage
   */
  private saveConfiguration(): void {
    try {
      localStorage.setItem(ConfigurationManager.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
  
  /**
   * Get the engine URL
   */
  getEngineUrl(): string {
    return this.config.url;
  }
  
  /**
   * Set the engine URL
   */
  setEngineUrl(url: string): void {
    this.config.url = url || ConfigurationManager.DEFAULT_ENGINE_URL;
    this.saveConfiguration();
  }
  
  /**
   * Get the current deployment ID
   */
  getDeploymentId(): string {
    return this.config.deploymentId || '';
  }
  
  /**
   * Set the deployment ID
   */
  setDeploymentId(id: string): void {
    this.config.deploymentId = id;
    if (id) {
      this.config.lastUsedDeploymentId = id;
    }
    this.saveConfiguration();
  }
  
  /**
   * Get the last used deployment ID
   */
  getLastUsedDeploymentId(): string {
    return this.config.lastUsedDeploymentId || '';
  }

  /**
   * Get the current version (defaults to 1.0.0)
   */
  getVersion(): string {
    return this.config.version || ConfigurationManager.DEFAULT_VERSION;
  }

  /**
   * Set the version
   */
  setVersion(version: string): void {
    this.config.version = version || ConfigurationManager.DEFAULT_VERSION;
    this.saveConfiguration();
  }

  /**
   * Get the resolved deployment id (the actual versioned deployment folder id
   * returned by the engine from the last successful /api/compile) - distinct
   * from getDeploymentId(), which is the raw id typed into "Container ID".
   * Used to target Run/Stop Embedded at the right folder.
   */
  getResolvedDeploymentId(): string {
    return this.config.resolvedDeploymentId || '';
  }

  /**
   * Set the resolved deployment id
   */
  setResolvedDeploymentId(id: string): void {
    this.config.resolvedDeploymentId = id;
    this.saveConfiguration();
  }
  
  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = {
      url: ConfigurationManager.DEFAULT_ENGINE_URL,
      deploymentId: '',
      lastUsedDeploymentId: this.config.lastUsedDeploymentId,
      galaxyUrl: ConfigurationManager.DEFAULT_GALAXY_URL,
      version: ConfigurationManager.DEFAULT_VERSION,
      resolvedDeploymentId: ''
    };
    this.saveConfiguration();
  }

  getGalaxyUrl(): string {
    return this.config.galaxyUrl || ConfigurationManager.DEFAULT_GALAXY_URL;
  }
  setGalaxyUrl(url: string): void {
    this.config.galaxyUrl = url || ConfigurationManager.DEFAULT_GALAXY_URL;
    this.saveConfiguration();
  }
  
  /**
   * Get full API endpoint for compilation
   */
  getCompileEndpoint(): string {
    const baseUrl = (this.config.url || ConfigurationManager.DEFAULT_ENGINE_URL).replace(/\/$/, '');
    return `${baseUrl}/api/compile`;
  }

  getRunEmbeddedEndpoint(): string {
    const baseUrl = (this.config.url || ConfigurationManager.DEFAULT_ENGINE_URL).replace(/\/$/, '');
    return `${baseUrl}/api/run-embedded`;
  }

  getStopEmbeddedEndpoint(): string {
    const baseUrl = (this.config.url || ConfigurationManager.DEFAULT_ENGINE_URL).replace(/\/$/, '');
    return `${baseUrl}/api/stop-embedded`;
  }
}


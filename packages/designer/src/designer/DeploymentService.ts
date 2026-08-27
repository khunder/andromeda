/**
 * Deployment Service for BPMN Designer
 * Handles deploying BPMN XML to the Andromeda engine
 */

import { ConfigurationManager } from './ConfigurationManager';

export interface DeploymentResult {
  success: boolean;
  message: string;
  details?: any;
}

export class DeploymentService {
  private configManager: ConfigurationManager;
  
  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  async runEmbedded(deploymentId: string): Promise<DeploymentResult> {
    const endpoint = this.configManager.getRunEmbeddedEndpoint();
    try {
      const formData = new FormData();
      formData.append('deploymentId', deploymentId);

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        headers: {
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        return { success: true, message: `Run embedded triggered for ${deploymentId}` };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Run embedded failed (HTTP ${response.status}): ${errorText}` };
      }
    } catch (error) {
      return { success: false, message: `Run embedded failed: ${error instanceof Error ? error.message : 'Unknown error'}`, details: error };
    }
  }

  async stopEmbedded(deploymentId: string, port: number | string): Promise<DeploymentResult> {
    const endpoint = this.configManager.getStopEmbeddedEndpoint();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deploymentId, port })
      });

      if (response.ok) {
        return { success: true, message: `Stopped ${deploymentId}` };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Stop failed (HTTP ${response.status}): ${errorText}` };
      }
    } catch (error) {
      return { success: false, message: `Stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`, details: error };
    }
  }

  /**
   * Deploy BPMN XML to the Andromeda engine
   */
  async deploy(bpmnXml: string, deploymentId?: string): Promise<DeploymentResult> {
    const finalDeploymentId = deploymentId || this.configManager.getDeploymentId() || 'default-deployment';
    const endpoint = this.configManager.getCompileEndpoint();
    
    try {
      // Create form data with BPMN file and deployment ID
      const formData = new FormData();
      
      // Create a Blob from the BPMN XML
      const bpmnBlob = new Blob([bpmnXml], { type: 'application/xml' });
      
      // Append the BPMN file
      formData.append('bpmnFile', bpmnBlob, 'diagram.bpmn');
      
      // Append the deployment ID
      formData.append('deploymentId', finalDeploymentId);
      
      console.log(`Deploying BPMN to ${endpoint} with deployment ID: ${finalDeploymentId}`);
      
      // Send the request
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        mode: 'cors', // Explicitly set CORS mode
        // Don't set Content-Type header - let the browser set it with the boundary
        headers: {
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Check if the response is ok
      if (response.ok) {
        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: responseText };
        }
        
        // Save the deployment ID for future use
        this.configManager.setDeploymentId(finalDeploymentId);

        // the engine folds the resolved version into the folder name, so
        // Run/Stop Embedded need this resolved id rather than finalDeploymentId
        if (responseData?.deploymentId) {
          this.configManager.setResolvedDeploymentId(responseData.deploymentId);
        }

        return {
          success: true,
          message: `Successfully deployed BPMN with ID: ${finalDeploymentId}`,
          details: responseData
        };
      } else {
        const errorText = await response.text();
        let errorData;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        return {
          success: false,
          message: `Deployment failed (HTTP ${response.status}): ${errorData.error || errorData.message || errorText}`,
          details: errorData
        };
      }
    } catch (error) {
      console.error('Deployment error:', error);

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return {
          success: false,
          message: `Cannot connect to engine at ${endpoint}. Please check the configuration and ensure the engine is running.`,
          details: error
        };
      }
      
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }
  
  /**
   * Start a new process instance on a running container, optionally with variables.
   * Caller supplies host/port directly (e.g. from a Galaxy registry list entry).
   *
   * `processDef` names which workflow to start (routes are namespaced
   * /{processDef}/start since a container can now hold more than one BPMN
   * workflow) - pass '' for containers generated before that namespacing
   * existed, which still only serve a bare /start.
   */
  async startProcessInstance(host: string, port: string | number, deploymentId: string, processDef: string, variables?: Record<string, unknown>): Promise<DeploymentResult> {
    try {
      const formData = new FormData();
      formData.append('variables', JSON.stringify(variables || {}));

      const startPath = processDef ? `/${processDef}/start` : '/start';
      const response = await fetch(`http://${host}:${port}${startPath}`, {
        method: 'POST',
        body: formData,
        mode: 'cors'
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: true, message: `Process instance started on ${deploymentId}: ${data.id || 'ok'}`, details: data };
      }

      const errorText = await response.text();
      return { success: false, message: `Start failed (HTTP ${response.status}): ${errorText}` };
    } catch (error) {
      return {
        success: false,
        message: `Start failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  /**
   * Create multipart form data boundary
   */
  private createBoundary(): string {
    return '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  }
  
  /**
   * Create multipart form data manually (alternative method if FormData doesn't work)
   */
  private createMultipartFormData(bpmnXml: string, deploymentId: string, boundary: string): string {
    let data = '';
    
    // Add BPMN file part
    data += `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="bpmnFile"; filename="diagram.bpmn"\r\n`;
    data += `Content-Type: application/xml\r\n\r\n`;
    data += bpmnXml + '\r\n';
    
    // Add deployment ID part
    data += `--${boundary}\r\n`;
    data += `Content-Disposition: form-data; name="deploymentId"\r\n\r\n`;
    data += deploymentId + '\r\n';
    
    // End boundary
    data += `--${boundary}--\r\n`;
    
    return data;
  }
  
  /**
   * Deploy using manual multipart form data (fallback method)
   */
  async deployManual(bpmnXml: string, deploymentId?: string): Promise<DeploymentResult> {
    const finalDeploymentId = deploymentId || this.configManager.getDeploymentId() || 'default-deployment';
    const endpoint = this.configManager.getCompileEndpoint();
    const boundary = this.createBoundary();
    
    try {
      const formData = this.createMultipartFormData(bpmnXml, finalDeploymentId, boundary);
      
      console.log(`Deploying BPMN to ${endpoint} with deployment ID: ${finalDeploymentId} (manual method)`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Accept': '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: formData
      });
      
      if (response.ok) {
        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { message: responseText };
        }
        
        this.configManager.setDeploymentId(finalDeploymentId);
        if (responseData?.deploymentId) {
          this.configManager.setResolvedDeploymentId(responseData.deploymentId);
        }

        return {
          success: true,
          message: `Successfully deployed BPMN with ID: ${finalDeploymentId}`,
          details: responseData
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `Deployment failed (HTTP ${response.status}): ${errorText}`,
          details: { status: response.status, error: errorText }
        };
      }
    } catch (error) {
      console.error('Deployment error:', error);
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }
}

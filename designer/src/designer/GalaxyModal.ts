import { DeploymentService } from './DeploymentService';

export class GalaxyModal extends HTMLElement {
    private shadow: ShadowRoot;
    private galaxyUrl: string = '';
    private deploymentService: DeploymentService | null = null;
    private items: any[] = [];

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.addEventListeners();
    }

    setGalaxyUrl(url: string) {
        this.galaxyUrl = url;
    }

    setDeploymentService(deploymentService: DeploymentService) {
        this.deploymentService = deploymentService;
    }

    async load() {
        if (!this.galaxyUrl) return;
        
        const listDiv = this.shadow.getElementById('galaxy-list');
        if (listDiv) listDiv.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const res = await fetch(`${this.galaxyUrl}/galaxy/containers`);
            const data = await res.json();
            this.items = data;
            this.updateList();
        } catch (e) {
            if (listDiv) listDiv.innerHTML = `<div class="error">Cannot reach Galaxy at ${this.galaxyUrl}</div>`;
        }
    }

    private updateList() {
        const listDiv = this.shadow.getElementById('galaxy-list');
        if (!listDiv) return;

        if (!this.items || this.items.length === 0) {
            listDiv.innerHTML = '<div class="empty">No containers registered.</div>';
            return;
        }

        listDiv.innerHTML = `
            <div class="list-container">
                ${this.items.map(i => `
                    <div class="item">
                        <div class="item-info">
                            <div class="item-id"><strong>${i.deploymentId}</strong></div>
                            <div class="item-meta">port: ${i.port} • lastSeen: ${new Date(i.lastSeen).toLocaleTimeString()}</div>
                        </div>
                        <div class="item-actions">
                            <div class="item-status status-${i.status === 'ready' ? 'ready' : 'error'}">
                                ${i.status || 'unknown'}
                            </div>
                            <button class="btn btn-stop" data-deployment-id="${i.deploymentId}" data-port="${i.port}">Stop</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async clearRegistry() {
        if (!this.galaxyUrl) return;
        try {
            await fetch(`${this.galaxyUrl}/galaxy/clear`, { method: 'POST' });
            await this.load();
        } catch (e) {
            /* ignore */
        }
    }

    async stopContainer(deploymentId: string, port: string) {
        if (!this.deploymentService) {
            alert('Engine connection is not configured, cannot stop container.');
            return;
        }
        const result = await this.deploymentService.stopEmbedded(deploymentId, port);
        if (!result.success) {
            alert(result.message);
            return;
        }
        if (this.galaxyUrl) {
            try {
                await fetch(`${this.galaxyUrl.replace(/\/$/, '')}/galaxy/remove`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deploymentId, port })
                });
            } catch (e) { /* ignore, list refresh will just show it unreachable */ }
        }
        await this.load();
    }

    private addEventListeners() {
        const closeBtn = this.shadow.querySelector('.close-btn');
        const overlay = this.shadow.querySelector('.overlay');
        const footerCloseBtn = this.shadow.getElementById('btn-close');
        const clearBtn = this.shadow.getElementById('galaxy-clear');
        const listDiv = this.shadow.getElementById('galaxy-list');

        const close = () => {
            this.remove();
        };

        closeBtn?.addEventListener('click', close);
        overlay?.addEventListener('click', close);
        footerCloseBtn?.addEventListener('click', close);

        clearBtn?.addEventListener('click', () => this.clearRegistry());

        listDiv?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('btn-stop')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                void this.stopContainer(deploymentId, port);
            }
        });
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                
                .overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(2px);
                }
                
                .modal {
                    position: relative;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    width: 90%;
                    max-width: 800px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideIn 0.2s ease-out;
                }
                
                @keyframes slideIn {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .header {
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8f9fa;
                }
                
                .header h2 {
                    margin: 0;
                    font-size: 20px;
                    color: #333;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                
                .close-btn:hover {
                    background: #e0e0e0;
                    color: #333;
                }
                
                .body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                    min-height: 300px;
                }
                
                .footer {
                    padding: 15px 20px;
                    border-top: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8f9fa;
                }
                
                .btn {
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }
                
                .btn-secondary {
                    background: white;
                    color: #666;
                    border-color: #ddd;
                }
                
                .btn-secondary:hover {
                    background: #f5f5f5;
                    border-color: #ccc;
                }
                
                .list-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .item {
                    padding: 12px;
                    border: 1px solid #eee;
                    border-radius: 6px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.2s, transform 0.1s;
                }
                
                .item:hover {
                    background: #fcfcfc;
                    border-color: #e0e0e0;
                    transform: translateX(2px);
                }
                
                .item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .item-id {
                    font-size: 15px;
                    color: #333;
                }
                
                .item-meta {
                    font-size: 12px;
                    color: #777;
                }
                
                .item-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .item-status {
                    font-size: 13px;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 12px;
                    background: #eee;
                }

                .btn-stop {
                    background: white;
                    color: #c62828;
                    border-color: #f3c0c0;
                }

                .btn-stop:hover {
                    background: #ffebee;
                    border-color: #c62828;
                }
                
                .status-ready {
                    background: #e8f5e9;
                    color: #2e7d32;
                }
                
                .status-error {
                    background: #ffebee;
                    color: #c62828;
                }
                
                .loading, .empty, .error {
                    text-align: center;
                    padding: 40px;
                    color: #777;
                    font-style: italic;
                }
                
                .error {
                    color: #c62828;
                }
            </style>
            
            <div class="overlay"></div>
            <div class="modal">
                <div class="header">
                    <h2>🌌 Galaxy Registry</h2>
                    <button class="close-btn" title="Close">×</button>
                </div>
                <div class="body">
                    <div id="galaxy-list">
                        <div class="loading">Initializing...</div>
                    </div>
                </div>
                <div class="footer">
                    <button id="galaxy-clear" class="btn btn-secondary">Clear Registry</button>
                    <button id="btn-close" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;
    }
}

customElements.define('andromeda-galaxy-modal', GalaxyModal);

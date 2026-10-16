import { DeploymentService } from './DeploymentService';
import { BpmnInspectorModal } from './BpmnInspectorModal';
import { ProcessStartModal } from './ProcessStartModal';
import { showToast } from './Toast';

/** `open-logs` event detail: which container's log stream to show. */
export interface OpenLogsDetail {
    deploymentId: string;
    port: string;
    /** the container's GET /api/logs/stream (SSE) endpoint */
    url: string;
}

/** `open-tasks` event detail: whose human task worklist to open. */
export interface OpenTasksDetail {
    deploymentId: string;
    host: string;
    port: string;
    /** the container's workflows - each has its own /{processDef}/tasks */
    processDefs: string[];
}

/** `open-instances` event detail: which deployment's process instances to list. */
export interface OpenInstancesDetail {
    deploymentId: string;
    /** Galaxy base URL serving /galaxy/process-instances and /galaxy/variables */
    galaxyUrl: string;
}

/** `open-instance` event detail: a process instance to show on its diagram. */
export interface OpenInstanceDetail {
    processInstanceId: string;
    /** Galaxy base URL serving /galaxy/process-instances/:id/trace */
    galaxyUrl: string;
}

/**
 * Galaxy registry view: the containers registered with Galaxy and their
 * actions (open API, stream logs, start a process instance, stop). Lives in a
 * dock panel opened from the left menu (see Workspace), replacing the old
 * modal. "Logs" fires an `open-logs` event, a click on a card fires
 * `open-instances`, and starting an instance (▶ / ▶⚙) fires `open-instance`
 * with the new instance; Workspace turns them into log / process instance
 * panels and the instance viewer.
 */
export class GalaxyPanel extends HTMLElement {
    private shadow: ShadowRoot;
    private galaxyUrl: string = '';
    private deploymentService: DeploymentService | null = null;
    private processStartModal: ProcessStartModal | null = null;
    /** the deployed BPMN of a container, read only ("BPMN" button) */
    private bpmnInspector = new BpmnInspectorModal();
    private items: any[] = [];
    private rendered = false;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        // the dock moves this element between containers (panel closed and
        // reopened) - render and wire listeners only once
        if (this.rendered) return;
        this.rendered = true;
        this.render();
        this.addEventListeners();
    }

    setGalaxyUrl(url: string) {
        this.galaxyUrl = url;
        const urlLabel = this.shadow.getElementById('galaxy-url');
        if (urlLabel) urlLabel.textContent = url;
    }

    setDeploymentService(deploymentService: DeploymentService) {
        if (this.deploymentService === deploymentService) return;
        this.deploymentService = deploymentService;
        this.processStartModal = new ProcessStartModal(deploymentService);
        this.processStartModal.onStarted = (processInstanceId) => this.openInstance(processInstanceId);
    }

    /** Shows a just-started instance on its diagram (Workspace opens the viewer). */
    private openInstance(processInstanceId: string) {
        const detail: OpenInstanceDetail = { processInstanceId, galaxyUrl: this.galaxyUrl };
        this.dispatchEvent(new CustomEvent<OpenInstanceDetail>('open-instance', { detail, bubbles: true, composed: true }));
    }

    async load() {
        if (!this.galaxyUrl) return;

        const listDiv = this.shadow.getElementById('galaxy-list');
        // keep the current list while refreshing, only show "Loading" the first time
        if (listDiv && this.items.length === 0) listDiv.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const res = await fetch(`${this.galaxyUrl}/galaxy/containers`);
            const data = await res.json();
            this.items = data;
            this.updateList();
        } catch (e) {
            this.items = [];
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
                    <div class="item" data-deployment-id="${i.deploymentId}" tabindex="0" title="Show process instances">
                        <div class="item-head">
                            <div class="item-id" title="${i.deploymentId}">${i.deploymentId}</div>
                            <div class="item-status status-${i.status === 'ready' ? 'ready' : 'error'}">
                                ${i.status || 'unknown'}
                            </div>
                        </div>
                        <div class="item-meta">port ${i.port} • seen ${new Date(i.lastSeen).toLocaleTimeString()}</div>
                        <div class="item-actions">
                            <button class="btn btn-play" data-deployment-id="${i.deploymentId}" data-port="${i.port}" title="Start Process Instance">▶</button>
                            <button class="btn btn-play-params" data-deployment-id="${i.deploymentId}" data-port="${i.port}" title="Start Process Instance with Parameters">▶⚙</button>
                            <button class="btn btn-api" data-port="${i.port}" title="Open the container's API (Swagger)">API</button>
                            <button class="btn btn-bpmn" data-deployment-id="${i.deploymentId}" data-port="${i.port}" title="The BPMN this container was built from (read only)">BPMN</button>
                            <button class="btn btn-logs" data-deployment-id="${i.deploymentId}" data-port="${i.port}" title="Stream the container's logs">Logs</button>
                            <button class="btn btn-tasks" data-deployment-id="${i.deploymentId}" data-port="${i.port}" title="Human tasks waiting to be completed">Tasks</button>
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
            showToast('Engine connection is not configured, cannot stop container.', 'error');
            return;
        }
        const result = await this.deploymentService.stopEmbedded(deploymentId, port);
        if (!result.success) {
            showToast(result.message, 'error');
            return;
        }
        showToast(result.message, 'success');
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
        const refreshBtn = this.shadow.getElementById('galaxy-refresh');
        const clearBtn = this.shadow.getElementById('galaxy-clear');
        const listDiv = this.shadow.getElementById('galaxy-list');

        refreshBtn?.addEventListener('click', () => this.load());
        clearBtn?.addEventListener('click', () => this.clearRegistry());

        listDiv?.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('btn-stop')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                void this.stopContainer(deploymentId, port);
            } else if (target.classList.contains('btn-api')) {
                const port = target.getAttribute('data-port') || '';
                window.open(`http://${this.getContainerHost()}:${port}/api`, '_blank');
            } else if (target.classList.contains('btn-tasks')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                const detail: OpenTasksDetail = { deploymentId, port, host: this.getContainerHost(), processDefs: this.getProcessDefs(deploymentId, port) };
                this.dispatchEvent(new CustomEvent<OpenTasksDetail>('open-tasks', { detail, bubbles: true, composed: true }));
            } else if (target.classList.contains('btn-bpmn')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                void this.bpmnInspector.open({ host: this.getContainerHost(), port, deploymentId, processDefs: this.getProcessDefs(deploymentId, port) });
            } else if (target.classList.contains('btn-logs')) {
                // the panel itself doesn't know about the dock - Workspace listens for this
                const detail: OpenLogsDetail = {
                    deploymentId: target.getAttribute('data-deployment-id') || '',
                    port: target.getAttribute('data-port') || '',
                    url: `http://${this.getContainerHost()}:${target.getAttribute('data-port')}/api/logs/stream`,
                };
                this.dispatchEvent(new CustomEvent<OpenLogsDetail>('open-logs', { detail, bubbles: true, composed: true }));
            } else if (target.classList.contains('btn-play')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                void this.startProcessInstance(deploymentId, port);
            } else if (target.classList.contains('btn-play-params')) {
                const deploymentId = target.getAttribute('data-deployment-id') || '';
                const port = target.getAttribute('data-port') || '';
                const processDefs = this.getProcessDefs(deploymentId, port);
                void this.processStartModal?.show(this.getContainerHost(), port, deploymentId, processDefs);
            } else if (!target.closest('button')) {
                this.openInstances(target);
            }
        });
        listDiv?.addEventListener('keydown', (e) => {
            const target = e.target as HTMLElement;
            if ((e.key === 'Enter' || e.key === ' ') && target.classList.contains('item')) {
                e.preventDefault();
                this.openInstances(target);
            }
        });
    }

    /** A click on a card (outside its buttons) asks Workspace to list that deployment's process instances. */
    private openInstances(target: HTMLElement) {
        const card = target.closest<HTMLElement>('.item');
        if (!card?.dataset.deploymentId) return;
        const detail: OpenInstancesDetail = { deploymentId: card.dataset.deploymentId, galaxyUrl: this.galaxyUrl };
        this.dispatchEvent(new CustomEvent<OpenInstancesDetail>('open-instances', { detail, bubbles: true, composed: true }));
    }

    private async startProcessInstance(deploymentId: string, port: string): Promise<void> {
        if (!this.deploymentService) {
            showToast('Engine connection is not configured, cannot start process instance.', 'error');
            return;
        }

        const processDefs = this.getProcessDefs(deploymentId, port);
        // more than one workflow in this container - don't guess which one to
        // start, send the user to "Start with Parameters" so they can pick
        if (processDefs.length > 1) {
            showToast('This container has multiple workflows - use "▶⚙ Start with Parameters" to pick one.', 'info');
            void this.processStartModal?.show(this.getContainerHost(), port, deploymentId, processDefs);
            return;
        }

        const result = await this.deploymentService.startProcessInstance(this.getContainerHost(), port, deploymentId, processDefs[0] || '', {});
        showToast(result.message, result.success ? 'success' : 'error');
        // straight to the new instance - also when it was created but marked failed
        const processInstanceId = result.details?.id;
        if (processInstanceId) this.openInstance(String(processInstanceId));
    }

    /**
     * processDefs reported by the container itself via GET /ready (see
     * galaxy.controller.js's listContainers) - [] for containers generated
     * before that field existed, which still only serve a bare /start.
     */
    private getProcessDefs(deploymentId: string, port: string): string[] {
        const item = this.items.find((i) => i.deploymentId === deploymentId && String(i.port) === String(port));
        return item?.processDefs || [];
    }

    /**
     * Containers are assumed reachable on the same host as Galaxy (matches the
     * 127.0.0.1 liveness check the engine itself uses when listing containers).
     */
    private getContainerHost(): string {
        try {
            return new URL(this.galaxyUrl).hostname;
        } catch {
            return '127.0.0.1';
        }
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    font-family: var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
                    color: var(--text, #1f2340);
                }

                .toolbar {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 12px;
                    border-bottom: 1px solid var(--glass-divider);
                }

                .url {
                    flex: 1;
                    min-width: 0;
                    font-size: 11px;
                    color: var(--text-subtle);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }

                .btn {
                    padding: 5px 10px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    border: 1px solid transparent;
                    background: var(--glass-control-bg);
                    color: var(--text-muted);
                    transition: all 0.2s;
                }

                .btn-secondary {
                    border-color: rgba(255, 255, 255, 0.6);
                }

                .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.85);
                    color: var(--text);
                }

                .list-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .item {
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.35);
                    border: 1px solid var(--glass-divider);
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    transition: background 0.2s;
                }

                .item {
                    cursor: pointer;
                }

                .item:hover {
                    background: rgba(255, 255, 255, 0.6);
                }

                .item:focus-visible {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(91, 91, 247, 0.3);
                }

                .item-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .item-id {
                    font-size: 14px;
                    font-weight: 600;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .item-meta {
                    font-size: 11px;
                    color: var(--text-muted);
                }

                .item-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .item-status {
                    flex: 0 0 auto;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 2px 8px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.5);
                }

                .btn-api {
                    color: #1565c0;
                    border-color: #bbdefb;
                }

                .btn-api:hover {
                    background: rgba(227, 242, 253, 0.75);
                    border-color: #1565c0;
                }

                .btn-tasks {
                    color: #b26a00;
                    border-color: #f5d9a8;
                }

                .btn-tasks:hover {
                    background: rgba(245, 165, 36, 0.12);
                    border-color: #b26a00;
                }

                .btn-bpmn {
                    color: #2e7d6b;
                    border-color: #c3e4dc;
                }

                .btn-bpmn:hover {
                    background: rgba(46, 125, 107, 0.1);
                    border-color: #2e7d6b;
                }

                .btn-logs {
                    color: #5b5bf7;
                    border-color: #d3d3fd;
                }

                .btn-logs:hover {
                    background: rgba(91, 91, 247, 0.1);
                    border-color: #5b5bf7;
                }

                .btn-play, .btn-play-params {
                    color: #00796b;
                    border-color: #b2dfdb;
                }

                .btn-play:hover, .btn-play-params:hover {
                    background: rgba(224, 242, 241, 0.75);
                    border-color: #00796b;
                }

                .btn-stop {
                    color: #c62828;
                    border-color: #f3c0c0;
                    margin-left: auto;
                }

                .btn-stop:hover {
                    background: rgba(255, 235, 238, 0.75);
                    border-color: #c62828;
                }

                .status-ready {
                    background: rgba(232, 245, 233, 0.75);
                    color: #2e7d32;
                }

                .status-error {
                    background: rgba(255, 235, 238, 0.75);
                    color: #c62828;
                }

                .loading, .empty, .error {
                    text-align: center;
                    padding: 30px 10px;
                    color: var(--text-muted);
                    font-size: 13px;
                    font-style: italic;
                }

                .error {
                    color: #c62828;
                }
            </style>

            <div class="toolbar">
                <span class="url" id="galaxy-url" title="Galaxy URL (Configuration Settings)">${this.galaxyUrl}</span>
                <button id="galaxy-refresh" class="btn btn-secondary" title="Refresh">⟳</button>
                <button id="galaxy-clear" class="btn btn-secondary" title="Remove every registration">Clear</button>
            </div>
            <div class="body">
                <div id="galaxy-list">
                    <div class="loading">Initializing...</div>
                </div>
            </div>
        `;
    }
}

customElements.define('andromeda-galaxy-panel', GalaxyPanel);

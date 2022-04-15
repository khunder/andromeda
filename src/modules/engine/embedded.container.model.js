export class EmbeddedContainerModel {
    pid
    port
    deploymentId

    constructor(pid, port, deploymentId) {
        this.pid = pid;
        this.port = port;
        this.deploymentId = deploymentId;
    }
}

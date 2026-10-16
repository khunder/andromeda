import {EmbeddedContainerModel} from "./embedded.container.model.js";
import utils, {Utils} from "../../../utils/utils.js";
import path from "path";
import fs from "fs";
import forever from "forever";
import {Config} from "../../../config/config.js";

import {AndromedaLogger} from "../../../config/andromeda-logger.js";
import http from "http";
const Logger = new AndromedaLogger();

export class EmbeddedContainerService {

    static containers= [];
    static portOffset = 10000
    static maxAttemptsRange = 100;

    /**
     * Ports held by embedded containers (running, or being started) - a port
     * is reserved when allocated and released when its container is stopped
     * or fails to start, so a closed container's port is reused: allocation
     * always takes the lowest free port from portOffset (10000) up.
     */
    static allocatedPorts = [];

    /**
     * Binds briefly on `host` - false when something listens there. Only
     * "in use" / "denied" count: a host the machine lacks (no IPv6) isn't a taken port.
     */
    static canBind = (port, host) =>
        new Promise(resolve => {
            const server = http.createServer();
            server.once('error', (error) => resolve(!['EADDRINUSE', 'EACCES'].includes(error.code)));
            server.listen(port, host, () => server.close(() => resolve(true)));
        });

    /**
     * Free for a container: bindable on 127.0.0.1 (where containers listen
     * by default), the IPv4 wildcard and the IPv6 wildcard (node's default
     * when no host is given). One check isn't enough - on Windows each of
     * these can bind while another holds the port.
     */
    static isPortFree = async port => {
        let free = true;
        for (const host of ['127.0.0.1', '0.0.0.0', '::']) {
            if (!await this.canBind(port, host)) {
                free = false;
                break;
            }
        }
        Logger.trace(`port ${port} is ${free ? '' : 'not '}free`);
        return free;
    };

    static reservePort(port) {
        const value = Number(port);
        if (!this.allocatedPorts.includes(value)) {
            this.allocatedPorts.push(value);
        }
        return value;
    }

    /** Gives a stopped (or never started) container's port back. */
    static releasePort(port) {
        const value = Number(port);
        this.allocatedPorts = this.allocatedPorts.filter(p => p !== value);
    }

    static async AllocatePortInRange(containerPort) {
        if(containerPort){
            if(this.allocatedPorts.includes(Number(containerPort))){
                if(! await this.isPortFree(containerPort)){
                    throw new Error(`cannot allocate port ${containerPort}, already allocated`);
                }
            }
            return this.reservePort(containerPort);
        }

        // lowest port first, so ports given back by stopped containers are reused;
        // a busy port (another program) is skipped but not reserved - it's
        // retried next time
        for (let attempt = 0; attempt < EmbeddedContainerService.maxAttemptsRange; attempt++) {
            const port = EmbeddedContainerService.portOffset + attempt;
            if (this.allocatedPorts.includes(port)) {
                continue;
            }
            // reserve before the async check: two deployments started at once
            // must not both pick this port
            this.reservePort(port);
            Logger.debug(`trying to allocate port ${port}`);
            if (await this.isPortFree(port)) {
                return port;
            }
            this.releasePort(port);
        }
        throw `cannot allocate port ${EmbeddedContainerService.portOffset} after ${(EmbeddedContainerService.maxAttemptsRange)} attempts`;
    }


    /**
     * Decides whether a spawned container should ping galaxy (heartbeat/registration).
     * Callers that care always pass an explicit boolean (e.g. embedded-server.controller.js,
     * driven by the API's `withGalaxy` field). When it's left unspecified, containers
     * spawned under the test suite default to standalone mode so test runs never fire
     * heartbeat/register requests at galaxy; outside tests the legacy default (`true`) applies.
     */
    static resolveWithGalaxy(options) {
        if (options.withGalaxy === false) {
            return 'false';
        }
        if (options.withGalaxy === undefined && Config.getInstance().environment === 'test') {
            return 'false';
        }
        return 'true';
    }

    static async startEmbeddedContainer(deploymentId, options) {
        let allocatedPort = await this.allocatePort(options);

        Logger.info(`starting container on port ${allocatedPort}`)
        let deploymentPath = `./deployments/${deploymentId}`;

        this.deleteEmbeddedContainerPidFile(deploymentId, allocatedPort);

        let childProcess;
        let executor = '';
        let args = []
        executor = path.join(process.cwd(), "deployments", deploymentId, "/bootstrap.js")

        // Validate the deployment exists before handing off to forever: if the cwd or
        // entry script is missing, the underlying spawn fails asynchronously with no
        // attached error listener, which otherwise crashes the whole engine process.
        if (!fs.existsSync(path.join(process.cwd(), "deployments", deploymentId)) || !fs.existsSync(executor)) {
            this.releasePort(allocatedPort);
            throw new Error(`cannot start child process: deployment "${deploymentId}" was not found`);
        }

        try {
            childProcess = forever.start(executor, {
                max: 1,
                silent: false,
                killTree: true,
                env: {
                    port: String(allocatedPort),
                    mongoDbUri: Config.getInstance().mongoDbUri,
                    deploymentId: deploymentId,
                    GALAXY_URL: Config.getInstance().galaxyUrl,
                    // standalone / "lone wolf" mode: container starts without galaxy support and never pings
                    WITH_GALAXY: this.resolveWithGalaxy(options),
                    socketCallBacks: options.socketCallBacks,
                    // propagate the engine's own driver choice so an embedded container
                    // uses the same backend , and, for sqlite, the exact same file , as
                    // the engine that spawned it, rather than each resolving its own default
                    PERSISTENCE_DRIVER: Config.getInstance().persistenceDriver,
                    SQLITE_FILE_PATH: Config.getInstance().sqliteFilePath,
                    // file variables: one shared storage folder and the same
                    // limits for every embedded container (see config.js)
                    FILE_STORAGE_DRIVER: Config.getInstance().fileStorageDriver,
                    FILE_STORAGE_DIR: Config.getInstance().fileStorageDir,
                    FILE_INPUT_DIR: Config.getInstance().fileInputDir,
                    FILE_INLINE_MAX_BYTES: String(Config.getInstance().fileInlineMaxBytes),
                    FILE_MAX_BYTES: String(Config.getInstance().fileMaxBytes),
                    FILE_FORCED_MAX_BYTES: String(Config.getInstance().fileForcedMaxBytes),
                    FILE_URL_TIMEOUT_MS: String(Config.getInstance().fileUrlTimeoutMs),
                    // optional OIDC for human tasks (empty = container defaults)
                    OIDC_ENABLED: Config.getInstance().oidcEnabled,
                    OIDC_ISSUER: Config.getInstance().oidcIssuer,
                    OIDC_AUDIENCE: Config.getInstance().oidcAudience,
                    OIDC_JWKS_URI: Config.getInstance().oidcJwksUri,
                    OIDC_ROLES_CLAIM: Config.getInstance().oidcRolesClaim,
                    OIDC_ADMIN_ROLE: Config.getInstance().oidcAdminRole
                },
                cwd: deploymentPath,
                args: args
            });

            // Backstop: without an 'error' listener, an async spawn failure here
            // (e.g. a bad cwd or missing node binary) becomes an uncaught exception
            // and takes down the entire engine instead of just this container.
            childProcess.on('error', (err) => {
                Logger.error(`container ${deploymentId} failed to start: ${err.message}`);
            });
        } catch (e) {
            Logger.error(e)
        }


        if (!childProcess || !childProcess.child || !childProcess.child.pid) {
            this.releasePort(allocatedPort);
            throw new Error(`cannot start child process`);
        }

        Logger.trace(`storing PID= ${childProcess.child.pid}, for process ${deploymentId}, on port ${allocatedPort}`)
        EmbeddedContainerService.containers.push({deploymentId, model: new EmbeddedContainerModel(childProcess.child.pid, allocatedPort, deploymentId)});

        if (Config.getInstance().isLocalMode) {
            Logger.info(`Launching embedded.sidecar.daemon.service`)
            const daemon = await import("../embedded/embedded.sidecar.daemon.service.js");
            await daemon.EmbeddedSidecarDaemonService.watchContainer(childProcess.child.pid);
        }

        await this.waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort);
        return allocatedPort;
    }

    static deleteEmbeddedContainerPidFile(deploymentPath, port) {
        const basePath = path.join(process.cwd(), "deployments", deploymentPath)
        const pidPath= path.join(basePath , `.pid_${port}`)
        if (fs.existsSync(pidPath)) {
            Logger.debug(`deleteEmbeddedContainerPidFile:: Found pid file`)
            try {
                Logger.debug(`deleteEmbeddedContainerPidFile:: deleting pid file`)
                fs.unlinkSync(pidPath)
            } catch (err) {
                Logger.error(err)
            }
        }else{
            Logger.debug(`deleteEmbeddedContainerPidFile:: pid file NOT FOUND at ${pidPath}`)
        }
    }

    static async allocatePort(options) {
        // an explicit port is reserved too, so automatic allocation skips it
        return await EmbeddedContainerService.AllocatePortInRange(options && options.port);
    }

    /**
     *
     * @param {string} deploymentPath
     * @param {string} deploymentId
     * @param {number} allocatedPort
     * @returns {Promise<void>}
     */
    static async waitForEmbeddedContainerStart(deploymentPath, deploymentId, allocatedPort) {
        const runContainer = async () => {
            if (fs.existsSync(deploymentPath + `/.pid_${allocatedPort}`)) {
                Logger.info(`Found process id (PID), for process ${deploymentId}, on port ${allocatedPort}`)
                return true;
            } else {
                Logger.trace(`waiting for the container ${deploymentId} to connect on port ${allocatedPort}`)
                await Utils.sleep(1000)
                return false;
            }
        };

        let numberOfAttempts = 300;
        Logger.info(`Waiting for the embedded container ${deploymentId} to connect on port ${allocatedPort}`)
        for (let i = 0; i < numberOfAttempts; ++i) {
            if (await runContainer()) {
                break;
            }
            if (i === numberOfAttempts - 1) {
                Logger.error(`Cannot start embedded container:${deploymentId} Max number of attempts reached, on port ${allocatedPort}`);
                await this.stopEmbeddedContainer(deploymentId, allocatedPort)
                throw `cannot start embedded container`;
            }
        }
    }

    static async stopEmbeddedContainer(deploymentId, port) {
        if(!port){
            Logger.error(`to stop embedded container port must not specified `)
            throw new Error(`to stop embedded container port must not specified `)
        }
        Logger.debug(`stopEmbeddedContainer :: ${deploymentId} on port ${port}`)
        // one deployment can run several containers (same id/version, other
        // ports) - stop only the one on this port. The port arrives as a
        // string from HTTP and is stored as allocated (a number), so compare as text.
        const isTarget = (e) => e.model.deploymentId === deploymentId && String(e.model.port) === String(port);
        const tracked = EmbeddedContainerService.containers.filter(isTarget);
        if (tracked.length === 0) {
            // not started by this engine (it outlived the engine that started it)
            const stopped = await EmbeddedContainerService.stopUntrackedContainer(deploymentId, port);
            if (stopped) EmbeddedContainerService.releasePort(port);
            return stopped;
        }
        tracked.forEach(e=>{
            Logger.debug(`stopEmbeddedContainer :: with pid ${e.model.pid}`)
            EmbeddedContainerService.deleteEmbeddedContainerPidFile(deploymentId, port);
            forever.kill(e.model.pid)
            if (Config.getInstance().isLocalMode) {
                // the dev sidecar daemon kills watched pids when the engine exits
                import("../embedded/embedded.sidecar.daemon.service.js")
                    .then((daemon) => daemon.EmbeddedSidecarDaemonService.unwatchContainerPid(e.model.pid))
                    .catch((error) => Logger.debug(`could not unwatch pid ${e.model.pid}: ${error.message}`));
            }
        });
        EmbeddedContainerService.containers = EmbeddedContainerService.containers.filter(e => !isTarget(e));
        // free for the next container (allocation re-checks it's really unbound)
        EmbeddedContainerService.releasePort(port);
        return true;
    }

    /**
     * Stops a container this engine has no record of - one started by an
     * earlier engine run that's still alive (an engine restart doesn't stop
     * its containers when the dev sidecar daemon isn't watching them). Its
     * pid comes from the pid file the container writes in its deployment
     * folder (.pid_<port>); before killing, the container on that port is
     * asked which deployment it is (GET /api/containers), and - when it
     * reports it - its pid must be the file's, so a stale file never kills
     * an unrelated process.
     * @returns {Promise<boolean>} whether a container was stopped
     */
    static async stopUntrackedContainer(deploymentId, port) {
        if (!/^[\w.-]+$/.test(String(deploymentId)) || !/^\d+$/.test(String(port))) {
            return false;
        }
        let pid;
        try {
            pid = parseInt(fs.readFileSync(path.join(process.cwd(), "deployments", deploymentId, `.pid_${port}`), 'utf8').trim(), 10);
        } catch {
            Logger.info(`stopEmbeddedContainer :: no container ${deploymentId} known on port ${port}`);
            return false;
        }
        let info = null;
        try {
            const response = await fetch(`http://127.0.0.1:${port}/api/containers`, {signal: AbortSignal.timeout(3000)});
            info = response.ok ? await response.json() : null;
        } catch {
            // not running - nothing to stop
        }
        const samePid = info?.pid === undefined || Number(info.pid) === pid;
        if (!Number.isInteger(pid) || info?.deploymentId !== deploymentId || !samePid) {
            Logger.warn(`stopEmbeddedContainer :: not stopping pid ${pid}: port ${port} serves ${info?.deploymentId ?? 'nothing'}${info?.pid ? ` (pid ${info.pid})` : ''}, not ${deploymentId}`);
            return false;
        }
        Logger.info(`stopEmbeddedContainer :: stopping ${deploymentId} on port ${port} (pid ${pid}), started by another engine run`);
        forever.kill(pid);
        EmbeddedContainerService.deleteEmbeddedContainerPidFile(deploymentId, port);
        return true;
    }
}
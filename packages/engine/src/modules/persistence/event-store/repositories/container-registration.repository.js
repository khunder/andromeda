import {AndromedaLogger} from "../../../../config/andromeda-logger.js";
import ContainerRegistrationModel from "../internal/models/container-registration.orm-model.js";
import {RepositoryFactory} from "./repository.factory.js";
import {TABLE_DEFINITIONS} from "../internal/sqlite/table-definitions.js";

const Logger = new AndromedaLogger();

/**
 * Backs the container-registration mechanism: every running container
 * replica periodically upserts its own row keyed by
 * (deploymentId, version, containerId), so concurrent replicas never race to
 * write the same document - see ContainerService's heartbeat loop
 * (container.service.js.njk). A plain, non-event-sourced collection - a
 * heartbeat isn't domain state that needs replay/audit, it's a throwaway
 * liveness marker, same reasoning as TimerTick/TimerJob.
 */
export class ContainerRegistrationRepository {

    /**
     * @type {BaseRepository}
     */
    repo;

    constructor() {
        this.repo = RepositoryFactory.create(ContainerRegistrationModel, TABLE_DEFINITIONS.ContainerRegistration);
    }

    /**
     * @param {string} deploymentId
     * @param {string} version
     * @param {string} containerId
     * @returns {Promise<object>}
     */
    async heartbeat(deploymentId, version, containerId) {
        Logger.trace(`container registration heartbeat: deployment=${deploymentId} version=${version} container=${containerId}`);
        return this.repo.upsert(
            {deploymentId, version, containerId},
            {deploymentId, version, containerId, lastHeartbeat: new Date()},
        );
    }

    /**
     * Every container registration row whose last heartbeat is still within
     * `maxAgeMs` - i.e. the currently "running" containers.
     * @param {string} [deploymentId]
     * @param {string} [version]
     * @param {number} maxAgeMs
     * @returns {Promise<object[]>}
     */
    async findRunning({deploymentId, version, maxAgeMs}) {
        const cond = {lastHeartbeat: {$gte: new Date(Date.now() - maxAgeMs)}};
        if (deploymentId) {
            cond.deploymentId = deploymentId;
        }
        if (version) {
            cond.version = version;
        }
        return this.repo.find(cond);
    }

}

export default ContainerRegistrationRepository;

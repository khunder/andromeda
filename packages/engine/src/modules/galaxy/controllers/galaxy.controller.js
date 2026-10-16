

import {galaxyRegistry} from "../galaxy.registry.js";
import {PersistenceGateway} from "../../persistence/persistence-gateway.js";
import {Config} from "../../../config/config.js";
import constants from "../../../config/constants.js";
import Utils from "../../../utils/utils.js";
import {page, parsePaging, parseStatus, sortBy, toFlow, toProcessInstance, toTask, toVariable} from "../runtime-queries.js";

/**
 * Galaxy reads runtime state straight from the persistence store. sqlite
 * repositories open the database file on first use, so that works even when
 * this process doesn't run the persistence module; mongodb needs the module's
 * connection, without which a query would just hang waiting for one.
 */
function assertStoreReachable() {
    if (Config.getInstance().persistenceDriver !== 'sqlite' && !Utils.moduleIsActive(constants.PERSISTENCE)) {
        throw Object.assign(
            new Error(`Galaxy needs the "${constants.PERSISTENCE}" module (ACTIVE_MODULES) to query process state with the ${Config.getInstance().persistenceDriver} driver`),
            {statusCode: 503},
        );
    }
}

class GalaxyController {


    static heartbeat = async (req, reply) => {
        const { deploymentId, port } = req.body || {};
        if(!deploymentId || !port){
            reply.code(400).send({ error: 'deploymentId and port are required' });
            return;
        }
        galaxyRegistry.upsert(deploymentId, String(port));
        reply.send({ ok: true });
    }

    static listContainers = async (req, reply) => {
        const all = galaxyRegistry.list();
        const withStatus = await Promise.all(all.map(async (c)=>{
            try{
                const res = await fetch(`http://127.0.0.1:${c.port}/ready`, { method: 'GET' });
                // /api/process-defs is absent on containers generated before it
                // existed - defaults to [] so callers (the designer) can fall back
                // to the legacy unnamespaced /start route for those
                let processDefs = [];
                if (res.ok) {
                    try {
                        const processDefsRes = await fetch(`http://127.0.0.1:${c.port}/api/process-defs`, { method: 'GET' });
                        if (processDefsRes.ok) {
                            const body = await processDefsRes.json().catch(() => ({}));
                            processDefs = body.processDefs || [];
                        }
                    } catch (e) { /* older container without this route - degrade to [] */ }
                }
                return { ...c, status: res.ok ? 'ready' : `http_${res.status}`, processDefs };
            }catch(e){
                return { ...c, status: 'unreachable', processDefs: [] };
            }
        }));
        reply.send(withStatus);
    }

    static clearRegistry = async (req, reply) => {
        galaxyRegistry.clear();
        reply.send({ ok: true });
    }

    static removeContainer = async (req, reply) => {
        const { deploymentId, port } = req.body || {};
        if(!deploymentId || !port){
            reply.code(400).send({ error: 'deploymentId and port are required' });
            return;
        }
        galaxyRegistry.remove(deploymentId, String(port));
        reply.send({ ok: true });
    }

    /**
     * GET /galaxy/process-instances - process instances across every
     * deployment, optionally narrowed by deploymentId, processDef and status
     * (active|completed|error|aborted), paged with limit/offset.
     */
    static listProcessInstances = async (req) => {
        assertStoreReachable();
        const query = req.query || {};
        const paging = parsePaging(query);
        const status = parseStatus(query.status);
        const rows = await PersistenceGateway.findProcessInstances({
            deploymentId: query.deploymentId,
            processDef: query.processDef,
            status,
        });
        return page(sortBy(rows, 'deploymentId', 'processDef', '_id').map(toProcessInstance), paging);
    }

    /**
     * GET /galaxy/variables - persisted variables across every deployment,
     * optionally narrowed by deploymentId, processInstanceId, processDef and
     * name, paged with limit/offset; values decoded to their declared type.
     */
    static listVariables = async (req) => {
        assertStoreReachable();
        const query = req.query || {};
        const paging = parsePaging(query);
        const rows = await PersistenceGateway.findVariables({
            deploymentId: query.deploymentId,
            processInstanceId: query.processInstanceId,
            processDef: query.processDef,
            name: query.name,
        });
        return page(sortBy(rows, 'deploymentId', 'processInstance', 'name').map(toVariable), paging);
    }

    /**
     * GET /galaxy/process-instances/:id/trace - what's needed to draw one
     * process instance's progress: the instance, the sequence flows it took
     * (status active = waiting at the flow's target), the tasks it reached
     * (human tasks / catch events), its variables, the BPMN it runs (fetched
     * from its container's GET /api/bpmn/:processDef) and that container's
     * port - to complete its pending tasks. bpmn / container are null when no
     * registered container serves the deployment (or it predates /api/bpmn).
     */
    static processInstanceTrace = async (req, reply) => {
        assertStoreReachable();
        const processInstanceId = req.params.id;
        const row = await PersistenceGateway.getProcessInstance({processInstanceId});
        if (!row) {
            reply.code(404);
            return {message: `process instance ${processInstanceId} not found`};
        }
        const instance = toProcessInstance(row);
        const [flows, tasks, variables] = await Promise.all([
            PersistenceGateway.findFlowEvents({processInstanceId}),
            PersistenceGateway.findTasks({processInstanceId}),
            PersistenceGateway.findVariables({processInstanceId}),
        ]);

        let container = null;
        let bpmn = null;
        let bpmnError = null;
        for (const candidate of galaxyRegistry.list().filter((entry) => entry.deploymentId === instance.deploymentId)) {
            try {
                const res = await fetch(`http://127.0.0.1:${candidate.port}/api/bpmn/${encodeURIComponent(instance.processDef)}`,
                    {signal: AbortSignal.timeout(5000)});
                container = {port: candidate.port};
                if (res.ok) {
                    bpmn = await res.text();
                    break;
                }
                bpmnError = res.status === 404
                    ? 'the container keeps no BPMN for this process - recompile it'
                    : `the container answered HTTP ${res.status}`;
            } catch (error) {
                bpmnError = `container on port ${candidate.port} unreachable`;
            }
        }
        if (!container && !bpmnError) {
            bpmnError = `no running container registered for ${instance.deploymentId}`;
        }

        return {
            instance,
            container,
            bpmn,
            bpmnError: bpmn ? null : bpmnError,
            flows: flows.map(toFlow),
            tasks: sortBy(tasks, 'nodeId').map(toTask),
            variables: sortBy(variables, 'name').map(toVariable),
        };
    }


}

export default GalaxyController
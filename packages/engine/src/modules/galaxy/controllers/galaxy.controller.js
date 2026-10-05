

import {galaxyRegistry} from "../galaxy.registry.js";
import {PersistenceGateway} from "../../persistence/persistence-gateway.js";
import {Config} from "../../../config/config.js";
import constants from "../../../config/constants.js";
import Utils from "../../../utils/utils.js";
import {page, parsePaging, parseStatus, sortBy, toProcessInstance, toVariable} from "../runtime-queries.js";

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


}

export default GalaxyController
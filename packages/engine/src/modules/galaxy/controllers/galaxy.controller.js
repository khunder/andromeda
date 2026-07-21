

import {galaxyRegistry} from "../galaxy.registry.js";

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


}

export default GalaxyController
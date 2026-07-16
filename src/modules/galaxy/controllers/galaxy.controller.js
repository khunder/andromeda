

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
                return { ...c, status: res.ok ? 'ready' : `http_${res.status}` };
            }catch(e){
                return { ...c, status: 'unreachable' };
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
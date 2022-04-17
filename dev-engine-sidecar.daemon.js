import path from "path"
import {config} from "dotenv";
import ipc from 'node-ipc';
import rimraf from "rimraf";
import psList from "ps-list";
import {AndromedaLogger} from "./src/config/andromeda-logger.js";
const Logger = new AndromedaLogger("dev-engine-sidecar.daemon");

let enginePid
let containers = []
/**
 * NB: THIS HELPER IS USED ONLY LOCALLY IN DEV MODE, it's called sidecar daemon
 * This helper will kill child (containers aka node process) when the engine is closed
 * When the daemon detects that the engine is closed, checks pid regularly, it will close all related note processes.
 * When the engine starts, it will start the daemon, and pass its own pid.
 * When a container starts, it will send the pid of the created process, the daemon will store it in memory.
 *
 * This daemon uses a socket file, implemented using the node-ipc npm package, to communicate with the engine.
 */

const socketPath = path.join(process.cwd() , '/temp/andromeda.ipc.sock');
rimraf.sync(socketPath);

config.unlink = false;
ipc.config.retry= 2000;
ipc.config.id = 'andromeda_daemon';


function shutdown(){
    try{
        for (let i = 0; i < containers.length; i++){
            let e = containers[i];
            Logger.info(`killing process ${e}`);
            try {
                process.kill(e);
            }catch (e) {
                Logger.error(`Could not kill process ${e}` , e)
            }
        }
    }
    finally {
        rimraf.sync(socketPath);
    }

    process.exit(0);
}

ipc.serve(
    socketPath,
    function() {


        ipc.server.on(
            'watch_engine_pid', // get engine pid
            function(data,socket) {
                Logger.info(`Tracking Engine on port (${data.message})`);
                enginePid = parseInt(data.message); // <---- Here exactly
                containers=[];
            }
        );

        ipc.server.on(
            'watch_container_pid',
            function(data,socket) {
                Logger.info(`Tracking container on pid ${data.message}`);
                containers.push(data.message)
            }
        );

        ipc.server.on(
            'unwatch_container_pid',
            function(data,socket) {
                try {
                    Logger.info(`killing process`, data.message);
                    let containerPid = parseInt(data.message);
                    containers=containers.filter(e=> e === containerPid);
                }catch (e) {
                    Logger.error(e);
                }

            }
        );

        ipc.server.on(
            'shutdown',
            function(data,socket) {
                Logger.info(`shutdown`);
                shutdown();
            }
        );
    }

);
ipc.server.start();

Logger.info(`>>>> Sidecar tool for dev purpose started on pid '${process.pid}' as daemon process`);

setInterval(
    async function () {
        const data = await psList();
        let pss = data.filter(e => e.pid === enginePid)
        if (pss.length === 0) {
            Logger.info(`---- Shutting down daemon process ----- `)
            shutdown();
        }
    },
    5000
);


export default  containers;

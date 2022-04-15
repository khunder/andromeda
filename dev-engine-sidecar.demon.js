import path from "path"
import {config} from "dotenv";
import ipc from 'node-ipc';
import rimraf from "rimraf";
import psList from "ps-list";

let enginePid
let containers = []


const socketPath = path.join(process.cwd() , '/temp/andromeda.ipc.sock');
rimraf.sync(socketPath);

config.unlink = false;
ipc.config.retry= 2000;
ipc.config.id = 'andromeda_daemon';


function shutdown(){
    try{
        for (let i = 0; i < containers.length; i++){
            let e = containers[i];
            console.log(`killing process ${e}`);
            try {
                process.kill(e);
            }catch (e) {
                console.error(`Could not kill process ${e}` , e)
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
                console.log(`Engine init: got: `, data.message);
                enginePid = parseInt(data.message); // <---- Here exactly
                containers=[];
            }
        );

        ipc.server.on(
            'watch_container_pid',
            function(data,socket) {
                console.log(`pid ${process.pid} got: `, data.message);
                containers.push(data.message)
            }
        );

        ipc.server.on(
            'unwatch_container_pid',
            function(data,socket) {
                try {
                    console.log(`killing process`, data.message);
                    let containerPid = parseInt(data.message);
                    containers=containers.filter(e=> e === containerPid);
                }catch (e) {
                    console.error(e);
                }

            }
        );

        ipc.server.on(
            'shutdown',
            function(data,socket) {
                console.log(`shutdown`);
                shutdown();
            }
        );
    }

);
ipc.server.start();

console.info(`>>>> Sidecar tool for dev purpose started on pid '${process.pid}' as daemon process`);


// clean ps


setInterval(
    async function () {
        const data = await psList();
        let pss = data.filter(e => e.pid === enginePid)
        if (pss.length === 0) {
            console.log(`---- Shutting down daemon process ----- `)
            shutdown();
        }
        console.debug(`----->`)
    },
    5000
);


export default  containers;

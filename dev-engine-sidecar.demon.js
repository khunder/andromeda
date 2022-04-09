const path = require("path");
const ipc = require('node-ipc').default;
const rimraf = require("rimraf");
const psList = require("ps-list");

let enginePid
let containers = []


const socketPath = path.join(process.cwd() , '/temp/andromeda.ipc.sock');
rimraf.sync(socketPath);

ipc.config.unlink = false;
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
                console.error(`could not kill process ${e}` , e)
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
            'track_pid',
            function(data,socket) {
                console.log(`pid ${process.pid} got: `, data.message);
                containers.push(data.message)
            }
        );

        ipc.server.on(
            'init_engine',
            function(data,socket) {
                console.log(`Engine init: got: `, data.message);
                enginePid = parseInt(data.message);
                containers=[];
            }
        );

        ipc.server.on(
            'loose_track_container',
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

console.log(`pid ${process.pid} listening on ${socketPath}`);


// clean ps


// setInterval(
//     async function () {
//         const lw = (await psList)()
//         psList.then(data => {
//             let pss = data.get().filter(e => e.pid === enginePid)
//
//             if (pss.length === 0) {
//                 console.log(`---- Shutting down daemon process ----- `)
//                 shutdown();
//
//             }
//         });
//         console.log(`----->`)
//     },
//     5000
// );
(async () => {
    console.log(await psList());
    //=> [{pid: 3213, name: 'node', cmd: 'node test.js', ppid: 1, uid: 501, cpu: 0.1, memory: 1.5}, …]
})();

module.exports={containers};

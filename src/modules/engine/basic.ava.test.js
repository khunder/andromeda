import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

import test from "ava";
import EngineService from "./engine.service.js";
import {EmbeddedContainerService} from "./embedded/embedded.containers.service.js";
import Utils from "../../utils/utils.js";
import FormData from "form-data";
import axios from "axios";
import ipc from "node-ipc";
import {Config} from "../../config/config.js";


    test.before('database', async () => {
        await mongoose.connect(process.env.MONGODB_URI);

    });


    test.after(async () => {
        await mongoose.disconnect();
    })

function startContainerSocketServer(deploymentId, port, callback) {
    const socketPath = path.join(process.cwd(), "deployments", deploymentId, `/.pid_${port}.sock`);
    ipc.config.retry = 2000;
    ipc.config.id = 'container_socket';
    ipc.serve(
        socketPath,
        function () {
            ipc.server.on(
                'container_callBack', // get engine pid
                function (data, socket) {
                    callback(data)
                }
            );
        });
    ipc.server.start();
}

test('Start Embedded container', async (t) => {

        try {
            let deploymentId = "cov/scenario_script";
            const containerPort = 10002
            startContainerSocketServer(deploymentId, containerPort, function (){
                console.log(`--------------------------> callback from inside container`)
                t.fail()
            });


            let fileContents = [];
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            fileContents.push(fs.readFileSync(path.join(__dirname  ,"../../../test/resources", "scenario_script.bpmn"  ), {encoding: 'utf8'}));
            /**
             * @type {ContainerParsingContext} containerParsingContext
             */
            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            ctx.includeGalaxyModule = true;


            const engineService = new EngineService();
            await engineService.generateContainer(ctx);
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: containerPort, socketCallBacks: "engine"});

            const form = new FormData();
            form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
            form.append('deploymentId', "compileBpmn");

            const config = { headers: form.getHeaders()};
            // when
            let proc = await axios.post(`http://127.0.0.1:10002/start`, form, config);
            const count = await mongoose.connection.db.collection("ProcessInstance").count({_id: proc.data.id})
            t.is(count, 1)
            await Utils.sleep(2000);
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10002);
            t.pass()
        } catch (e) {
            console.error(e)
        }
    })


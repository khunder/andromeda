import assert from "assert";
import WorkflowBuilder from "./workflow.builder.js";
import Utils from "../../utils/utils.js";
import {fileURLToPath} from "url";
import fs from "fs";
import EngineService from "./engine.service.js";
import {EmbeddedContainerService} from "./embedded/embedded.containers.service.js";
import FormData from "form-data";
import axios from "axios";
import mongoose from "mongoose";
import path from "path";
import ipc from "node-ipc";


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

describe('Embedded Container', function () {
    it('Start Embedded container', async () => {
        try {
            let deploymentId = "cov/scenario_script";
            const containerPort = 10002
            startContainerSocketServer(deploymentId, containerPort, function (){
                console.log(`--------------------------> callback from inside container`)
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
            assert.equal(count, 1)
            await Utils.sleep(2000);
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10002);

        } catch (e) {
            console.error(e)
        }
    });

});


import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

import test from "ava";
import FormData from "form-data";
import axios from "axios";
import {EmbeddedContainerService} from "../../../src/modules/engine/embedded/embedded.containers.service.js";
import EngineService from "../../../src/modules/engine/engine.service.js";
import Utils from "../../../src/utils/utils.js";
import {PersistenceHelper} from "../../../src/modules/persistence/helper/persistence-helper.js";


    test.before('database', async () => {
        await mongoose.connect(process.env.MONGODB_URI);

    });


    test.after(async () => {
        await mongoose.disconnect();
    })


test('Fail flow event ', async (t) => {

        try {
            let deploymentId = "tests/fail_process_instance";
            const containerPort = 10005



            let fileContents = [];
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            fileContents.push(fs.readFileSync(path.join(__dirname  , "fail_flow_event.bpmn"  ), {encoding: 'utf8'}));
            /**
             * @type {ContainerParsingContext} containerParsingContext
             */
            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            ctx.includeGalaxyModule = true;


            const engineService = new EngineService();
            await engineService.generateContainer(ctx);
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: containerPort, socketCallBacks: "engine"});

            const form = new FormData();
            // form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
            // form.append('deploymentId', "compileBpmn");

            const config = { headers: form.getHeaders()};
            // when
            let proc = await axios.post(`http://127.0.0.1:${containerPort}/start`, form, config);
            await Utils.sleep(1000);
            const flow = await PersistenceHelper.findRecord("FlowEvent", {processInstance: proc.data.id, flowId: "Flow_1t45tk4"})

            t.truthy(flow)
            t.is(flow.status , 2);
            await Utils.sleep(2000);

            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, containerPort);
            t.pass()
        } catch (e) {
            console.error(e)
        }
    })


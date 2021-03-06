import mongoose from "mongoose";
import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import test from 'ava';
import utils from "../../src/utils/utils.js";
import FormData from "form-data";
import axios from "axios";


    test.before('database', async () => {
        await mongoose.connect(process.env.MONGODB_URI);
    });


    test.after(async () => {
        await mongoose.disconnect();
    })

    test('Start process instance', async (t) => {

        try {
            let deploymentId = "cov/scenario_script";
            let fileContents = [];
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            fileContents.push(fs.readFileSync(path.join(__dirname  ,"../resources", "scenario_script.bpmn"  ), {encoding: 'utf8'}));
            /**
             * @type {ContainerParsingContext} containerParsingContext
             */
            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            ctx.includeGalaxyModule = true;


            const engineService = new EngineService();
            await engineService.generateContainer(ctx);
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: 10002});


            const form = new FormData();
            form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
            form.append('deploymentId', "compileBpmn");

            const config = { headers: form.getHeaders()};
            // when
            let proc = await axios.post(`http://127.0.0.1:10002/start`, form, config);
            const count = await mongoose.connection.db.collection("ProcessInstance").count({_id: proc.data.id})
            t.is(count, 1)

            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10002);
            t.pass()
        } catch (e) {
            console.error(e)
        }
    })


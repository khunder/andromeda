import mongoose from "mongoose";
import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import axios from "axios";
import assert from "assert";
import {UsedPorts} from "../used_ports.js";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";


describe('StartProcessInstance::Integration', function () {

    it('Start process instance', async () => {
        try {
            let deploymentId = "cov/scenario_script2";
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
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: UsedPorts.StartProcessInstance});


            const form = new FormData();
            form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
            form.append('deploymentId', "compileBpmn");

            const config = { headers: form.getHeaders()};
            // when
            let proc = await axios.post(`http://127.0.0.1:${UsedPorts.StartProcessInstance}/start`, form, config);
            const count = await PersistenceModule.getConnection().db.collection("ProcessInstance").count({_id: proc.data.id})
            assert.equal(count, 1)
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, UsedPorts.StartProcessInstance);
        } catch (e) {
            console.error(e)
        }
    })

});

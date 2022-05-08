import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import Utils from "../src/utils/utils.js";
import EngineService from "../src/modules/engine/engine.service.js";
import {EmbeddedContainerService} from "../src/modules/engine/embedded/embedded.containers.service.js";
import test from "ava";


    test.before('database', async () => {
        await mongoose.connect(process.env.MONGODB_URI);
    });


    test.after(async () => {
        await mongoose.disconnect();
    })

    test('Start Embedded container', async (t) => {

        try {
            let deploymentId = "cov/scenario_script";
            let fileContents = [];
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            fileContents.push(fs.readFileSync(path.join(__dirname  ,"resources", "scenario_script.bpmn"  ), {encoding: 'utf8'}));
            /**
             * @type {ContainerParsingContext} containerParsingContext
             */
            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            ctx.includeGalaxyModule = true;
            ctx.includeWebModule = true;
            ctx.includePersistenceModule = true;

            const engineService = new EngineService();
            await engineService.generateContainer(ctx);
            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: 10002});
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10002);
            t.pass()
        } catch (e) {
            console.error(e)
        }
    })


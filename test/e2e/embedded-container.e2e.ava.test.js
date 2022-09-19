import mongoose from "mongoose";
import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";

describe('start/Stop Embedded container', function () {


        it('Start/Stop Embedded container', async () => {
                let deploymentId = "test";
                let fileContents = [];
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                fileContents.push(fs.readFileSync(path.join(__dirname, "..", "resources", "andromeda.bpmn"), {encoding: 'utf8'}));

                let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
                const engineService = new EngineService();
                await engineService.generateContainer(ctx);
                await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: 10000});
                await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, 10000);

        });

});
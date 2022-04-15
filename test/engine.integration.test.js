import mongoose from "mongoose";
import Utils from "../src/utils/utils.js";
import EngineService from "../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";


describe("Engine lifecycle", () => {
    let server;
    beforeAll(async () => {

        await mongoose.connect(process.env.MONGO_URL);
    });

    afterAll(async () => {
        await mongoose.disconnect();
    })

    test('Start Engine', async () => {
        try {
            let deploymentId = "test";
            let fileContents = [];
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            fileContents.push(fs.readFileSync(path.join(__dirname ,"resources", "andromeda.bpmn"  ), {encoding: 'utf8'}));

            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            const engineService = new EngineService();
            await engineService.generateContainer(ctx);

            await engineService.startEmbeddedContainer(deploymentId);

        } catch (e) {
            console.error(e)
        }

    })


})
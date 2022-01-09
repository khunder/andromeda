const mongoose = require("mongoose");
const Utils = require("../src/utils/utils");
const EngineService = require("../src/modules/engine/engine.service");
const fs = require("fs");
const path = require("path");


describe("Engine lifecycle", () => {
    let server;
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI);
    });

    afterAll(async () => {
        await mongoose.disconnect();
    })

    test('Start Engine', async () => {
        try {
            let deploymentId = "test";
            let fileContents = [];

            fileContents.push(fs.readFileSync(path.join(__dirname ,"resources", "andromeda.bpmn"  ), {encoding: 'utf8'}));

            let ctx = await Utils.prepareContainerContext(fileContents, deploymentId);
            await new EngineService().generateContainer(ctx);

        } catch (e) {
            console.error(e)
        }

    })


})
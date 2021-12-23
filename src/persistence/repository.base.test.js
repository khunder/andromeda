
import fastify from "fastify";
import {routes} from "./routes/routes.js";
import fastify_swagger from "fastify-swagger";

import {Engine} from "./engine.js";
import {options} from "./config/swagger.js";
import {RepositoryBase} from "./repository.base.js";
import {ProcessInstance} from "./models/process.instance.js";



describe("Engine lifecycle", () => {
    let server;
    beforeAll(()=> {

    });

    test('Start Engine', async () => {
        let rb = await new RepositoryBase(ProcessInstance);

    })


})
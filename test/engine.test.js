
import {Engine} from "../src/engine.js";
import fastify from "fastify";
import {RepositoryBase} from "../src/persistence/repository.base.js";
import {ProcessInstance} from "../src/persistence/models/process.instance.js";


// const test = async () => {
//     let engine = new Engine();
//     const app = engine.getApp();
//
//     const response = await app.inject({
//         method: 'GET',
//         url: '/live'
//     })
//     console.log(`qwewe`)
//     return response;
//
// }



describe("Engine lifecycle", () => {
    let server;
    beforeAll(()=> {

    });

    test('Start Engine', async () => {
        let engine = new Engine();
        const app = engine.getApp();
        try{
            const response = await app.inject({
                method: 'GET',
                url: '/'
            })
        }catch (e) {
            console.log(e)
        }

    })


})
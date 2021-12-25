
import {Engine} from "../src/engine.js";


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

test('requests the "/live" route', async t => {

    let engine = new Engine();
    const app = engine.getApp();


    const response = await app.inject({
        method: 'GET',
        url: '/'
    })
    expect(response.statusCode).toEqual(200)
})
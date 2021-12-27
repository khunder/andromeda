
const Engine = require("../src/modules/engine");



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

            console.log(response)


        }catch (e) {
            console.log(e)
        }

    })


})
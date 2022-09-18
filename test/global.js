import Utils from "../src/utils/utils.js";

export const mochaHooks = {
    beforeEach(done) {
        console.log('mochaHooks.beforeEach');
        done();
    },
    afterAll(done){
        console.log('>>>-- Global tear down');
        done();
    },


};


// Bonus: global fixture, runs once before everything.
export const mochaGlobalSetup = async function() {
    console.log('>>>-- mocha Global Setup');
    Utils.loadEnvVariables();
};

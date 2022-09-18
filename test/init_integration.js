// Root hook.
import Utils from "../src/utils/utils.js";
import { MongoMemoryServer} from "mongodb-memory-server";
import AndromedaLogger from "../src/config/andromeda-logger.js";
import mongoose from "mongoose";
const Logger = new AndromedaLogger();

export const mochaHooks = {
    beforeEach(done) {
        // console.log('mochaHooks.beforeEach ' + process.env.ACTIVE_MODULES);
        done();
    },
    async afterAll() {
        Logger.debug('== Global teardown ===');
        await mongoose.disconnect();
        Logger.debug('>- mongoose disconnected');
        await stopMongoInMemory();
        Logger.debug('>- MongoInMemory Stopped');

    },


};


// Bonus: global fixture, runs once before everything.
export const mochaGlobalSetup = async function() {
    console.log('>>>-- mocha Global Setup');
    Utils.loadEnvVariables("test");

    await startMongoInMemory();
    await mongoose.connect(process.env.MONGODB_URI);


};

let server;
async function startMongoInMemory() {
    const version = "5.0.3";
    Logger.info(`Starting new Mongo in memory instance version(${version})`)
    process.env.MONGOMS_VERSION = version
    process.env.MONGOMS_DEBUG = "1"

    server = await MongoMemoryServer.create({
        instance: {
            port: 27018, // by default choose any free port
            ip: "127.0.0.1", // by default '127.0.0.1', for binding to all IP addresses set it to `::,0.0.0.0`,
            dbName: "andromeda", // by default '' (empty string)
        }
    });

}

async function stopMongoInMemory(){
    Logger.debug(`>- Stopping MongoDB in memory instance`)
    server.stop();
}
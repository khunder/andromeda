import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

export async function setup() {
    process.env.MONGOMS_VERSION = "5.0.3";
    process.env.MONGOMS_DEBUG = "1";

    mongoServer = await MongoMemoryServer.create({
        instance: {
            port: 27018, // by default choose any free port
            ip: "127.0.0.1", // by default '127.0.0.1', for binding to all IP addresses set it to `::,0.0.0.0`,
            dbName: "andromeda", // by default '' (empty string)
        }
    });

    // Store the URI for tests to use
    process.env.MONGO_URI = mongoServer.getUri();

    console.log('MongoDB Memory Server started on:', process.env.MONGO_URI);
}

export async function teardown() {
    if (mongoServer) {
        await mongoServer.stop();
        console.log('MongoDB Memory Server stopped');
    }
}

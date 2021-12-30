let zmq = require("zeromq");
const mongoose = require("mongoose");
const Config = require("../../config/config");

class Persistence{

    constructor() {

    }

    async start() {
        await mongoose.connect(Config.getInstance().mongoDbUri)
        const sock = new zmq.Pull
        sock.connect("tcp://127.0.0.1:3000")
        console.log("Worker connected to port 3000")
        for await (const [msg] of sock) {
            console.log("work: %s", msg.toString())
        }
    }

}

module.exports=Persistence;
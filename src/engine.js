// Require external modules
import mongoose from "mongoose";

import {Config} from "./config/config.js";


export class Engine{


    // Run the server!
    start = async (backend, port) => {
        try {
            mongoose.connect(Config.getInstance().mongoDbUri)
                .then(() => console.log('MongoDB connected...'))
                .catch(err => console.log(err))
            await backend.listen(port, "0.0.0.0")
            // backend.swagger()
            backend.log.info(`server listening on ${backend.server.address().port}`)
        } catch (err) {
            backend.log.error(err)
            process.exit(1)
        }
    }


}

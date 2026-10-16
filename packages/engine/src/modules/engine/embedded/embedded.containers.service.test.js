import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

import mongoose from "mongoose";
import {EmbeddedContainerService} from "./embedded.containers.service.js";
import * as net from "net";
import {Config} from "../../../config/config.js";
import Utils from "../../../utils/utils.js";
import assert from "assert";



it('isPortFree', async () => {
    let server = net.createServer(function (socket) {
        console.log("connected");
        socket.on('data', function (data) {
            console.log(data.toString());
        });
    });
    await new Promise((resolve) => server.listen(47400, resolve));


    let available = await EmbeddedContainerService.isPortFree(47400);
    assert.equal(available, false);
    await EmbeddedContainerService.AllocatePortInRange(47401);
    await EmbeddedContainerService.AllocatePortInRange(47401);
    await EmbeddedContainerService.AllocatePortInRange(47402);
    EmbeddedContainerService.portOffset = 47410;
    EmbeddedContainerService.maxAttemptsRange = 0;
    const error = await Utils.getError(async () => await EmbeddedContainerService.AllocatePortInRange());
    assert.deepEqual(error, "cannot allocate port 47410 after 0 attempts")
    EmbeddedContainerService.maxAttemptsRange = 2;
    await EmbeddedContainerService.AllocatePortInRange();
    EmbeddedContainerService.portOffset = 10000;
    EmbeddedContainerService.maxAttemptsRange = 100;
    setTimeout(function () {
        server.close();
    }, 1500)
    // await EmbeddedContainerService.waitForEmbeddedContainerStart(Config.getInstance().deploymentPath,
    //     "test",
    //     10000);

})


it('wait for container to start', async () => {
    let server = net.createServer(function (socket) {
        console.log("connected");
        socket.on('data', function (data) {
            console.log(data.toString());
        });
    });
    server.listen(47405);

    setTimeout(function () {
        server.close();
    }, 1500)
    // await EmbeddedContainerService.waitForEmbeddedContainerStart(Config.getInstance().deploymentPath,
    //     "test",
    //     10000);

})



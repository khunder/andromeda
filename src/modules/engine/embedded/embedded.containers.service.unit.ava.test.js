import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

import mongoose from "mongoose";
import {EmbeddedContainerService} from "./embedded.containers.service.js";
import * as net from "net";
import {Config} from "../../../config/config.js";
import test from "ava"
import Utils from "../../../utils/utils.js";



test('isPortFree', async (t) => {
    let server = net.createServer(function (socket) {
        console.log("connected");
        socket.on('data', function (data) {
            console.log(data.toString());
        });
    });
    server.listen(5000);


    let available = await EmbeddedContainerService.isPortFree(5000);
    t.is(available, false);
    await EmbeddedContainerService.AllocatePortInRange(5001);
    await EmbeddedContainerService.AllocatePortInRange(5001);
    await EmbeddedContainerService.AllocatePortInRange(10000);
    EmbeddedContainerService.maxAttemptsRange = 0;
    const error = await Utils.getError(async () => await EmbeddedContainerService.AllocatePortInRange());
    t.is(error, "cannot allocate port 10000 after 0 attempts")
    EmbeddedContainerService.maxAttemptsRange = 2;
    await EmbeddedContainerService.AllocatePortInRange();
    setTimeout(function () {
        server.close();
    }, 1500)
    // await EmbeddedContainerService.waitForEmbeddedContainerStart(Config.getInstance().deploymentPath,
    //     "test",
    //     10000);

})


test('wait for container to start', async (t) => {
    let server = net.createServer(function (socket) {
        console.log("connected");
        socket.on('data', function (data) {
            console.log(data.toString());
        });
    });
    server.listen(5005);

    setTimeout(function () {
        server.close();
    }, 1500)
    // await EmbeddedContainerService.waitForEmbeddedContainerStart(Config.getInstance().deploymentPath,
    //     "test",
    //     10000);

})



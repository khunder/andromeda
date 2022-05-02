import CommonService from "./common.service.js";
import {Config} from "../config/config.js";
import path from "path";
import fs from "fs";
import Utils from "../utils/utils.js";


import test from 'ava';


test('Common service',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {

//         // given
    Config.getInstance().deploymentPath = path.join(Config.getInstance().deploymentPath, "dep_temp")
    // const temp = CommonService.getTemporaryFolder();
    //when
    await CommonService.createDeploymentFolder();
    //then
    t.is(fs.existsSync(Config.getInstance().deploymentPath), true)
    await Utils.sleep(100);
    t.pass();
});

test('create temporary folders',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {

        // given
        Config.getInstance().tempPath = path.join(Config.getInstance().deploymentPath, "temp")
        // const temp = CommonService.getTemporaryFolder();
        //when
        await CommonService.createTemporaryFolders();
        //then
        t.is(fs.existsSync(Config.getInstance().deploymentPath), true)
        await Utils.sleep(100);
        t.pass()
    });
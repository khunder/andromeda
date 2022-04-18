import {jest} from '@jest/globals'
import CommonService from "./common.service.js";
import {Config} from "../config/config.js";
import path from "path";
import fs from "fs";
import Utils from "../utils/utils.js";



describe("Common service", () => {

    it('create deployment folder', async () => {

        // given
        Config.getInstance().deploymentPath = path.join(Config.getInstance().deploymentPath, "dep_temp")
        // const temp = CommonService.getTemporaryFolder();
        //when
        await CommonService.createDeploymentFolder();
        //then
        expect(fs.existsSync(Config.getInstance().deploymentPath)).toEqual(true)
        await Utils.sleep(100);
    });

    it('create temporary folders', async () => {

        // given
        Config.getInstance().tempPath = path.join(Config.getInstance().deploymentPath, "temp")
        // const temp = CommonService.getTemporaryFolder();
        //when
        await CommonService.createTemporaryFolders();
        //then
        expect(fs.existsSync(Config.getInstance().deploymentPath)).toEqual(true)
        await Utils.sleep(100);
    });

})
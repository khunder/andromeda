import assert from 'assert';
import {Config} from "../config/config.js";
import path from "path";
import CommonService from "./common.service.js";
import fs from "fs";

it('should create deployment folder', async () => {
    Config.getInstance().deploymentPath = path.join(Config.getInstance().deploymentPath, "dep_temp")
    //when
    await CommonService.createDeploymentFolder();
    assert.equal(fs.existsSync(Config.getInstance().deploymentPath), true)

});
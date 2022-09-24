import Utils from "./utils.js";
import constants from "../config/constants.js";
import assert from "assert";


describe('getStartElements', function () {


    it('getStartElements', async () => {
        const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
        assert.equal(serverIsAvailable, true);
        const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
        assert.equal(unknownModuleIsAvailable, false)
    })
})




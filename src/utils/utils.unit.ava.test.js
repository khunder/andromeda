

import Utils from "./utils.js";
import constants from "../config/constants.js";



it('getStartElements', async (t) => {
        const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
        assert.equal(serverIsAvailable, true);
        const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
        assert.equal(unknownModuleIsAvailable, false)
})




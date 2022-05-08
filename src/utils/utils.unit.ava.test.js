

import Utils from "./utils.js";
import constants from "../config/constants.js";
import test from "ava";



test('getStartElements', async (t) => {
        const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
        t.is(serverIsAvailable, true);
        const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
        t.is(unknownModuleIsAvailable, false)
})




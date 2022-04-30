

import Utils from "./utils.js";
import constants from "../config/constants.js";
import test from "ava";


const getError = async (call) => {
    try {
        await call();
    } catch (error) {
        return error;
    }
};



test('getStartElements', async (t) => {
        const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
        t.is(serverIsAvailable, true);
        const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
        t.is(unknownModuleIsAvailable, false)
})




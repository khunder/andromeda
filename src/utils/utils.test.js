

import Utils from "./utils.js";
import constants from "../config/constants.js";



describe("Utils Helper", () => {
    const getError = async (call) => {
        try {
            await call();
        } catch (error) {
            return error;
        }
    };

    it('getStartElements', async () => {
            const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
            expect(serverIsAvailable).toEqual(true);
            const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
            expect(unknownModuleIsAvailable).toEqual(false);
    })



})
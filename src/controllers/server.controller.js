const boom = require("@hapi/boom");
const ContainerContext = require("../model/container.context");
const EngineService = require("../services/engine.service");


class ServerController {

    static compile = async (req, reply) => {
        try {

            const ctx = new ContainerContext({
                deploymentId: "wee",
                model: null,
                isTestContainer: false,
            });

            await new EngineService().generateContainer("wee", ctx);
        } catch (err) {
            throw boom.boomify(err)
        }
    }

}

module.exports = ServerController
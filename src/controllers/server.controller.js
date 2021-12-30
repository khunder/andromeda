const boom = require("@hapi/boom");
const ContainerContext = require("../model/container.context");
const EngineService = require("../services/engine.service");
const  AndromedaLogger = require("../config/andromeda-logger");
const {boomify} = require("@hapi/boom");
const fs = require("fs");
const Logger = new AndromedaLogger();
let BPMNModdle= require('bpmn-moddle')

class ServerController {

    static compile = async (req, reply) => {
        try {

            const ctx = new ContainerContext({
                deploymentId: "wee",
                model: null,
                isTestContainer: false,
            });

            ctx.bpmnContent = fs.readFileSync(req.file.path, { encoding: 'utf8' })
            ctx.model = await new BPMNModdle().fromXML(ctx.bpmnContent, () => null);
            await new EngineService().generateContainer("wee", ctx);
            return {};
        } catch (err) {
            Logger.error(boom.boomify(err));
            const returnError = new Error();
            returnError.statusCode = 500;
            returnError.message = boom.boomify(err);
            returnError.stack=err;
            throw returnError;
        }
    }

}

module.exports = ServerController
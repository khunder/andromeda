import boom from "boom";
import {ProcessInstance} from "../persistence/models/process.instance.js";
import {RepositoryBase} from "../persistence/repository.base.js";
import {Engine} from "../engine.js";
import {ContainerContext} from "../model/container.context.js";
import {EngineService} from "../services/engine.service.js";



export const compile = async (req, reply) => {
  try {

    const ctx = new ContainerContext({
      deploymentId: "wee",
      model : null,
      isTestContainer: false,
    });

    await new EngineService().generateContainer("wee", ctx);
  } catch (err) {
    throw boom.boomify(err)
  }
}

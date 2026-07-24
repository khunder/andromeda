import nunjucks from "nunjucks";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {OpenApiGenerator} from "../../utils/open-api.generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContainerCodegenContext {
   openApiCodegen = new OpenApiGenerator()

   /**
    * One entry per workflow compiled into this container -
    * {processDef, serviceClassName, serviceImportPath, workflowModelImportPath, timerModelImportPath} -
    * pushed to by WorkflowBuilder.generateWorkflow. Backs both the generated
    * service registry (registry.js) and the container-wide timer service,
    * which need to resolve "the right service/model for this processDef" at
    * runtime instead of importing one hardcoded workflow.
    */
   registryEntries = [];


    constructor() {
        this.openApiCodegen
            .setInfo({
                description: "Container swagger specification",
                version: "0.0.0",
                title: "Container swagger specification",
            })
            .setInfoVersion("1.0.0")
            .setInfoContactEmail("benrhoumazied@gmail.com")
    }

    /**
    * Renders this one workflow's own route file (autoloaded by fastify
    * alongside every other workflow's) - kept per workflow, rather than one
    * shared route.js, so two workflows' routes coexist instead of the
    * second overwriting the first.
    * @param {string} normalizedProcessDef
    * @param {ContainerParsingContext} containerParsingContext
    * @param {Array<{verb: string, path: string, method: string}>} routes
    */
   renderRoutes(normalizedProcessDef, containerParsingContext, routes) {
      nunjucks.configure({
         autoescape: false,
         trimBlocks: true,
         lstripBlocks: true,
      });

      let routesRenderPath = `./deployments/${containerParsingContext.deploymentId}/src/routes/${normalizedProcessDef.toLowerCase()}.route.js`

      let template = fs.readFileSync(
          path
              .join(
                  __dirname,
                  '../../modules/engine/builder/templates/src/routes/probe.routes.js.njk',
              )
              .toString(),
      ).toString()
      const renderedTemplate = nunjucks.renderString(
          template,
          {
             normalizedProcessDef: normalizedProcessDef,
             routes: routes
          },
      );

      fs.writeFileSync(routesRenderPath, renderedTemplate)

   }

   /**
    * Renders the generated service registry (src/modules/container/registry.js) -
    * maps each processDef compiled into this container to its
    * ProcessInstanceService class and WorkflowModel, so container-wide code
    * (the timer service, the generic timer catch resume job) can resolve the
    * right one at runtime rather than importing one hardcoded workflow.
    * Called once, after every workflow has been built.
    * @param {ContainerParsingContext} containerParsingContext
    */
   renderRegistry(containerParsingContext) {
      nunjucks.configure({
         autoescape: false,
         trimBlocks: true,
         lstripBlocks: true,
      });

      let registryRenderPath = `./deployments/${containerParsingContext.deploymentId}/src/modules/container/registry.js`

      let template = fs.readFileSync(
          path
              .join(
                  __dirname,
                  '../../modules/engine/builder/templates/src/modules/container/registry.js.njk',
              )
              .toString(),
      ).toString()
      const renderedTemplate = nunjucks.renderString(
          template,
          {entries: this.registryEntries},
      );

      fs.writeFileSync(registryRenderPath, renderedTemplate)
   }

   /**
    * Renders the container-wide timer service (src/modules/timer/timer.service.js) -
    * one shared scheduler for every workflow's timer start/catch events in
    * this container, built from the same registryEntries as renderRegistry().
    * Called once, after every workflow has been built (unlike routes/the
    * workflow model, timers aren't split per workflow - one node-cron
    * scheduler/timer-job dispatcher serves the whole container).
    * @param {ContainerParsingContext} containerParsingContext
    */
   renderTimerService(containerParsingContext) {
      nunjucks.configure({
         autoescape: false,
         trimBlocks: true,
         lstripBlocks: true,
      });

      let timerServiceRenderPath = `./deployments/${containerParsingContext.deploymentId}/src/modules/timer/timer.service.js`

      let template = fs.readFileSync(
          path
              .join(
                  __dirname,
                  '../../modules/engine/builder/templates/src/modules/timer/timer.service.js.njk',
              )
              .toString(),
      ).toString()
      const renderedTemplate = nunjucks.renderString(
          template,
          {entries: this.registryEntries},
      );

      fs.writeFileSync(timerServiceRenderPath, renderedTemplate)
   }
}

export default ContainerCodegenContext;
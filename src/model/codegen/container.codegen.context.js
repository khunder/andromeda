import nunjucks from "nunjucks";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {OpenApiGenerator} from "../../utils/open-api.generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ContainerCodegenContext {
   openApiCodegen = new OpenApiGenerator()
   routes = [];


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
    *
    * @param {string} normalizedProcessDef
    * @param {ContainerParsingContext} containerParsingContext
    */
   renderRoutes(normalizedProcessDef, containerParsingContext) {
      nunjucks.configure({
         autoescape: false,
         trimBlocks: true,
         lstripBlocks: true,
      });

      let routesRenderPath = `./deployments/${containerParsingContext.deploymentId}/src/routes/route.js`

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
             routes: this.routes
          },
      );

      fs.writeFileSync(routesRenderPath, renderedTemplate)

   }
}

export default ContainerCodegenContext;
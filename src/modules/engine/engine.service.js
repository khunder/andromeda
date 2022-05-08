import {AndromedaLogger} from "../../config/andromeda-logger.js";
import path from "path";
import fs from "fs";
import ContainerCodegenContext from "../../model/codegen/container.codegen.context.js";
import WorkflowBuilder from "./workflow.builder.js";
import {fileURLToPath} from "url";
import nunjucks from "nunjucks";
import {Config} from "../../config/config.js";
import {Shell} from "../../services/shell.js";


const Logger = new AndromedaLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EngineService {
    getDeploymentPath(ctx) {
        return path.join(Config.getInstance().deploymentPath, ctx.deploymentId);
    }

    /**
     * snjk = static njk files, files that are not going to change, like package.json, app.sjs etc..
     * @param dir: string
     * @param sourcePath: string
     * @param containerContext: ContainerParsingContext
     */
    generateStaticFiles(dir, sourcePath, containerContext) {
        let files = fs.readdirSync(dir)
        files.forEach(function (entry) {
            let filePath = path.join(dir, entry)
            if (fs.statSync(filePath).isDirectory()) {
                if (!fs.existsSync(path.join(sourcePath, "/", entry))) {
                    fs.mkdirSync(path.join(sourcePath, "/", entry));
                }
                this.generateStaticFiles(filePath, path.join(sourcePath, entry))
            } else {
                const extension = entry.split('.').pop()
                Logger.debug(`copying static file ${entry}`);
                if (extension === "snjk") {
                    let fileName = entry.split('.').slice(0, -1).join('.');
                    fs.writeFileSync(path.join(sourcePath, fileName), fs.readFileSync(filePath, 'utf-8'));
                }
                if (extension === "js") {
                    fs.writeFileSync(path.join(sourcePath, entry), fs.readFileSync(filePath, 'utf-8'));
                }
            }
        }.bind(this));
    }

    copyModuleIntoContainer(dir, sourcePath) {
        let files = fs.readdirSync(dir)
        files.forEach(function (entry) {
            let filePath = path.join(dir, entry)
            if (fs.statSync(filePath).isDirectory()) {
                if (!fs.existsSync(path.join(sourcePath, "/", entry))) {
                    fs.mkdirSync(path.join(sourcePath, "/", entry));
                }
                this.copyModuleIntoContainer(filePath, path.join(sourcePath, entry))
            } else {
                fs.writeFileSync(path.join(sourcePath, entry), fs.readFileSync(filePath, 'utf-8'));
            }
        }.bind(this));
    }

    /**
     *
     * @param {ContainerParsingContext} containerParsingContext
     * @returns {Promise<void>}
     */
    async generateContainer(containerParsingContext) {
        const deploymentPath = this.getDeploymentPath(containerParsingContext);
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            Shell.mkdir(deploymentPath);
        }

        // if (!containerParsingContext.workflowParsingContext.model || containerParsingContext.model.size === 0) {
        //     Logger.error(`no bpmn model found to generate`);
        //     throw new Error('Cannot generate container, no model found');
        // }
        if(containerParsingContext.includePersistenceModule){
            this.GenerateModule(deploymentPath, "persistence");
        }

        if(containerParsingContext.includeGalaxyModule){
            this.GenerateModule(deploymentPath, "galaxy");
        }

        if(containerParsingContext.includeWebModule){
            this.GenerateModule(deploymentPath, "web");
        }

        const templatePath = path.join(process.cwd(), "src", "modules", "engine", "builder", "templates");
        this.generateStaticFiles(templatePath, deploymentPath , containerParsingContext)

        // common codegen context, contains common things such as routes
        const containerCodegenContext = new ContainerCodegenContext();

        this.addLivelinessProbe(containerCodegenContext);
        this.addReadinessProbe(containerCodegenContext);


        for (const bpmnModel of containerParsingContext.workflowParsingContext) {
            await new WorkflowBuilder().generateWorkflow(bpmnModel, containerParsingContext, containerCodegenContext);

        }


        this.generateOpenApiYaml(containerParsingContext, containerCodegenContext);
        //
        // await Promise.all(
        //     Array.from(containerContext.model.keys()).map(async (processDef) => {
        //         await this.workflowBuilder.generateWorkflow(
        //             processDef,
        //             containerContext.model.get(processDef),
        //             containerContext,
        //         );
        //     }),
        // );
    }

    addLivelinessProbe(containerCodegenContext) {
        containerCodegenContext.openApiCodegen.addPath("/live", "get")
            .addPathDescription("/live", "get", "Liveliness probe (health check)")
            .addPathTags("/live", "get", ["Startup probe"])
            .addResponse("/live", "get", {
                "200": {
                    "description": "Server is alive",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "example": {
                                    "status": "..."
                                }
                            }
                        }
                    }
                }
            })
    }

    addReadinessProbe(containerCodegenContext) {
        containerCodegenContext.openApiCodegen.addPath("/ready", "get")
            .addPathDescription("/ready", "get", "Readiness probe (ready status, after all initialisations)")
            .addPathTags("/ready", "get", ["Startup probe"])
            .addResponse("/ready", "get", {
                "200": {
                    "description": "Server is Ready",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "example": {
                                    "status": "ready"
                                }
                            }
                        }
                    }
                }
            })
    }


    GenerateModule(deploymentPath, moduleName) {
        const persistenceModulePathSource = path.join(process.cwd(), "src", "modules", moduleName);
        const persistenceModulePathDestination = path.join(deploymentPath, "src", "modules");
        if (!fs.existsSync(path.join(deploymentPath,"src"))) {
            fs.mkdirSync(path.join(deploymentPath,"src"));
        }
        if (!fs.existsSync(persistenceModulePathDestination)) {
            fs.mkdirSync(persistenceModulePathDestination);
        }
        if (!fs.existsSync(path.join(persistenceModulePathDestination, moduleName))) {
            fs.mkdirSync(path.join(persistenceModulePathDestination, moduleName));
        }
        this.copyModuleIntoContainer(persistenceModulePathSource, deploymentPath + `/src/modules/${moduleName}`)
    }



    /**
     *
     * @param ctx : ContainerParsingContext
     * @param containerCodegenContext : ContainerCodegenContext
     */
    generateOpenApiYaml(ctx, containerCodegenContext) {
        // let template = fs.readFileSync(
        //     path
        //         .join(
        //             __dirname,
        //             './builder/templates/specification.yaml.njk',
        //         )
        //         .toString(),
        // ).toString();
        //
        // const renderedTemplate = nunjucks.renderString(
        //     template,
        //     {},
        // );

        fs.writeFileSync(path.join(this.getDeploymentPath(ctx), "specification.yaml"), containerCodegenContext.openApiCodegen.render());
    }

    /**
     * run the container as a node process side by side with the engine --> useful for sandbox mode
     * @returns {Promise<void>}
     */



}

export default EngineService
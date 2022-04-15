import {AndromedaLogger} from "../../config/andromeda-logger.js";
import http from "http";
import path from "path";
import CommonService from "../../services/common.service.js";
import fs from "fs";
import shelljs from "shelljs";
import ContainerCodegenContext from "../../model/codegen/container.codegen.context.js";
import WorkflowBuilder from "./workflow.builder.js";
import {Config} from "../../config/config.js";
import {fileURLToPath} from "url";
import nunjucks from "nunjucks";
import utils from "../../utils/utils.js";
import forever from "forever";

const Logger = new AndromedaLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EngineService {
    isPortFree = (port) =>
        new Promise((resolve) => {
            const server = http
                .createServer()
                .listen(port, () => {
                    server.close();
                    Logger.trace(`port ${port} is free`);
                    resolve(true);
                })
                .on('error', () => {
                    Logger.trace(`port ${port} is not free`);
                    resolve(false);
                });
        });

    getDeploymentPath(ctx) {
        return path.join(CommonService.getDeploymentPath(), ctx.deploymentId);
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
                if (extension === "snjk") {
                    let fileName = entry.split('.').slice(0, -1).join('.');
                    fs.writeFileSync(path.join(sourcePath, fileName), fs.readFileSync(filePath, 'utf-8'));
                }
            }
        }.bind(this));
    }


    copyModule(dir, sourcePath) {
        let files = fs.readdirSync(dir)
        files.forEach(function (entry) {
            let filePath = path.join(dir, entry)
            if (fs.statSync(filePath).isDirectory()) {
                if (!fs.existsSync(path.join(sourcePath, "/", entry))) {
                    fs.mkdirSync(path.join(sourcePath, "/", entry));
                }
                this.copyModule(filePath, path.join(sourcePath, entry))
            } else {
                fs.writeFileSync(path.join(sourcePath, entry), fs.readFileSync(filePath, 'utf-8'));
            }
        }.bind(this));
    }

    async generateContainer(containerParsingContext) {
        const deploymentPath = this.getDeploymentPath(containerParsingContext);
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            shelljs.mkdir('-p', deploymentPath);
        }

        // if (!containerParsingContext.workflowParsingContext.model || containerParsingContext.model.size === 0) {
        //     Logger.error(`no bpmn model found to generate`);
        //     throw new Error('Cannot generate container, no model found');
        // }
        this.GeneratePersistenceModule(deploymentPath);
        const templatePath = path.join(process.cwd(), "src", "modules", "engine", "builder", "templates");
        this.generateStaticFiles(templatePath, deploymentPath, containerParsingContext)

        const containerCodegenContext = new ContainerCodegenContext();
        containerParsingContext.workflowParsingContext.forEach(parsedModel => {
            new WorkflowBuilder().generateWorkflow(parsedModel, containerParsingContext, containerCodegenContext);
        })


        this.generateOpenApiYaml(containerParsingContext);

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

    GeneratePersistenceModule(deploymentPath) {
        const persistenceModulePathSource = path.join(process.cwd(), "src", "modules", "persistence");
        const persistenceModulePathDestination = path.join(deploymentPath, "modules");
        if (!fs.existsSync(persistenceModulePathDestination)) {
            fs.mkdirSync(persistenceModulePathDestination);
        }
        if (!fs.existsSync(path.join(persistenceModulePathDestination, "persistence"))) {
            fs.mkdirSync(path.join(persistenceModulePathDestination, "persistence"));
        }
        this.copyModule(persistenceModulePathSource, deploymentPath + "/modules/persistence")
    }

    extractWorkflowPrefix(containerContext) {
        if (!containerContext.model)
            return undefined;
    }

    static sleep(ms) {

        return new Promise((resolve, reject) => {
            setTimeout(resolve, ms, [])
        })
    }

    /**
     *
     * @param ctx : ContainerParsingContext
     */
    generateOpenApiYaml(ctx) {
        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/specification.yaml.njk',
                )
                .toString(),
        ).toString();

        const renderedTemplate = nunjucks.renderString(
            template,
            {},
        );
        fs.writeFileSync(path.join(this.getDeploymentPath(ctx), "specification.yaml"), renderedTemplate);
    }

    /**
     * run the container as a node process side by side with the engine --> useful for sandbox mode
     * @returns {Promise<void>}
     */

    async startEmbeddedContainer(deploymentId, options) {
        let allocatedPort;
        if (options && options.port) {
            allocatedPort = options.port
        } else {
            allocatedPort = await utils.AllocatePortInRange();
        }


        Logger.info(`starting container on port ${allocatedPort}`)
        let deploymentPath = `./deployments/${deploymentId}`;
        let childProcess;


        let executor = '';
        let args = []


        executor = path.join(process.cwd(), "deployments", deploymentId, "/app.js")


        if (fs.existsSync(`${deploymentPath}/pid`)) {
            try {
                fs.unlinkSync(`${deploymentPath}/pid`)
                //file removed
            } catch (err) {
                Logger.error(err)
            }
        }

        try {
            childProcess = forever.start(executor, {
                max: 1,
                silent: false,
                killTree: true,
                // sourceDir: deploymentPath ,
                env: {
                    container_port: String(allocatedPort),
                    MONGODB_URI: Config.getInstance().mongoDbUri,
                    deploymentId: deploymentId,
                    JSFLOW_LOCAL_MODE: process.env.JSFLOW_LOCAL_MODE,
                    ENABLE_FLUENT_BIT: process.env.ENABLE_FLUENT_BIT || "true"
                },
                cwd: deploymentPath,
                args: args
            });

        } catch (e) {
            Logger.error(e)
        }


        if (!childProcess || !childProcess.child || !childProcess.child.pid) {
            throw new Error(`cannot start child process`);
        }

        Logger.trace(`storing PID= ${childProcess.child.pid}, for process ${deploymentId}, on port ${allocatedPort}`)
        // this.containers.set(deploymentId, new ContainerModel(childProcess.child.pid, allocatedPort, deploymentId));
        // if (this.enableDaemonMode) {
        //     this.trackPid(childProcess.child.pid);
        // }
        const runContainer = async () => {
            if (fs.existsSync(deploymentPath + "/pid")) {
                Logger.info(`Found process id (PID), for process ${deploymentId}, on port ${allocatedPort}`)
                return true;
            } else {
                Logger.trace(`waiting for the container ${deploymentId} to connect on port ${allocatedPort}`)
                await EngineService.sleep(1000)
                return false;
            }
        };

        let numberOfAttempts = 40;
        Logger.info(`Waiting for the container ${deploymentId} to connect on port ${allocatedPort}`)
        for (let i = 0; i < numberOfAttempts; i++) {
            if (await runContainer()) {
                break;
            }
            if (i === numberOfAttempts - 1) {
                Logger.error(`Cannot start container:${deploymentId} Max number of attempts reached, on port ${allocatedPort}`);
                // await this.stopContainerByDeploymentId(deploymentId)
                throw `cannot start container`;
            }
        }
        return allocatedPort;
    }

}

export default EngineService
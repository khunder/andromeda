
import BpmnProcessor from "./builder/bpmn.processor.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import fs from "fs";
import nunjucks from "nunjucks";
import WorkflowCodegenContext from "../../model/codegen/workflow.codegen.context.js";
import path from "path";
import {fileURLToPath} from "url";
import Utils from "../../utils/utils.js";

const Logger = new AndromedaLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowBuilder {
    constructor() {
        nunjucks.configure({
            autoescape: false,
            trimBlocks: true,
            lstripBlocks: true,
        });
    }

    bpmnProcessor = new BpmnProcessor();


    normalizeProcessDefWithoutVersion(processDef) {
        const result = processDef;
        const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
        return result.replace(regex, `$1`);
    }

    upperFirstChar(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    async generateEmbeddedContainer(element, workflowCodegenContext, containerParsingContext) {
        let self = this;
        // search start
        // generate code
        const startElements = this.getStartElements(element);
        startElements.forEach(startElement => {
            self.generate(startElement, workflowCodegenContext, containerParsingContext);
        })
        let embeddedEventSubprocesses = this.getEventSubProcess(element);
        embeddedEventSubprocesses.forEach(container => {
            self.generateEmbeddedContainer(container, workflowCodegenContext, containerParsingContext)
        })
    }

    /**
     *
     * @param element : FlowNode
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     * @returns {Promise<void>}
     */
    async generate(element, workflowCodegenContext, containerParsingContext) {
        this.bpmnProcessor.process(element, workflowCodegenContext, containerParsingContext);
    }

    /**
     * entry point for code generation
     * @param bpmnModel : WorkflowParsingContext
     * @param containerParsingContext : ContainerParsingContext
     * @param containerCodegenContext : ContainerCodegenContext
     * @returns {Promise<void>}
     */
    async generateWorkflow(
        bpmnModel,
        containerParsingContext,
        containerCodegenContext
    ) {
        // each bpmn file can contain multiple process node
        const processesInBpmnFile = this.getProcessesModel(bpmnModel.model);

        const normalizedProcessDef = this.normalizeProcessDefWithoutVersion(bpmnModel.processPrefix);

        const workflowCodegenContext = new WorkflowCodegenContext(containerCodegenContext);

        await this.generateServiceClass(normalizedProcessDef, bpmnModel, containerParsingContext, workflowCodegenContext)
        await this.generateWorkflowContext(normalizedProcessDef, bpmnModel, containerParsingContext)

        await this.generateContainerControllerClass(normalizedProcessDef, bpmnModel, containerParsingContext, workflowCodegenContext)

        await this.generateWorkflowModelClass(normalizedProcessDef,bpmnModel,containerParsingContext,workflowCodegenContext)

        processesInBpmnFile.forEach(process => {
            this.generateProcess(process, workflowCodegenContext, containerParsingContext);

        });

        containerCodegenContext.renderRoutes(normalizedProcessDef, containerParsingContext);
        workflowCodegenContext.renderImports()
        workflowCodegenContext.serviceClassFile.formatText({
            placeOpenBraceOnNewLineForFunctions: true,
        });
        await workflowCodegenContext.project.saveSync();


        // for each process create a start method

        // in each start method
        // call event subprocess start method
        // call start node (simple start)

        // detect
        // simple start
        // event based start (all types) scheduled, message ....
        // process each node and all the nodes linked to it
        // process all the nodes in an adhoc subprocess


        // const buildContext = new ProcessInstanceBuildContext();
        // this.generateServiceClass(processDef, buildContext, containerParsingContext);
        // // this.generateVariableContextHandlerClass(processDef, containerParsingContext);
        // this.generateControllerClass(processDef, buildContext, containerParsingContext);
        // this.generateVariable(
        //   processesInBpmnFile,
        //   this.normalizeProcessDefWithoutVersion(processDef),
        //   buildContext,
        //   containerParsingContext,
        // );
        // // this.createWorkflowWorker(processDef, containerParsingContext);
        // startElements.forEach((startElement) => {
        //   this.generateContentForElement(startElement, buildContext);
        // });
        // buildContext.renderImports();
        // buildContext.serviceClassFile.formatText({ trimTrailingWhitespace: true });
        // buildContext.controllerClass.formatText({ trimTrailingWhitespace: true });
        // buildContext.project.saveSync();
    }

    /**
     *
     * @param {string} normalizedProcessDef
     * @param parsedModel
     * @param {ContainerParsingContext} workflowParsingContext
     * @param {WorkflowCodegenContext} workflowCodegenContext
     * @returns {Promise<void>}
     */
    async generateServiceClass(
        normalizedProcessDef,
        parsedModel,
        workflowParsingContext,
        workflowCodegenContext,
    ) {

        const serviceFileName = this.getServiceFileName(normalizedProcessDef);
        const serviceClassName = this.getServiceClassName(normalizedProcessDef);


        let serviceFilePath = `./deployments/${workflowParsingContext.deploymentId}/src/services/${serviceFileName}.js`

        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/src/services/service.njk',
                )
                .toString(),
        ).toString()
        const renderedTemplate = nunjucks.renderString(
            template,
            {
                ServiceFileName: serviceFileName,
                ServiceClassName: serviceClassName,
                ProcessDef: normalizedProcessDef,
            },
        );

        workflowCodegenContext.serviceClassFile = workflowCodegenContext.project.createSourceFile(
            serviceFilePath,
            renderedTemplate,
            {overwrite: true},
        );
        workflowCodegenContext.serviceClass = workflowCodegenContext.serviceClassFile.getClassOrThrow(serviceClassName)
    }



    /**
     *
     * @param {string} normalizedProcessDef
     * @param parsedModel
     * @param {ContainerParsingContext} containerParsingContext
     * @returns {Promise<void>}
     */
    async generateWorkflowContext(
        normalizedProcessDef,
        parsedModel,
        containerParsingContext) {


        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/src/services/process-instance-context.js.njk',
                )
                .toString(),
        ).toString()

        const renderedTemplate = nunjucks.renderString(
            template,
            {
                ProcessDef: normalizedProcessDef,
            },
        );
        let destFile = path.join(Utils.getDeploymentPath(containerParsingContext), "src", "services", `${normalizedProcessDef.toLowerCase()}.process-instance-context.js`);
        fs.writeFileSync(
            destFile,
            renderedTemplate,
        );

    }

    /**
     *
     * @param process : Process
     * @param workflowCodegenContext : WorkflowCodegenContext
     * @param containerParsingContext : ContainerParsingContext
     */
    generateProcess(process, workflowCodegenContext, containerParsingContext) {
        let startElements = this.getStartElements(process);
        startElements.forEach(startElement => {
            this.generate(startElement, workflowCodegenContext, containerParsingContext).then(r => {
            });
        });

        let embeddedEventSubprocesses = this.getEventSubProcess(process);
        embeddedEventSubprocesses.forEach(async (container) => {
            await this.generateEmbeddedContainer(container, workflowCodegenContext, containerParsingContext)
        });
    }


    /**
     *
     * @param normalizedProcessDef : string
     * @returns {string}
     */
    getServiceFileName(normalizedProcessDef) {
        return normalizedProcessDef.toLowerCase() + '.process-instance.service';
    }

    getServiceClassName(normalizedProcessDef) {
        return this.upperFirstChar(normalizedProcessDef) + 'ProcessInstanceService';
    }


    getStartElements(bpmnProcess) {
        if (!bpmnProcess) {
            throw new Error(
                `cannot compile file missing a process in the root elements`,
            );
        }
        // message start event + (non interrupting)
        // Timer start event + (non interrupting)
        // conditional start event + (non interrupting)
        // signal start event + (non interrupting)
        // error start event
        // Escalation start event + (non interrupting)
        // Compensation start event

        // search event subprocess, because they are triggered automatically
        return (
            bpmnProcess.flowElements.filter(
                (e) =>
                    e.$type === 'bpmn:StartEvent'
            )
        );
    }

    getEventSubProcess(bpmnProcess) {
        if (!bpmnProcess) {
            throw new Error(
                `cannot compile file missing a process in the root elements`,
            );
        }

        // search event subprocess, because they are triggered automatically
        return (
            bpmnProcess.flowElements.filter(
                (e) =>
                    e.$type === 'bpmn:SubProcess' && e.triggeredByEvent === true
            )
        );
    }

    getProcessesModel(model) {
        return model.rootElement.rootElements.filter((e) => e.$type === 'bpmn:Process');
    }

    /**
     *
     * @param {string} normalizedProcessDef
     * @param {WorkflowParsingContext} bpmnModel
     * @param {ContainerParsingContext} containerParsingContext
     * @param {WorkflowCodegenContext} workflowCodegenContext
     */
    generateContainerControllerClass(normalizedProcessDef, bpmnModel, containerParsingContext, workflowCodegenContext) {
            const controllerName= `${normalizedProcessDef}Controller`

        workflowCodegenContext.containerCodegenContext.openApiCodegen.addPath("/start" , "post")
        workflowCodegenContext.containerCodegenContext.openApiCodegen.addResponse("/start" , "post" , {
            "responses": {
                "200": {
                    "description": "Process instance id"
                },
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "deploymentId": {
                                        "type": "string"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        workflowCodegenContext.containerCodegenContext.routes.push({verb: "POST", path: "/start" , method: "start"})


        let serviceFilePath = `./deployments/${containerParsingContext.deploymentId}/src/controllers/${controllerName}.js`

        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/src/controllers/controller.njk',
                )
                .toString(),
        ).toString()
        const renderedTemplate = nunjucks.renderString(
            template,
            {
                ControllerFileName: controllerName,
                ControllerClassName: controllerName,
                startMethod : { name: normalizedProcessDef},
                ProcessDef: normalizedProcessDef,
            },
        );
        workflowCodegenContext.addControllerClassImport(`${normalizedProcessDef}ProcessInstanceService`,`../services/${normalizedProcessDef.toLowerCase()}.process-instance.service.js`)
        workflowCodegenContext.controllerClassFile = workflowCodegenContext.project.createSourceFile(
            serviceFilePath,
            renderedTemplate,
            {overwrite: true},
        );

    }


    async generateWorkflowModelClass(normalizedProcessDef, bpmnModel, containerParsingContext, workflowCodegenContext) {
        let workflowModelPath = `./deployments/${containerParsingContext.deploymentId}/src/modules/container/workflow-model.js`
        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/src/modules/container/workflow-model.js',
                )
                .toString(),
        ).toString()

        workflowCodegenContext.workflowModelFile = workflowCodegenContext.project.createSourceFile(
            workflowModelPath,
            template,
            {overwrite: true},
        );

        workflowCodegenContext.workflowModelClass = workflowCodegenContext.workflowModelFile.getClassOrThrow("WorkflowModel");

    }
}

export default WorkflowBuilder;
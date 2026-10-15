
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

        await this.generateTimerModelClass(normalizedProcessDef,bpmnModel,containerParsingContext,workflowCodegenContext)

        processesInBpmnFile.forEach(process => {
            this.generateProcess(process, workflowCodegenContext, containerParsingContext);

        });

        containerCodegenContext.registryEntries.push({
            processDef: normalizedProcessDef,
            serviceClassName: this.getServiceClassName(normalizedProcessDef),
            serviceImportPath: `../../services/${normalizedProcessDef.toLowerCase()}.process-instance.service.js`,
            workflowModelImportPath: `./${normalizedProcessDef.toLowerCase()}.workflow-model.js`,
            timerModelImportPath: `./${normalizedProcessDef.toLowerCase()}.timer-model.js`,
        });

        containerCodegenContext.renderRoutes(normalizedProcessDef, containerParsingContext, workflowCodegenContext.routes);
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

        this.renderTemplateToDeployment(
            './builder/templates/src/services/process-instance-context.js.njk',
            ["src", "services", `${normalizedProcessDef.toLowerCase()}.process-instance-context.js`],
            {
                ProcessDef: normalizedProcessDef,
                processVariables: this.getProcessVariables(parsedModel.model),
            },
            containerParsingContext,
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
     * Reads <bpmn:property> declarations off the process element (e.g.
     * <bpmn:property id="p1" itemSubjectRef="_ageItem" name="age" />, paired with
     * an <bpmn:itemDefinition id="_ageItem" structureRef="number" />) into the
     * {name, type} pairs the process-instance-context template generates
     * typed variable accessors for.
     * @param model
     * @returns {Array<{name: string, type: string}>}
     */
    getProcessVariables(model) {
        const variables = [];
        this.getProcessesModel(model).forEach((bpmnProcess) => {
            (bpmnProcess.properties || []).forEach((property) => {
                if (!property.name) {
                    Logger.warn(`skipping unnamed process property on ${bpmnProcess.id}`);
                    return;
                }
                variables.push({
                    name: property.name,
                    type: property.itemSubjectRef?.structureRef || 'string',
                });
            });
        });
        return variables;
    }

    /**
     * Maps a BPMN itemDefinition structureRef to an OpenAPI schema type + example value.
     * @param {string} type
     * @returns {{schema: object, example: *}}
     */
    mapVariableType(type) {
        switch (type) {
            case 'number':
                return {schema: {type: 'number'}, example: 0};
            case 'boolean':
                return {schema: {type: 'boolean'}, example: true};
            case 'object':
                return {schema: {type: 'object'}, example: {}};
            case 'Date':
                return {schema: {type: 'string', format: 'date-time'}, example: new Date().toISOString()};
            case 'file':
                // the stored reference, see the container's src/modules/files/file.service.js
                return {schema: {type: 'object', description: 'File reference: fileName, contentType, size, sha256, storage, key'}, example: {}};
            case 'string':
            default:
                return {schema: {type: 'string'}, example: 'value'};
        }
    }

    /**
     * Builds an OpenAPI schema (with a matching example) for the JSON "variables"
     * request body property, from a process's declared <bpmn:property> variables.
     * @param {Array<{name: string, type: string}>} processVariables
     * @returns {object}
     */
    buildVariablesSchema(processVariables) {
        const schema = {
            type: 'object',
            description: 'Process variables to set on the new process instance',
            properties: {},
            example: {}
        };
        processVariables
            // file variables are set through `files` (see buildFilesSchema), not here
            .filter((variable) => variable.type !== 'file')
            .forEach((variable) => {
                const {schema: propertySchema, example} = this.mapVariableType(variable.type);
                schema.properties[variable.name] = propertySchema;
                schema.example[variable.name] = example;
            });
        return schema;
    }

    /**
     * OpenAPI pieces for a process's `file` variables: the JSON `files`
     * object (one base64/url/path source per file variable), and the
     * multipart parts (one binary part per file variable, named after it).
     * See the container's src/modules/files/file-inputs.js.
     * @param {Array<{name: string, type: string}>} processVariables
     * @returns {{filesSchema: object, multipartParts: object, forceSchema: object}}
     */
    buildFilesSchema(processVariables) {
        const fileVariables = processVariables.filter((variable) => variable.type === 'file');
        const source = {
            type: 'object',
            description: 'Exactly one of base64, url or path',
            properties: {
                base64: {type: 'string', description: 'File content, base64 or a data: URL'},
                url: {type: 'string', format: 'uri', description: 'http(s) URL the container downloads the file from'},
                path: {type: 'string', description: 'Path relative to the container\'s FILE_INPUT_DIR (disabled when unset)'},
                fileName: {type: 'string'},
                contentType: {type: 'string'},
            },
        };
        const filesSchema = {
            type: 'object',
            description: 'Files for the process\'s file variables, keyed by variable name. Up to FILE_INLINE_MAX_BYTES a file is kept in the database, bigger ones in object storage; above FILE_MAX_BYTES the process instance fails unless forceFileSize is set.',
            properties: Object.fromEntries(fileVariables.map((variable) => [variable.name, source])),
            additionalProperties: false,
        };
        const multipartParts = Object.fromEntries(fileVariables.map((variable) => [
            variable.name,
            {type: 'string', format: 'binary', description: `Content of file variable "${variable.name}"`},
        ]));
        const forceSchema = {type: 'boolean', description: 'Accept files above FILE_MAX_BYTES (up to FILE_FORCED_MAX_BYTES), with a warning'};
        return {filesSchema, multipartParts, forceSchema};
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

        const processVariables = this.getProcessVariables(bpmnModel.model);
        const variablesSchema = this.buildVariablesSchema(processVariables);
        const {filesSchema, multipartParts, forceSchema} = this.buildFilesSchema(processVariables);

        const openApiCodegen = workflowCodegenContext.containerCodegenContext.openApiCodegen;
        const startPath = `/${normalizedProcessDef}/start`;
        const signalPath = `/${normalizedProcessDef}/signal`;
        const tasksPath = `/${normalizedProcessDef}/tasks`;
        openApiCodegen.addPath(startPath , "post")
        openApiCodegen.addPathDescription(startPath, "post", "Start a new process instance, optionally with variables")
        openApiCodegen.addPathTags(startPath, "post", ["Process Instance"])
        // status code -> response, not nested under a "responses" key (addResponse merges its
        // argument directly into .responses)
        openApiCodegen.addResponse(startPath , "post" , {
            "200": {
                "description": "Process instance created",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "The created process instance id"}
                            }
                        }
                    }
                }
            }
        })
        // requestBody is a sibling of responses in OpenAPI, not nested inside it ,
        // it needs its own call, not folding into addResponse's argument
        openApiCodegen.setRequestBody(startPath, "post", {
            "required": false,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "variables": {
                                "type": "string",
                                "description": "JSON-encoded process variables object",
                                "example": JSON.stringify(variablesSchema.example)
                            },
                            "files": {
                                "type": "string",
                                "description": "JSON-encoded `files` object (base64/url/path sources), as in the JSON body"
                            },
                            "forceFileSize": {"type": "string", "enum": ["true", "false"], "description": forceSchema.description},
                            ...multipartParts
                        }
                    }
                },
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "variables": variablesSchema,
                            "files": filesSchema,
                            "forceFileSize": forceSchema
                        }
                    }
                }
            }
        })
        openApiCodegen.addResponse(startPath, "post", {
            "400": {"description": "Invalid variables or files (unknown file variable, bad source, path outside FILE_INPUT_DIR, ...)"},
            "413": {"description": "A file exceeds FILE_MAX_BYTES (or FILE_FORCED_MAX_BYTES when forced): the process instance is created and marked as failed; the body carries its id"},
            "422": {"description": "A file could not be read (download failed, missing local file)"}
        })
        workflowCodegenContext.routes.push({verb: "POST", path: startPath , method: "start"})

        openApiCodegen.addPath(signalPath, "post")
        openApiCodegen.addPathDescription(signalPath, "post", "Resume a process instance paused at an intermediate catch event (deliver a signal) or a human task (complete it), optionally with variables")
        openApiCodegen.addPathTags(signalPath, "post", ["Process Instance"])
        openApiCodegen.addResponse(signalPath, "post", {
            "200": {
                "description": "Process instance resumed",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "resumed": {"type": "boolean"},
                                "processInstanceId": {"type": "string"},
                                "nodeId": {"type": "string"}
                            }
                        }
                    }
                }
            },
            "400": {"description": "Missing processInstanceId/nodeId, or invalid variables or files"},
            "404": {"description": "Process instance not found/active, or nodeId is not a known node in this workflow"},
            "409": {"description": "Process instance is not currently waiting at that node"},
            "413": {"description": "A file exceeds FILE_MAX_BYTES (or FILE_FORCED_MAX_BYTES when forced) - nothing is resumed, the instance keeps waiting"},
            "422": {"description": "A file could not be read (download failed, missing local file)"}
        })
        openApiCodegen.setRequestBody(signalPath, "post", {
            "required": true,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["processInstanceId", "nodeId"],
                        "properties": {
                            "processInstanceId": {"type": "string"},
                            "nodeId": {"type": "string"},
                            "variables": {"type": "string", "description": "JSON-encoded process variables object"},
                            "files": {"type": "string", "description": "JSON-encoded `files` object (base64/url/path sources), as in the JSON body"},
                            "forceFileSize": {"type": "string", "enum": ["true", "false"], "description": forceSchema.description},
                            ...multipartParts
                        }
                    }
                },
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["processInstanceId", "nodeId"],
                        "properties": {
                            "processInstanceId": {"type": "string", "description": "The id returned by POST /start"},
                            "nodeId": {"type": "string", "description": "The id of the intermediate catch event or human task node to resume"},
                            "variables": variablesSchema,
                            "files": filesSchema,
                            "forceFileSize": forceSchema
                        }
                    }
                }
            }
        })
        workflowCodegenContext.routes.push({verb: "POST", path: signalPath, method: "signal"})

        openApiCodegen.addPath(tasksPath, "get")
        openApiCodegen.addPathDescription(tasksPath, "get", "List every human task currently waiting to be completed, across every process instance of this workflow in this container")
        openApiCodegen.addPathTags(tasksPath, "get", ["Process Instance"])
        openApiCodegen.addResponse(tasksPath, "get", {
            "200": {
                "description": "Pending human tasks",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "processInstanceId": {"type": "string"},
                                    "nodeId": {"type": "string", "description": "Pass this as nodeId to POST /signal to complete the task"},
                                    "nodeName": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
        })
        workflowCodegenContext.routes.push({verb: "GET", path: tasksPath, method: "tasks"})


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
        let workflowModelPath = `./deployments/${containerParsingContext.deploymentId}/src/modules/container/${normalizedProcessDef.toLowerCase()}.workflow-model.js`
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

    /**
     * Same pattern as generateWorkflowModelClass, but for timer-bearing nodes
     * (Timer Start Event / Timer Intermediate Catch Event): an initially-empty
     * class that start.node.processor.js / catch-event.processor.js populate
     * one static property per timer node while walking the diagram, read at
     * container boot by timer.service.js to know what to schedule.
     * @param {string} normalizedProcessDef
     * @param bpmnModel
     * @param {ContainerParsingContext} containerParsingContext
     * @param {WorkflowCodegenContext} workflowCodegenContext
     */
    async generateTimerModelClass(normalizedProcessDef, bpmnModel, containerParsingContext, workflowCodegenContext) {
        let timerModelPath = `./deployments/${containerParsingContext.deploymentId}/src/modules/timer/${normalizedProcessDef.toLowerCase()}.timer-model.js`
        let template = fs.readFileSync(
            path
                .join(
                    __dirname,
                    './builder/templates/src/modules/timer/timer-model.js',
                )
                .toString(),
        ).toString()

        workflowCodegenContext.timerModelFile = workflowCodegenContext.project.createSourceFile(
            timerModelPath,
            template,
            {overwrite: true},
        );

        workflowCodegenContext.timerModelClass = workflowCodegenContext.timerModelFile.getClassOrThrow("TimerModel");
    }

    /**
     * Renders a single nunjucks template straight to a file under the
     * deployment (as opposed to the ts-morph-backed generators like
     * generateServiceClass/generateWorkflowModelClass, which build up a
     * source file incrementally across multiple codegen steps) - shared by
     * every "read one template, fill in {{ ProcessDef }} and friends, write
     * it out" step, e.g. generateWorkflowContext.
     * @param {string} templateRelativePath - relative to this file's own directory
     * @param {string[]} destPathSegments - path segments under the deployment root
     * @param {object} context - nunjucks render context
     * @param {ContainerParsingContext} containerParsingContext
     */
    renderTemplateToDeployment(templateRelativePath, destPathSegments, context, containerParsingContext) {
        const template = fs.readFileSync(
            path.join(__dirname, templateRelativePath),
        ).toString();

        const renderedTemplate = nunjucks.renderString(template, context);

        const destFile = path.join(Utils.getDeploymentPath(containerParsingContext), ...destPathSegments);
        fs.writeFileSync(destFile, renderedTemplate);
    }

}

export default WorkflowBuilder;
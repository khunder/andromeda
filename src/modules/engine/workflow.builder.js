// const fs = require("fs");
// const shelljs = require("shelljs");
// const nunjucks = require("nunjucks");
// const path = require("path");
// const Config = require("../../config/config");
// const ContainerCodegenContext = require("../../model/codegen/container.codegen.context");
// const WorkflowCodegenContext = require("../../model/codegen/workflow.codegen.context");
// const commonService = require("../../services/common.service");
// const BpmnProcessor = require("./bpmn.processor");
// const ProcessBuildContext = require("../../model/process-build-context");
// const ContainerBuildContext = require("../../model/container-build-context");
import BpmnProcessor from "./builder/bpmn.processor.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import fs from "fs";
import nunjucks from "nunjucks";
import WorkflowCodegenContext from "../../model/codegen/workflow.codegen.context.js";
import path from "path";
import {fileURLToPath} from "url";

const Logger = new AndromedaLogger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowBuilder {
  constructor(  ) {}

   bpmnProcessor =new BpmnProcessor();






  normalizeProcessDefWithoutVersion(processDef) {
    const result = processDef;
    const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
    return result.replace(regex, `$1`);
  }

  upperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  async generateEmbeddedContainer(element, workflowCodegenContext, containerParsingContext){
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
  async generate(element, workflowCodegenContext, containerParsingContext){
      this.bpmnProcessor.process(element,workflowCodegenContext, containerParsingContext);
  }

  /**
   * entry point for code generation
   * @param parsedModel : WorkflowParsingContext
   * @param containerParsingContext : ContainerParsingContext
   * @param containerCodegenContext : ContainerCodegenContext
   * @returns {Promise<void>}
   */
  async generateWorkflow(
      parsedModel,
      containerParsingContext,
      containerCodegenContext
  ) {
    // each bpmn file can contain multiple process node
    const processesInBpmnFile = this.getProcessesModel(parsedModel.model);

    const workflowCodegenContext =  new WorkflowCodegenContext( containerCodegenContext);
    await this.generateServiceClass(parsedModel, containerParsingContext, workflowCodegenContext)

    processesInBpmnFile.forEach(process => {
      this.generateProcess(process, workflowCodegenContext, containerParsingContext);

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


  async generateServiceClass(
      parsedModel,
      workflowParsingContext,
      workflowCodegenContext,
  ) {
    const normalizedProcessDef =
        this.normalizeProcessDefWithoutVersion(parsedModel.processPrefix);
    const serviceFileName = this.getServiceFileName(normalizedProcessDef);
    const serviceClassName = this.getServiceClassName(normalizedProcessDef);
    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    let serviceFilePath = `./deployments/${workflowParsingContext.deploymentId}/services/${serviceFileName}.js`

    let template =  fs.readFileSync(
        path
            .join(
                __dirname,
                './builder/templates/services/service.njk',
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
        { overwrite: true },
    );
    workflowCodegenContext.serviceClass =workflowCodegenContext.serviceClassFile.getClassOrThrow(serviceClassName)
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
      this.generate(startElement, workflowCodegenContext, containerParsingContext).then(r => {});
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
    return(
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
    return(
        bpmnProcess.flowElements.filter(
            (e) =>
                e.$type === 'bpmn:SubProcess' && e.triggeredByEvent === true
        )
    );
  }

   getProcessesModel(model) {
     return model.rootElement.rootElements.filter((e) => e.$type === 'bpmn:Process');
  }


}

export default WorkflowBuilder;
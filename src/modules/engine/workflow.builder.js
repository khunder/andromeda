const fs = require("fs");
const shelljs = require("shelljs");
const nunjucks = require("nunjucks");
let AndromedaLogger = require("../../config/andromeda-logger");
const path = require("path");
const Config = require("../../config/config");
const ContainerCodegenContext = require("../../model/codegen/container.codegen.context");
const WorkflowCodegenContext = require("../../model/codegen/workflow.codegen.context");
// const ProcessBuildContext = require("../../model/process-build-context");
// const ContainerBuildContext = require("../../model/container-build-context");
const Logger = new AndromedaLogger();

class WorkflowBuilder {
  constructor(  ) {}

   treatedNodes= [];


   createPackageJsonFile(containerContext) {
    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const resultText = nunjucks.renderString(
      TemplateProvider.getTemplate('/resources/package.json.njk'),
      { containerContext },
    );
    fs.writeFileSync(
      this.getProjectDeploymentFolder(containerContext) + '/package.json',
      resultText,
    );
  }

  createMain(containerContext) {
    const srcFolder = path.join(
      this.getProjectDeploymentFolder(containerContext),
      'src',
    );
    if (!fs.existsSync(srcFolder)) {
      shelljs.mkdir('-p', srcFolder);
    }

    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const resultText = nunjucks.renderString(
      TemplateProvider.getTemplate('resources/main.ts.njk'),
      {
        containerContext,
      },
    );
    fs.writeFileSync(
      path.join(
        this.getProjectDeploymentFolder(containerContext),
        'src/main.ts',
      ),
      resultText,
    );
  }

  /**
   * method to load template, evaluate it
   * @param sourceTemplate: nunjucks template
   * @param destFile: file to create
   * @param containerContext: variables
   */
  createFile(sourceTemplate, destFile, containerContext) {
    try {
      const destFolder = path.dirname(destFile);
      if (!fs.existsSync(destFolder)) {
        shelljs.mkdir('-p', destFolder);
      }
      //
      nunjucks.configure({
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true,
      });
      const resultText = nunjucks.renderString(
          fs.readFileSync(sourceTemplate, 'utf-8'),
        {
          ...containerContext,
        },
      );
      fs.writeFileSync(
        destFile,
        resultText,
      );
    } catch (e) {
      throw new Error(e);
    }
  }

  generateCommonFiles(dir, sourcePath, containerContext) {
    let files = fs.readdirSync(dir)
    files.forEach(function (entry) {
      let filePath = path.join(dir, entry)
      if (fs.statSync(filePath).isDirectory()) {
        if (!fs.existsSync(path.join(sourcePath, "/", entry))) {
          fs.mkdirSync(path.join(sourcePath, "/", entry));
        }
        this.generateCommonFiles(filePath, path.join(sourcePath, entry))
      } else {
        const extension = entry.split('.').pop()
        if(extension === "snjk"){
          let fileName = entry.split('.').slice(0, -1).join('.');
          fs.writeFileSync(path.join(sourcePath, fileName), fs.readFileSync(filePath, 'utf-8'));
        }
      }
    }.bind(this));
  }


  normalizeProcessDefWithoutVersion(processDef) {
    const result = processDef;
    const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
    return result.replace(regex, `$1`);
  }

  upperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  async generateEmbeddedContainer(element, processBuildContext){
    let self = this;
      // search start
      // generate code
    const startElements = this.getStartElements(element);
    startElements.forEach(startElement => {
      self.generate(startElement, processBuildContext);
    })
    let embeddedEventSubprocesses = this.getEventSubProcess(element);
    embeddedEventSubprocesses.forEach(container => {
      self.generateEmbeddedContainer(container, processBuildContext)
    })
  }

  async generate(element, processBuildContext){
    console.log(`----->${element.id}`)
  }

  async generateWorkflow(
      parsedModel,
      containerParsingContext,
      containerCodegenContext
  ) {

    const bpmnProcess = this.getProcessModel(parsedModel.model);
    let self = this;
    let templatePath = path.join( process.cwd(), "src", "modules", "engine", "templates");
    this.generateCommonFiles(templatePath, path.join(Config.getInstance().deploymentPath, containerParsingContext.deploymentId), containerParsingContext)



    bpmnProcess.forEach(process => {
      const workflowCodegenContext =  new WorkflowCodegenContext(containerCodegenContext);
      self.generateProcess(self, process, workflowCodegenContext);
      workflowCodegenContext.containerCodegenContext.routes.push({verb: "get", path : "wewe"})

    });

    let file = "specification.yaml.njk"
    const filePath = path.join(templatePath, file);
    const extension = file.split('.').pop()
    if(extension === "njk"){
      let fileName = file.split('.').slice(0, -1).join('.');
      this.createFile(filePath, path.join(Config.getInstance().deploymentPath, containerParsingContext.deploymentId, fileName),
          {routes: containerCodegenContext.routes, ...containerParsingContext});
    }





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
    //   bpmnProcess,
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

  generateProcess(self, process, processBuildContext) {
    let startElements = self.getStartElements(process);
    startElements.forEach(startElement => {
      self.generate(startElement);
    })
    let embeddedEventSubprocesses = self.getEventSubProcess(process);
    embeddedEventSubprocesses.forEach(container => {
      self.generateEmbeddedContainer(container, processBuildContext)
    })
  }


   getServiceFileName(normalizedProcessDef) {
    return normalizedProcessDef.toLowerCase() + '-process-instance.service';
  }

   getServiceClassName(normalizedProcessDef) {
    return this.upperFirstChar(normalizedProcessDef) + 'ProcessInstanceService';
  }


  getNextNodes(
    node,
    buildContext,
  ) {
    if (node.outgoing !== undefined) {
      return node.outgoing;
    }
    return [];
  }

  buildMethod(
    buildContext,
    nodeContext,
    element,
  ) {
    const nextNodes = this.getNextNodes(element, buildContext);
    Logger.verbose(`Generate method signature for node  ${element.id}`);
    const outgoingSequenceFlows = nextNodes.map(
      (nextNode) => {
        const flow = {
          ...JSON.parse(JSON.stringify(nextNode)),
          target: JSON.parse(JSON.stringify(nextNode.targetRef)),
          source: JSON.parse(JSON.stringify(nextNode.sourceRef)),
        };
        flow.targetNodeMethodSignature = `this.${EngineConstants.FUNCTION_PREFIX}_${flow.target.id}(nextFlowModel)`;
        flow.source.$type = flow.source.$type.substr(5);
        flow.target.$type = flow.target.$type.substr(5);
        return flow;
      },
      // this.generateOutgoingSequenceFlowContext(currentElement, nextNode),
    );
    const templatesPath = path.join(
      process.cwd(),
      'src/engine/core/resources/services',
    );
    nunjucks.configure(templatesPath, {
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const methodBody = nunjucks.renderString(
      TemplateProvider.getTemplate(
        path.join(
          process.cwd(),
          'src/engine/core/resources/services/build-method.ts.njk',
        ),
      ),
      {
        outgoingSequenceFlows: outgoingSequenceFlows,
        nodeContext: nodeContext,
        methodPrefix: EngineConstants.FUNCTION_PREFIX,
        stringify: JSON.stringify,
      },
    );
    // inject generated method inside service class using ts-morph
    buildContext.serviceClass.addMember(methodBody);
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
              e.$type === 'bpmn:StartEvent' ||
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

   getProcessModel(model) {
    const bpmnProcess = model.rootElement.rootElements.filter((e) => e.$type === 'bpmn:Process');

    return bpmnProcess;
  }


}

module.exports = WorkflowBuilder;
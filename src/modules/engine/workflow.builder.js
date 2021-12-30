const fs = require("fs");
const shelljs = require("shelljs");
const nunjucks = require("nunjucks");
let AndromedaLogger = require("../../config/andromeda-logger");
const path = require("path");
const Logger = new AndromedaLogger();

class WorkflowBuilder {
  constructor(  ) {}

   treatedNodes= [];

  getProjectDeploymentFolder(containerContext) {
    // return `${containerContext.deploymentId}`;
    return path.join(
      this.commonService.getDeploymentPath(),
      containerContext.deploymentId,
    );
  }

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
      const fullDestFilePath = path.join(
        this.getProjectDeploymentFolder(containerContext),
        destFile,
      );
      const destFolder = path.dirname(fullDestFilePath);
      if (!fs.existsSync(destFolder)) {
        shelljs.mkdir('-p', destFolder);
      }

      nunjucks.configure({
        autoescape: false,
        trimBlocks: true,
        lstripBlocks: true,
      });
      const resultText = nunjucks.renderString(
        TemplateProvider.getTemplate(
          path.join(
            process.cwd().toString(),
            'src',
            'engine',
            'core',
            sourceTemplate,
          ),
        ),
        {
          containerContext,
        },
      );
      fs.writeFileSync(
        path.join(this.getProjectDeploymentFolder(containerContext), destFile),
        resultText,
      );
    } catch (e) {
      throw new Error(e);
    }
  }

  async generateCommonFiles(containerContext) {
    try {
      const dir = `${containerContext.deploymentId}`;
      Logger.log(
        `Directory ${this.getProjectDeploymentFolder(containerContext)}`,
      );
      if (!fs.existsSync(dir)) {
        shelljs.mkdir('-p', dir);
      }

      // this.createMain(containerContext);
      // this.createAppModule(containerContext);
      this.createFile(
        '/resources/package.json.njk',
        'package.json',
        containerContext,
      );
      this.createFile(
        '/resources/main.ts.njk',
        'src/main.ts',
        containerContext,
      );
      this.createFile(
        '/resources/app.module.ts.njk',
        'src/app.module.ts',
        containerContext,
      );
      this.createFile(
        '/resources/shutdown.service.ts.njk',
        'src/shutdown.service.ts',
        containerContext,
      );
      this.createFile(
        '/resources/app.service.ts.njk',
        'src/app.service.ts',
        containerContext,
      );
      this.createFile(
        '/resources/app.controller.ts.njk',
        'src/app.controller.ts',
        containerContext,
      );

      this.createFile(
        '/resources/rate-limiter.middleware.ts.njk',
        'src/rate-limiter.middleware.ts',
        containerContext,
      );

      this.createFile(
        '/resources/container/task/task.controller.ts.njk',
        'src/container/task/task.controller.ts',
        containerContext,
      );
      this.createFile(
        '/resources/container/task/task.module.ts.njk',
        'src/container/task/task.module.ts',
        containerContext,
      );

      this.createFile(
        '/resources/container/task/task.service.ts.njk',
        'src/container/task/task.service.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/event.interface.ts',
        'src/persistence/interfaces/event.interface.ts',
        containerContext,
      );
      this.createFile(
        '../../persistence/repository/repository-base.ts',
        'src/persistence/repository/repository-base.ts',
        containerContext,
      );
      this.createFile(
        '../../persistence/repository/process-instance-repository.ts',
        'src/persistence/repository/process-instance-repository.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/repository/sequence-flow-repository.ts',
        'src/persistence/repository/sequence-flow-repository.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/repository/event-log-repository.ts',
        'src/persistence/repository/event-log-repository.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/repository/task-event-repository.ts',
        'src/persistence/repository/task-event-repository.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/repository/variable-repository.ts',
        'src/persistence/repository/variable-repository.ts',
        containerContext,
      );

      // this.createFile(
      //   '../../persistence/schemas/process-instance.ts',
      //   'src/persistence/schemas/process-instance.ts',
      //   containerContext,
      // );

      this.createFile(
        '../../persistence/interfaces/process-instance.interface.ts',
        'src/persistence/interfaces/process-instance.interface.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/sequence-flow.interface.ts',
        'src/persistence/interfaces/sequence-flow.interface.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/task-event.interface.ts',
        'src/persistence/interfaces/task-event.interface.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/variable.interface.ts',
        'src/persistence/interfaces/variable.interface.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/process-instance-status.ts',
        'src/persistence/interfaces/process-instance-status.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/sequence-flow-status.ts',
        'src/persistence/interfaces/sequence-flow-status.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/interfaces/task-event-status.ts',
        'src/persistence/interfaces/task-event-status.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/event.ts',
        'src/persistence/eventstore/event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/event-handler.ts',
        'src/persistence/eventstore/event-handler.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/event-store.service.ts',
        'src/persistence/eventstore/event-store.service.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/event-types.ts',
        'src/persistence/eventstore/event-types.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/create-process-instance-event.ts',
        'src/persistence/eventstore/events/create-process-instance-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/close-process-instance-event.ts',
        'src/persistence/eventstore/events/close-process-instance-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/fail-process-instance-event.ts',
        'src/persistence/eventstore/events/fail-process-instance-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/abort-process-instance-event.ts',
        'src/persistence/eventstore/events/abort-process-instance-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/create-sequence-flow-event.ts',
        'src/persistence/eventstore/events/create-sequence-flow-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/bulk-create-sequence-flow-event.ts',
        'src/persistence/eventstore/events/bulk-create-sequence-flow-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/create-task-event-event.ts',
        'src/persistence/eventstore/events/create-task-event-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/events/bulk-create-variable-event.ts',
        'src/persistence/eventstore/events/bulk-create-variable-event.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/handlers/aggregate.ts',
        'src/persistence/eventstore/handlers/aggregate.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/handlers/process-instance-aggregate.ts',
        'src/persistence/eventstore/handlers/process-instance-aggregate.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/handlers/sequence-flow-aggregate.ts',
        'src/persistence/eventstore/handlers/sequence-flow-aggregate.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/handlers/task-event-aggregate.ts',
        'src/persistence/eventstore/handlers/task-event-aggregate.ts',
        containerContext,
      );

      this.createFile(
        '../../persistence/eventstore/handlers/variable-aggregate.ts',
        'src/persistence/eventstore/handlers/variable-aggregate.ts',
        containerContext,
      );

      this.createFile(
        '/resources/model/local-context.ts.njk',
        'src/model/local-context.ts',
        containerContext,
      );

      this.createFile(
        '/resources/model/flow-model.ts.njk',
        'src/model/flow-model.ts',
        containerContext,
      );

      this.createFile(
        '/resources/model/variable-model.ts.njk',
        'src/model/variable-model.ts',
        containerContext,
      );

      this.createFile(
        '/resources/config/beeflow-logger.ts.njk',
        'src/config/beeflow-logger.ts',
        containerContext,
      );

      this.createFile(
        '/resources/config/log4js.config.ts.njk',
        'src/config/log4js.config.ts',
        containerContext,
      );

      this.createFile(
        '/resources/config/config.ts.njk',
        'src/config/Config.ts',
        containerContext,
      );

      this.createFile(
        '/resources/services/container-service.ts.njk',
        'src/services/container-service.ts',
        containerContext,
      );
    } catch (e) {
      Logger.error(e);
      throw new Error(e);
    }
  }

  normalizeProcessDefWithoutVersion(processDef) {
    const result = processDef;
    const regex = /(\w+)(-[vV][0-9]+\.[0-9]+)/;
    return result.replace(regex, `$1`);
  }

  upperFirstChar(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  async generateWorkflow(
    processDef,
    model,
    containerContext,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) {
    const bpmnProcess = this.getProcessModel(model);
    const startElements = this.getStartElements(bpmnProcess);
    const buildContext = new ProcessInstanceBuildContext();
    this.generateServiceClass(processDef, buildContext, containerContext);
    // this.generateVariableContextHandlerClass(processDef, containerContext);
    this.generateControllerClass(processDef, buildContext, containerContext);
    this.generateVariable(
      bpmnProcess,
      this.normalizeProcessDefWithoutVersion(processDef),
      buildContext,
      containerContext,
    );
    // this.createWorkflowWorker(processDef, containerContext);
    startElements.forEach((startElement) => {
      this.generateContentForElement(startElement, buildContext);
    });
    buildContext.renderImports();
    buildContext.serviceClassFile.formatText({ trimTrailingWhitespace: true });
    buildContext.controllerClass.formatText({ trimTrailingWhitespace: true });
    buildContext.project.saveSync();
  }

   generateServiceClass(
    processDef,
    buildContext,
    containerContext,
  ) {
    const normalizedProcessDef =
      this.normalizeProcessDefWithoutVersion(processDef);
    const serviceFileName = this.getServiceFileName(normalizedProcessDef);
    const serviceClassName = this.getServiceClassName(normalizedProcessDef);
    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const template = nunjucks.renderString(
      TemplateProvider.getTemplate(
        path
          .join(
            process.cwd(),
            'src/engine/core/resources/services/process-instance-service.ts.njk',
          )
          .toString(),
      ),
      {
        serviceFileName: serviceFileName,
        serviceClassName: serviceClassName,
        processDef: normalizedProcessDef,
      },
    );

    buildContext.serviceClassFile = buildContext.project.createSourceFile(
      `deployments/${containerContext.deploymentId}/src/services/${serviceFileName}.ts`,
      template,
      { overwrite: true },
    );
    buildContext.serviceClass =
      buildContext.serviceClassFile.getClassOrThrow(serviceClassName);
  }

   generateControllerClass(
    processDef,
    buildContext,
    containerContext,
  ) {
    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const processInstanceClassName = `${this.upperFirstChar(
      this.normalizeProcessDefWithoutVersion(processDef),
    )}ProcessInstanceService`;
    const processInstanceFileName = `${this.normalizeProcessDefWithoutVersion(
      processDef,
    )}-process-instance.service`;

    const template = nunjucks.renderString(
      TemplateProvider.getTemplate(
        path
          .join(
            process.cwd(),
            'src/engine/core/resources/controller/process-instance-controller.ts.njk',
          )
          .toString(),
      ),
      {
        processDef: processDef,
        processInstanceClassName,
      },
    );

    buildContext.addImportToController(
      `{ ${processInstanceClassName} }`,
      `./services/${processInstanceFileName}`,
    );
    buildContext.controllerClassFile = buildContext.project.addSourceFileAtPath(
      `deployments/${containerContext.deploymentId}/src/app.controller.ts`,
    );
    buildContext.controllerClass =
      buildContext.controllerClassFile.getClassOrThrow('AppController');

    buildContext.controllerClass.addMember(template);
  }

  // public createWorkflowWorker(processDef, containerContext) {
  //   nunjucks.configure({
  //     autoescape: false,
  //     trimBlocks: true,
  //     lstripBlocks: true,
  //   });
  //   const tmp = TemplateProvider.getTemplate(
  //     path.join(
  //       process.cwd(),
  //       'src/engine/core/resources/services/worker_thread_handler.ts.njk',
  //     ),
  //   );
  //   const resultText = nunjucks.renderString(tmp, {
  //     ProcessDef: this.normalizeProcessDefWithoutVersion(processDef),
  //   });
  //   fs.writeFileSync(
  //     path.join(
  //       process.cwd(),
  //       this.getProjectDeploymentFolder(containerContext),
  //       `src/services/${this.normalizeProcessDefWithoutVersion(processDef)}.ts`,
  //     ),
  //     resultText,
  //   );
  // }

   getServiceFileName(normalizedProcessDef) {
    return normalizedProcessDef.toLowerCase() + '-process-instance.service';
  }

   getServiceClassName(normalizedProcessDef) {
    return this.upperFirstChar(normalizedProcessDef) + 'ProcessInstanceService';
  }

  generateContentForElement(
    elemen,
    buildContext,
  ) {
    let nodeContext;
    if (element.$type === 'bpmn:StartEvent') {
      nodeContext = new StartEventProcessor().process(element, buildContext);
    }

    if (element.$type === 'bpmn:EndEvent') {
      nodeContext = new EndEventProcessor().process(element, buildContext);
    }

    if (element.$type === 'bpmn:ScriptTask') {
      nodeContext = new ScriptTaskProcessor().process(
        element,
        buildContext,
      );
    }

    if (element.$type === 'bpmn:IntermediateCatchEvent') {
      nodeContext = new CatchEventProcessor().process(element, buildContext);
    }

    if (nodeContext) {
      this.buildMethod(buildContext, nodeContext, element);
    }
    element.outgoing?.forEach((flow) => {
      if (!this.treatedNodes.includes(flow.targetRef.id)) {
        this.treatedNodes.push(flow.targetRef.id);
        Logger.log(
          `next element id= ${flow.targetRef.id}, type =${flow.targetRef.$type}`,
        );
        this.generateContentForElement(flow.targetRef, buildContext);
      }
    });
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
    return(
      bpmnProcess.flowElements.filter((e) => e.$type === 'bpmn:StartEvent')
    );
  }

   getProcessModel(model) {
    const bpmnProcess = (
      model.rootElement.rootElements.find((e) => e.$type === 'bpmn:Process')
    );
    return bpmnProcess;
  }

   generateVariable(
    bpmnProcess,
    processDef,
    buildContext,
    containerContext,
  ) {
    const processVariables= [];

    if (bpmnProcess.properties) {
      bpmnProcess.properties.forEach((p) => {
        Logger.verbose(`add variable ${p.name}`);
        processVariables.push({
          name: p.name,
          type: p.itemSubjectRef.structureRef,
        });
      });
      // add meta property to use it when we iterate over variables
    }

    const normalizedProcessDef =
      this.normalizeProcessDefWithoutVersion(processDef);
    nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true,
    });
    const resultText = nunjucks.renderString(
      TemplateProvider.getTemplate(
        path
          .join(
            process.cwd(),
            'src/engine/core/resources/services/variable-context-handler.ts.njk',
          )
          .toString(),
      ),
      {
        processDef: this.normalizeProcessDefWithoutVersion(processDef),
        processVariables: processVariables,
      },
    );

    fs.writeFileSync(
      path.join(
        process.cwd(),
        this.getProjectDeploymentFolder(containerContext),
        `src/services/${normalizedProcessDef}-variable-context-handler.ts`,
      ),
      resultText,
    );

    return buildContext;
  }
}

// const http = require( "http");
// const fs = require('fs');
// const shell = require("shelljs");
// const CommonService = require("../../services/common.service");
//
// const  AndromedaLogger = require("../../config/andromeda-logger");
// const path = require("path");
// const WorkflowBuilder = require("./workflow.builder");
// const ContainerCodegenContext = require("../../model/codegen/container.codegen.context");

import {AndromedaLogger} from "../../config/andromeda-logger.js";
import http from "http";
import path from "path";
import CommonService from "../../services/common.service.js";

const Logger = new AndromedaLogger();

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

    async generateContainer(containerParsingContext) {
        const deploymentPath = this.getDeploymentPath(containerParsingContext);
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            shell.mkdir('-p', deploymentPath);
        }

        // if (!containerParsingContext.workflowParsingContext.model || containerParsingContext.model.size === 0) {
        //     Logger.error(`no bpmn model found to generate`);
        //     throw new Error('Cannot generate container, no model found');
        // }
        const containerCodegenContext = new ContainerCodegenContext();
        containerParsingContext.workflowParsingContext.forEach(parsedModel => {
            new WorkflowBuilder().generateWorkflow(parsedModel, containerParsingContext, containerCodegenContext);
        })

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

    extractWorkflowPrefix(containerContext) {
        if(!containerContext.model )
        return undefined;
    }
}

export default EngineService
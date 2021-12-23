import http from "http";
import * as fs from 'fs';
import  {} from 'shelljs';
import * as path from 'path';
import {AndromedaLogger} from "../config/andromeda-logger.js";
import {ContainerContext} from "../model/container.context.js";
import {CommonService} from "./common.service.js";
const Logger = new AndromedaLogger();

export class EngineService {
    commonService = new CommonService()
    isPortFree = (port) =>
        new Promise((resolve) => {
            const server = http
                .createServer()
                .listen(port, () => {
                    server.close();
                    Logger.verbose(`port ${port} is free`);
                    resolve(true);
                })
                .on('error', () => {
                    Logger.verbose(`port ${port} is not free`);
                    resolve(false);
                });
        });

    getDeploymentPath(ctx) {
        return path.join(this.commonService.getDeploymentPath(), ctx.deploymentId);
    }

    async generateContainer(
        deploymentId,
        containerContext,
    ) {
        const deploymentPath = this.getDeploymentPath(containerContext);
        if (!fs.existsSync(deploymentPath)) {
            Logger.debug(
                `Trying to create deployment folder in path: ${deploymentPath}`,
            );
            shell.mkdir('-p', deploymentPath);
        }

        if (!containerContext.model || containerContext.model.size === 0) {
            Logger.error(`no bpmn model found to generate`);
            throw new Error('Cannot generate container, no model found');
        }

        // await this.workflowBuilder.generateCommonFiles(containerContext);
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

}
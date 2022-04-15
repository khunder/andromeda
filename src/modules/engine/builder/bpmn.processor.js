
import {AndromedaLogger} from "../../../config/andromeda-logger.js";
import StartNodeProcessor from "./processors/start.node.processor.js";
import EndNodeProcessor from "./processors/end.node.processor.js";
import ScriptTaskNodeProcessor from "./processors/script.node.processor.js";
import path from "path";
import nunjucks from "nunjucks";
import fs from "fs";
import {fileURLToPath} from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const Logger = new AndromedaLogger();

class BpmnProcessor {

    processors = {}
    treatedNodes=[]

    constructor() {
        this.processors[StartNodeProcessor.type] = new StartNodeProcessor();
        this.processors[EndNodeProcessor.type] = new EndNodeProcessor();
        this.processors[ScriptTaskNodeProcessor.type] = new ScriptTaskNodeProcessor();
    }

    /**
     *
     * @param element : FlowNode
     * @param workflowCodegenContext
     * @param containerParsingContext
     */
    process(element, workflowCodegenContext, containerParsingContext){
        let type = element.$type;
        let processor = this.processors[type];
        if(!processor){
            throw new Error(`cannot find suitable processor for Element of type ${type}`);
        }
        let nodeContext = this.processors[type].process(element, workflowCodegenContext, containerParsingContext)
        if(!nodeContext){
            throw new Error(`cannot find a suitable node context for Element of type ${type}`);
        }
        this.buildMethod(element, nodeContext, workflowCodegenContext);
        element.outgoing?.forEach((flow) => {
            if (!this.treatedNodes.includes(flow.targetRef.id)) {
                this.treatedNodes.push(flow.targetRef.id);
                Logger.info(
                    `next element id= ${flow.targetRef.id}, type =${flow.targetRef.$type}`,
                );
                 this.process(flow.targetRef, workflowCodegenContext, containerParsingContext);
            }
        });
    }


    getNextNodes(
        node
    ) {
        if (node.outgoing !== undefined) {
            return node.outgoing;
        }
        return [];
    }

    buildMethod(
        currentElement,
        nodeContext,
        workflowCodegenContext,
    ) {
        const nextNodes = this.getNextNodes(currentElement);
        Logger.trace(`Generate method signature for node  ${currentElement.id}`);
        const outgoingSequenceFlows = nextNodes.map(
            (nextNode) => {
                const flow = {
                    ...JSON.parse(JSON.stringify(nextNode)),
                    target: JSON.parse(JSON.stringify(nextNode.targetRef)),
                    source: JSON.parse(JSON.stringify(nextNode.sourceRef)),
                };
                flow.targetNodeMethodSignature = `this.fn_${flow.target.id}(nextFlowModel)`;
                flow.source.$type = flow.source.$type.substr(5);
                flow.target.$type = flow.target.$type.substr(5);
                return flow;
            },
            // this.generateOutgoingSequenceFlowContext(currentElement, nextNode),
        );

        nunjucks.configure( path.join(  __dirname,'./templates'), {
            autoescape: false,
            trimBlocks: true,
            lstripBlocks: true,
        });
        const methodBody = nunjucks.renderString(
            fs.readFileSync(
                path
                    .join(
                        __dirname,
                        './templates/build.method.njk',
                    )
                    .toString(),
            ).toString(),
            {
                outgoingSequenceFlows: outgoingSequenceFlows,
                nodeContext: nodeContext,
                stringify: JSON.stringify,
            },
        );
        // inject generated method inside service class using ts-morph
        workflowCodegenContext.serviceClass.addMember(methodBody);
    }


}

export default BpmnProcessor;
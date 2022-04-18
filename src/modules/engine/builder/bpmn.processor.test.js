

import * as net from "net";
import BpmnProcessor from "./bpmn.processor.js";
import StartNodeProcessor from "./processors/start.node.processor.js";
import FakeNodeProcessor, {FakeNodeProcessorWithoutNodeContext} from "./fake.node.processor.js";

const getError = async (call) => {
    try {
        await call();
    } catch (error) {
        return error;
    }
};


describe("Bpmn Processor", () => {
    const getError = async (call) => {
        try {
            await call();
        } catch (error) {
            return error;
        }
    };

    it('bpmnProcessor', async () => {

        const bpmnProcessor = new BpmnProcessor()
        bpmnProcessor.processors[FakeNodeProcessor.type] = new FakeNodeProcessor();
        bpmnProcessor.processors[FakeNodeProcessorWithoutNodeContext.type] = new FakeNodeProcessorWithoutNodeContext();
        // bpmnProcessor.process({$type:"notFound"},null,null);
        const error = await getError(() => bpmnProcessor.process({$type: "notfound"}, null, null));
        expect(error).toEqual(new Error("cannot find suitable processor for Element of type notfound"));

        const error2 = await getError(() => bpmnProcessor.process({$type: "bpmn:FakeActivityWithoutNodeContext"}, null, null));
        expect(error2).toEqual(new Error("cannot find a suitable node context for Element of type bpmn:FakeActivityWithoutNodeContext"));

    })


})
import * as net from "net";
import BpmnProcessor from "./bpmn.processor.js";
import StartNodeProcessor from "./processors/start.node.processor.js";
import FakeNodeProcessor, {FakeNodeProcessorWithoutNodeContext} from "./fake.node.processor.js";
import test from "ava";


const getError = async (call) => {
    try {
        await call();
    } catch (error) {
        return error;
    }
};

test('bpmnProcessor', async (t) => {

    const bpmnProcessor = new BpmnProcessor()
    bpmnProcessor.processors[FakeNodeProcessor.type] = new FakeNodeProcessor();
    bpmnProcessor.processors[FakeNodeProcessorWithoutNodeContext.type] = new FakeNodeProcessorWithoutNodeContext();
    // bpmnProcessor.process({$type:"notFound"},null,null);
    const error = await getError(() => bpmnProcessor.process({$type: "notfound"}, null, null));
    t.deepEqual(error, new Error("cannot find suitable processor for Element of type notfound"));

    const error2 = await getError(() => bpmnProcessor.process({$type: "bpmn:FakeActivityWithoutNodeContext"}, null, null));
    t.deepEqual(error2, new Error("cannot find a suitable node context for Element of type bpmn:FakeActivityWithoutNodeContext"));

})


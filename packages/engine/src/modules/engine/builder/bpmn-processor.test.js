import assert from 'assert';
import BpmnProcessor from "./bpmn.processor.js";
import FakeNodeProcessor, {FakeNodeProcessorWithoutNodeContext} from "./fake.node.processor.js";
import Utils from "../../../utils/utils.js";
import asset from "assert";

it('should add to numbers from an es module', async () => {
    const bpmnProcessor = new BpmnProcessor()
    bpmnProcessor.processors[FakeNodeProcessor.type] = new FakeNodeProcessor();
    bpmnProcessor.processors[FakeNodeProcessorWithoutNodeContext.type] = new FakeNodeProcessorWithoutNodeContext();
    // bpmnProcessor.process({$type:"notFound"},null,null);
    const error = await Utils.getError(() => bpmnProcessor.process({$type: "notfound"}, null, null));
    asset.deepEqual(error, new Error("cannot find suitable processor for Element of type notfound"));

    const error2 = await Utils.getError(() => bpmnProcessor.process({$type: "bpmn:FakeActivityWithoutNodeContext"}, null, null));
    asset.deepEqual(error2, new Error("cannot find a suitable node context for Element of type bpmn:FakeActivityWithoutNodeContext"));

});
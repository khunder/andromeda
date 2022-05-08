import WorkflowBuilder from "./workflow.builder.js";
import test from "ava";
import Utils from "../../utils/utils.js";


test('getStartElements', async (t) => {
    const wb = new WorkflowBuilder();
    const error = await Utils.getError(() => wb.getStartElements());
    t.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
})
test('getEventSubProcess', async (t) => {
    const wb = new WorkflowBuilder();
    const error = await Utils.getError(() => wb.getEventSubProcess());
    t.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
})



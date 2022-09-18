import assert from "assert";
import WorkflowBuilder from "./workflow.builder.js";
import Utils from "../../utils/utils.js";

it('should getStartElements throw because of missing root elements', async () => {
    const wb = new WorkflowBuilder();
    const error = await Utils.getError(() => wb.getStartElements());
    assert.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
});

it('should getEventSubProcess throw missing root element', async () => {
    const wb = new WorkflowBuilder();
    const error = await Utils.getError(() => wb.getEventSubProcess());
    assert.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
})

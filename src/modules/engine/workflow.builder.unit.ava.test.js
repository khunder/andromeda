import WorkflowBuilder from "./workflow.builder.js";
import test from "ava";


const getError = async (call) => {
    try {
        await call();
    } catch (error) {
        return error;
    }
};

test('getStartElements', async (t) => {
    const wb = new WorkflowBuilder();
    const error = await getError(() => wb.getStartElements());
    t.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
})
test('getEventSubProcess', async (t) => {
    const wb = new WorkflowBuilder();
    const error = await getError(() => wb.getEventSubProcess());
    t.deepEqual(error, new Error("cannot compile file missing a process in the root elements"))
})



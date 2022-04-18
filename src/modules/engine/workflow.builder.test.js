

import WorkflowBuilder from "./workflow.builder.js";



describe("Workflow Builder", () => {
    const getError = async (call) => {
        try {
            await call();
        } catch (error) {
            return error;
        }
    };

    it('getStartElements', async () => {
            const wb = new WorkflowBuilder();
            const error = await getError( ()=> wb.getStartElements());
            expect(error).toEqual(new Error("cannot compile file missing a process in the root elements"))
    })
    it('getEventSubProcess', async () => {
            const wb = new WorkflowBuilder();
            const error = await getError( ()=> wb.getEventSubProcess());
            expect(error).toEqual(new Error("cannot compile file missing a process in the root elements"))
    })


})
import Utils from "./utils.js";
import constants from "../config/constants.js";
import assert from "assert";


describe('getStartElements', function () {


    it('getStartElements', async () => {
        const serverIsAvailable = Utils.moduleIsActive(constants.SERVER)
        assert.equal(serverIsAvailable, true);
        const unknownModuleIsAvailable = Utils.moduleIsActive("unknownModule")
        assert.equal(unknownModuleIsAvailable, false)
    })
})

// each BPMN file compiled into a container gets its own namespaced
// files/routes/registry entry keyed by processDef (see WorkflowBuilder) -
// two files resolving to the same one would silently collide, so
// prepareContainerContext must reject that combination up front.
describe('prepareContainerContext', function () {

    function bpmnWithId(id) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="${id}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_${id}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
</bpmn:definitions>`;
    }

    it('accepts multiple BPMN files with distinct process definitions', async () => {
        const ctx = await Utils.prepareContainerContext(
            [bpmnWithId("Foo"), bpmnWithId("Bar")],
            "cov/unit_test_distinct",
        );
        assert.equal(ctx.workflowParsingContext.length, 2);
    });

    it('rejects multiple BPMN files that resolve to the same process definition', async () => {
        await assert.rejects(
            () => Utils.prepareContainerContext(
                [bpmnWithId("Foo"), bpmnWithId("Foo")],
                "cov/unit_test_duplicate",
            ),
            /multiple BPMN files resolve to the same process definition/,
        );
    });
})




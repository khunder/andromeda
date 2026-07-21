import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {EmbeddedContainerService} from "../../src/modules/engine/embedded/embedded.containers.service.js";
import FormData from "form-data";
import PersistenceModule from "../../src/modules/persistence/persistence.module.js";

import {it, expect, describe, beforeAll, afterAll} from 'vitest';

describe('TimerIntermediateCatchEvent::Integration', () => {
    const TEST_TIMEOUT = 30000;

    beforeAll(async () => {
        try {
            await PersistenceModule.init();
        } catch (e) {
            console.log('PersistenceModule init error (may already be initialized):', e.message);
        }
    }, TEST_TIMEOUT);

    // A Timer Intermediate Catch Event with a <bpmn:timeDuration> pauses the
    // same way a signal catch event does (Active FlowEvent on its incoming
    // flow), but resumes itself automatically once due - a TimerCatchResumeJob
    // (enqueued via TimerService.enqueueCatchResume(), see catch-event.
    // processor.js / timer.service.js.njk) runs and resumes it, with no POST
    // /signal call at all. Runs against this suite's default PERSISTENCE_DRIVER
    // (sqlite, via @sidequest/sqlite-backend) - see
    // timer-intermediate-catch-event-jobqueue.int.test.js for the same
    // behavior against the MongoDB backend specifically.
    describe('timeDuration', () => {
        let deploymentId = "cov/timer_catch_duration";
        let testPort;

        beforeAll(async () => {
            testPort = await findAvailablePort();
        }, TEST_TIMEOUT);

        afterAll(async () => {
            await cleanup(deploymentId, testPort);
        });

        it('pauses at the timer catch event, then auto-resumes and completes once the duration elapses', async () => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const bpmnPath = path.join(__dirname, "../resources", "timer-intermediate-catch-event.bpmn");
            expect(fs.existsSync(bpmnPath), `BPMN file not found at ${bpmnPath}`).toBe(true);
            const bpmnContent = fs.readFileSync(bpmnPath, {encoding: 'utf8'});

            let ctx = await Utils.prepareContainerContext([bpmnContent], deploymentId);
            const engineService = new EngineService();
            await engineService.generateContainer(ctx);

            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

            const form = new FormData();
            form.append('bpmnFile', Buffer.from(bpmnContent), {
                filename: 'timer-intermediate-catch-event.bpmn',
                contentType: 'application/xml'
            });
            form.append('deploymentId', 'compileBpmn');

            const response = await fetch(`http://127.0.0.1:${testPort}/TimerIntermediateCatchEvent/start`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });
            expect(response.ok).toBe(true);
            const procData = await response.json();
            expect(procData.id).toBeDefined();

            // paused at WaitDuration, and genuinely so (not just slow): the
            // outgoing flow (Flow_3) must never have fired before this
            const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 5000);
            expect(pendingFlowEvent).toBe(1);
            const flow3CountBeforeElapsed = await PersistenceModule.countDocuments("FlowEvent", {
                processInstance: procData.id,
                flowId: 'Flow_3'
            });
            expect(flow3CountBeforeElapsed).toBe(0);

            // no /signal call anywhere - the resume job must fire on its own
            const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 5000);
            expect(processInstance).toBeDefined();
            expect(processInstance.status).toBe(1); // Completed

            const stageAfter = await PersistenceModule.findOne("Variable", {
                processInstance: procData.id,
                name: 'stage'
            });
            expect(stageAfter.value).toBe('elapsed');
        }, TEST_TIMEOUT);
    });

    // Same mechanism, but with an absolute <bpmn:timeDate> instead of a
    // relative <bpmn:timeDuration> - built inline (rather than a static
    // fixture file) since it needs to be a few seconds in the future at the
    // moment this test actually runs.
    describe('timeDate', () => {
        let deploymentId = "cov/timer_catch_date";
        let testPort;

        beforeAll(async () => {
            testPort = await findAvailablePort();
        }, TEST_TIMEOUT);

        afterAll(async () => {
            await cleanup(deploymentId, testPort);
        });

        it('pauses at the timer catch event, then auto-resumes and completes once the date passes', async () => {
            const dueDate = new Date(Date.now() + 2000).toISOString();
            const bpmnContent = buildTimeDateBpmn(dueDate);

            let ctx = await Utils.prepareContainerContext([bpmnContent], deploymentId);
            const engineService = new EngineService();
            await engineService.generateContainer(ctx);

            await EmbeddedContainerService.startEmbeddedContainer(deploymentId, {port: testPort});

            const form = new FormData();
            form.append('bpmnFile', Buffer.from(bpmnContent), {
                filename: 'timer-intermediate-catch-event-date.bpmn',
                contentType: 'application/xml'
            });
            form.append('deploymentId', 'compileBpmn');

            const response = await fetch(`http://127.0.0.1:${testPort}/TimerIntermediateCatchEventDate/start`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });
            expect(response.ok).toBe(true);
            const procData = await response.json();
            expect(procData.id).toBeDefined();

            const pendingFlowEvent = await waitForFlowEventCount(procData.id, 'Flow_2', TEST_TIMEOUT - 5000);
            expect(pendingFlowEvent).toBe(1);

            const processInstance = await waitForProcessInstanceCompletion(procData.id, TEST_TIMEOUT - 5000);
            expect(processInstance).toBeDefined();
            expect(processInstance.status).toBe(1); // Completed

            const stageAfter = await PersistenceModule.findOne("Variable", {
                processInstance: procData.id,
                name: 'stage'
            });
            expect(stageAfter.value).toBe('elapsed');
        }, TEST_TIMEOUT);
    });

    function buildTimeDateBpmn(dueDate) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  id="TimerIntermediateCatchEventDate" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:itemDefinition id="ItemDefinition_stage" structureRef="string" />
  <bpmn:process id="Process_TimerIntermediateCatchEventDate" isExecutable="true">
    <bpmn:property id="Property_stage" itemSubjectRef="ItemDefinition_stage" name="stage" />
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:scriptTask id="SetInitial" name="SetInitial">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:script>this.variables.stage = "start";</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:intermediateCatchEvent id="WaitDate" name="WaitDate">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeDate xsi:type="bpmn:tFormalExpression">${dueDate}</bpmn:timeDate>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>
    <bpmn:scriptTask id="SetElapsed" name="SetElapsed">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
      <bpmn:script>this.variables.stage = "elapsed";</bpmn:script>
    </bpmn:scriptTask>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="SetInitial" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="SetInitial" targetRef="WaitDate" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="WaitDate" targetRef="SetElapsed" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="SetElapsed" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>
`;
    }

    async function cleanup(deploymentId, testPort) {
        try {
            await EmbeddedContainerService.stopEmbeddedContainer(deploymentId, testPort);
        } catch (e) {
            // Container might already be stopped
        }
        try {
            const deploymentPath = path.join(process.cwd(), 'deployments', deploymentId);
            if (fs.existsSync(deploymentPath)) {
                fs.rmSync(deploymentPath, {recursive: true, force: true});
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }

    async function findAvailablePort() {
        const net = await import('net');
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.on('error', reject);
        });
    }

    async function waitForFlowEventCount(processInstanceId, flowId, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let count = 0;
        while (Date.now() < deadline) {
            count = await PersistenceModule.countDocuments("FlowEvent", {
                processInstance: processInstanceId,
                flowId: flowId
            });
            if (count >= 1) {
                return count;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return count;
    }

    async function waitForProcessInstanceCompletion(processInstanceId, timeoutMs) {
        const pollIntervalMs = 250;
        const deadline = Date.now() + timeoutMs;
        let processInstance = null;
        while (Date.now() < deadline) {
            processInstance = await PersistenceModule.findOne("ProcessInstance", {_id: processInstanceId});
            if (processInstance && processInstance.status === 1) {
                return processInstance;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        return processInstance;
    }
});

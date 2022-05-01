import mongoose from "mongoose";
import Utils from "../../src/utils/utils.js";
import EngineService from "../../src/modules/engine/engine.service.js";
import fs from "fs";
import path from "path";
import test from 'ava';
import App from "../../app.js";
import axios from "axios";
import FormData from "form-data";


test('Start e2e Engine', async (t) => {
    let port = 5001;

    await new App("127.0.0.1" , port).init();
    const form = new FormData();
    form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
    form.append('deploymentId', "compileBpmn");

    const config = { headers: form.getHeaders()};
    // when
    let proc = await axios.post(`http://127.0.0.1:${port}/api/compile`, form, config);
    t.is(proc.status, 200)
    t.pass();
});


test('Start two Engines', async (t) => {

    await new App("127.0.0.1" , "5002").init();
    let form = new FormData();
    form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
    form.append('deploymentId', "compileBpmn1");

    let config = { headers: form.getHeaders()};
    let port = 5002;
    // when
    let proc = await axios.post(`http://127.0.0.1:${port}/api/compile`, form, config);
    t.is(proc.status, 200)
    t.pass();


    await new App("127.0.0.1" , "5003").init();
    form = new FormData();
    form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
    form.append('deploymentId', "compileBpmn1");

    config = { headers: form.getHeaders()};
    let port2 = 5003;
    // when
    proc = await axios.post(`http://127.0.0.1:${port2}/api/compile`, form, config);
    t.is(proc.status, 200)
    t.pass();
});


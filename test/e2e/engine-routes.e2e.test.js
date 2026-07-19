import fs from "fs";
import path from "path";
import App from "../../app.js";
import axios from "axios";
import FormData from "form-data";
import assert from "assert";
import Utils from "../../src/utils/utils.js";



describe('2Engines::Basic', function () {


    it('Start e2e Engine', async () => {
        let port = 5001;

        await new App("127.0.0.1", port).init();
        await Utils.sleep(2000)
        const form = new FormData();
        form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
        form.append('deploymentId', "compileBpmn");

        const config = {headers: form.getHeaders()};
        // when
        let proc = await axios.post(`http://127.0.0.1:${port}/api/compile`, form, config);
        assert.equal(proc.status, 200)
        ;
    });


    it('Start two Engines', async () => {

        await new App("127.0.0.1", "5002").init();
        let form = new FormData();
        form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
        form.append('deploymentId', "compileBpmn1");

        let config = {headers: form.getHeaders()};
        let port = 5002;
        // when
        let proc = await axios.post(`http://127.0.0.1:${port}/api/compile`, form, config);
        assert.equal(proc.status, 200)
        ;


        await new App("127.0.0.1", "5003").init();
        form = new FormData();
        form.append('bpmnFile', fs.readFileSync(path.join(process.cwd(), "./test/resources/scenario_script.bpmn")), "bpmnFile");
        form.append('deploymentId', "compileBpmn1");

        config = {headers: form.getHeaders()};
        let port2 = 5003;
        // when
        proc = await axios.post(`http://127.0.0.1:${port2}/api/compile`, form, config);
        assert.equal(proc.status, 200)
        ;
    });

});
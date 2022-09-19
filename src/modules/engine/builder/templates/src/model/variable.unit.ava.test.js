import {Variable} from "./variable.js";
import {VariableEncoder} from "../utils/variable-encoder.js";
import {v4} from "uuid";
import assert from "assert";



it('get variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async () => {
        let strVal = `{"id": "idLorem" , "value": "valueIpsum"}`;
        const variable = new Variable("variable", "string");
        variable.value = strVal
        assert.equal(variable.needToSave(), true)
        assert.equal(variable.value, strVal)
        variable.resetStatus()
        assert.equal(variable.needToSave(), false)
    })

it('set uuid variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async () => {
        let strVal = v4();
        const variable = new Variable("variable", "string");
        variable.value = strVal
        assert.equal(variable.needToSave(), true)
        assert.equal(variable.value, strVal)
        variable.resetStatus()
        assert.equal(variable.needToSave(), false)
    })

it('reset variable status object',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async () => {
        let strVal = `{"id": "idLorem" , "value": "valueIpsum", nested: { nestedId: 0 }}`;
        const variable = new Variable("variable", "object");
        variable.value = VariableEncoder.transcodeVariable(strVal,variable.type,variable.name)
        assert.equal(variable.needToSave(), true)
        variable.resetStatus()
        assert.equal(variable.needToSave(), false)
        assert.equal(variable.value.id , "idLorem")
        assert.equal(variable.value.nested.nestedId , 0)
        assert.equal(variable.needToSave() , false)
        variable.value.nested.nestedId = 1
        assert.equal(variable.needToSave() , true)
    })

it('reset boolean variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async () => {
        const variable = new Variable("variable", "boolean");
        variable.value = false
        assert.equal(variable.needToSave(), true)
    })


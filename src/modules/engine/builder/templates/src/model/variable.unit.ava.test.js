import test from "ava"
import {Variable} from "./variable.js";
import {VariableEncoder} from "../helpers/variable-encoder.js";
import {v4} from "uuid";



test('get variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal = `{"id": "idLorem" , "value": "valueIpsum"}`;
        const variable = new Variable("variable", "string");
        variable.value = strVal
        t.is(variable.needToSave(), true)
        t.is(variable.value, strVal)
        variable.resetStatus()
        t.is(variable.needToSave(), false)
    })

test('set uuid variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal = v4();
        const variable = new Variable("variable", "string");
        variable.value = strVal
        t.is(variable.needToSave(), true)
        t.is(variable.value, strVal)
        variable.resetStatus()
        t.is(variable.needToSave(), false)
    })

test('reset variable status object',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal = `{"id": "idLorem" , "value": "valueIpsum", nested: { nestedId: 0 }}`;
        const variable = new Variable("variable", "object");
        variable.value = VariableEncoder.transcodeVariable(strVal,variable.type,variable.name)
        t.is(variable.needToSave(), true)
        variable.resetStatus()
        t.is(variable.needToSave(), false)
        t.is(variable.value.id , "idLorem")
        t.is(variable.value.nested.nestedId , 0)
        t.is(variable.needToSave() , false)
        variable.value.nested.nestedId = 1
        t.is(variable.needToSave() , true)
    })

test('reset boolean variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        const variable = new Variable("variable", "boolean");
        variable.value = false
        t.is(variable.needToSave(), true)
    })


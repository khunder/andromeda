
import {v4} from "uuid"
import test from "ava"
import {VariableEncoder} from "./variable-encoder.js";
import BpmnProcessor from "../../../bpmn.processor.js";
import FakeNodeProcessor, {FakeNodeProcessorWithoutNodeContext} from "../../../fake.node.processor.js";
import {EventStore} from "../../../../../persistence/event-store/event-store.js";
import Utils from "../../../../../../utils/utils.js";



function evaluate(expression) {
    let code = ` ${expression}; `;

    try {
        return eval(code);
    } catch (e) {
        log.error(e);
        throw e;
    }
}
let val;

class LoremClass {
    id
    value
}


async function transcodeVariables () {
    val = VariableEncoder.transcodeVariable(`{"id": "asdsd" , "value": "assdsd"}` , "LoremClass")
    console.log(`type of true cast to <LoremClass> ${val}=${typeof val}`);

    val = VariableEncoder.transcodeVariable(`[{"id": "asdsd" , "value": "assdsd"}]` , "Array<LoremClass>")
    console.log(`type of true cast to Array<LoremClass> ${val}=${typeof val}`);

    val = VariableEncoder.transcodeVariable(`{"x": "asdsd"}` , "object")
    console.log(`type of {"x": "asdsd"} cast to <object> ${val}=${typeof val}`);

    val = VariableEncoder.transcodeVariable(`str` , "string")
    console.log(`type of str cast to <string> ${val}=${typeof val}`);

    // console.log(transcodeVariable(`eee` , "any"));
    val  = VariableEncoder.transcodeVariable(55 , "number")
    console.log(`type of 55 cast to <number> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable(55 , "any")
    console.log(`type of 55 cast to <any> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable(55 , "object")
    console.log(`type of 55 cast to <object> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable(true , "any")
    console.log(`type of true cast to <any> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable(true , "boolean")
    console.log(`type of true cast to <boolean> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable('a0221430-a7ff-ac48-1ec6-8d21674e8464' , "string")
    console.log(`type of 'a0221430-a7ff-ac48-1ec6-8d21674e8464' cast to <string> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable('non-renseigné' , "string")
    console.log(`type of 'non-renseigné' cast to <string> ${val}=${typeof val}`);

    val  = VariableEncoder.transcodeVariable('2021-11-02T12:00:00+01:00' , "Date")
    console.log(`type of '2021-11-02T12:00:00+01:00' cast to <Date> ${val}=${typeof val}`);
}

async function validateVariable () {

    //
    // val = VariableEncoder.validateVariable(`{"x": "asdsd"}` , "object")
    // console.log(`type of {"x": "asdsd"} cast to <object> ${val}=${typeof val}`);
    //
    // val = VariableEncoder.validateVariable(`str` , "string")
    // console.log(`type of str cast to <string> ${val}=${typeof val}`);
    //
    // // console.log(validateVariable(`eee` , "any"));
    // val  = VariableEncoder.validateVariable(55 , "number")
    // console.log(`type of 55 cast to <number> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable(55 , "any")
    // console.log(`type of 55 cast to <any> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable(55 , "object")
    // console.log(`type of 55 cast to <object> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable(true , "any")
    // console.log(`type of true cast to <any> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable(true , "boolean")
    // console.log(`type of true cast to <boolean> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable('a0221430-a7ff-ac48-1ec6-8d21674e8464' , "string")
    // console.log(`type of 'a0221430-a7ff-ac48-1ec6-8d21674e8464' cast to <string> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable('non-renseigné' , "string")
    // console.log(`type of 'non-renseigné' cast to <string> ${val}=${typeof val}`);
    //
    // val  = VariableEncoder.validateVariable('2021-11-02T12:00:00+01:00' , "Date")
    // console.log(`type of '2021-11-02T12:00:00+01:00' cast to <Date> ${val}=${typeof val}`);
}

function isObject(val) {
    return (typeof val === 'object');
}

test('Validate object',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {

    let strVal = `{"id": "idLorem" , "value": "valueIpsum"}`;
    val = VariableEncoder.validateVariable(strVal , "LoremClass", "objVar")
    t.is(isObject(val), true)
    t.is(val.id, "idLorem")
    t.is(val.value, "valueIpsum")

})


test('Validate Array of objects',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `[{"id": "idLorem" , "value": "valueIpsum"}]`;
        val = VariableEncoder.validateVariable(strVal , "Array<LoremClass>", "arrayVar")
        t.is(Array.isArray(val), true)
        t.is(val[0].id, "idLorem")
        t.is(val[0].value, "valueIpsum")

    })

test('Validate Boolean Variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  "";
        val = VariableEncoder.validateVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, false)

        strVal =  "false";
        val = VariableEncoder.validateVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, false)

        strVal =  "true";
        val = VariableEncoder.validateVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, true);

        strVal =  "notValidValue";
        const error = await Utils.getError(() =>  VariableEncoder.validateVariable(strVal , "boolean", "boolVar"))
        t.deepEqual(error, new Error('cannot transcode variable boolVar of type boolean, possible values [true|false|""]'))

        strVal =  undefined;
        val = VariableEncoder.validateVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, undefined);


    })



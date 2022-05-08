
import test from "ava"
import {VariableEncoder} from "./variable-encoder.js";
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


function isObject(val) {
    return (typeof val === 'object');
}

test('Transcode object',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {

    let strVal = `{"id": "idLorem" , "value": "valueIpsum"}`;
    val = VariableEncoder.transcodeVariable(strVal , "LoremClass", "objVar")
    t.is(isObject(val), true)
    t.is(val.id, "idLorem")
    t.is(val.value, "valueIpsum")

})


test('Transcode Array of objects',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `[{"id": "idLorem" , "value": "valueIpsum"}]`;
        val = VariableEncoder.transcodeVariable(strVal , "Array<LoremClass>", "arrayVar")
        t.is(Array.isArray(val), true)
        t.is(val[0].id, "idLorem")
        t.is(val[0].value, "valueIpsum")

    })

test('Transcode Boolean Variable',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  "";
        val = VariableEncoder.transcodeVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, false)

        strVal =  "false";
        val = VariableEncoder.transcodeVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, false)

        strVal =  "true";
        val = VariableEncoder.transcodeVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, true);

        strVal =  "notValidValue";
        const error = await Utils.getError(() =>  VariableEncoder.transcodeVariable(strVal , "boolean", "boolVar"))
        t.deepEqual(error, new Error('cannot transcode variable boolVar of type boolean, possible values [true|false|""]'))

        strVal =  undefined;
        val = VariableEncoder.transcodeVariable(strVal , "boolean", "boolVar")
        t.is(VariableEncoder.isPrimitiveValue(val), true)
        t.is(val, undefined);


    })

test('Transcode string value',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `valueIpsum`;
        val = VariableEncoder.transcodeVariable(strVal , "string", "arrayVar")
        t.is(val, "valueIpsum")

    })

test('Transcode integer value',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `50`;
        val = VariableEncoder.transcodeVariable(strVal , "number", "numberVal")
        t.is(val, 50)

    })


test('Transcode float value',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `50.4`;
        val = VariableEncoder.transcodeVariable(strVal , "number", "floatVal")
        t.is(val, 50.4)

    })

test('Transcode uuid value as string',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `a0221430-a7ff-ac48-1ec6-8d21674e8464`;
        val = VariableEncoder.transcodeVariable(strVal , "string", "uuidVal")
        t.is(val, "a0221430-a7ff-ac48-1ec6-8d21674e8464")

    })

test('Transcode date value',
    /**
     *
     * @param {Assertions} t
     * @returns {Promise<void>}
     */
    async (t) => {
        let strVal =  `2022-01-01T12:00:00+01:00`;
        val = VariableEncoder.transcodeVariable(strVal , "Date", "dateVal")
        t.deepEqual(val, new Date(Date.parse(strVal)))
    })

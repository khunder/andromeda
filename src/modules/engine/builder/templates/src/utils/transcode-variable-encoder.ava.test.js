
import {VariableEncoder} from "./variable-encoder.js";
import Utils from "../../../../../../utils/utils.js";
import assert from "assert";


let val;

describe('Transcode variables', function () {


    it('Transcode object',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {

            let strVal = `{"id": "idLorem" , "value": "valueIpsum"}`;
            val = VariableEncoder.transcodeVariable(strVal, "LoremClass", "objVar")
            assert.equal(Utils.isObject(val), true)
            assert.equal(val.id, "idLorem")
            assert.equal(val.value, "valueIpsum")

        })


    it('Transcode Array of objects',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `[{"id": "idLorem" , "value": "valueIpsum"}]`;
            val = VariableEncoder.transcodeVariable(strVal, "Array<LoremClass>", "arrayVar")
            assert.equal(Array.isArray(val), true)
            assert.equal(val[0].id, "idLorem")
            assert.equal(val[0].value, "valueIpsum")

        })

    it('Transcode Boolean Variable',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = "";
            val = VariableEncoder.transcodeVariable(strVal, "boolean", "boolVar")
            assert.equal(VariableEncoder.isPrimitiveValue(val), true)
            assert.equal(val, false)

            strVal = "false";
            val = VariableEncoder.transcodeVariable(strVal, "boolean", "boolVar")
            assert.equal(VariableEncoder.isPrimitiveValue(val), true)
            assert.equal(val, false)

            strVal = "true";
            val = VariableEncoder.transcodeVariable(strVal, "boolean", "boolVar")
            assert.equal(VariableEncoder.isPrimitiveValue(val), true)
            assert.equal(val, true);

            strVal = "notValidValue";
            const error = await Utils.getError(() => VariableEncoder.transcodeVariable(strVal, "boolean", "boolVar"))
            t.deepEqual(error, new Error('cannot transcode variable boolVar of type boolean, possible values [true|false|""]'))

            strVal = undefined;
            val = VariableEncoder.transcodeVariable(strVal, "boolean", "boolVar")
            assert.equal(VariableEncoder.isPrimitiveValue(val), true)
            assert.equal(val, undefined);


        })

    it('Transcode string value',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `valueIpsum`;
            val = VariableEncoder.transcodeVariable(strVal, "string", "arrayVar")
            assert.equal(val, "valueIpsum")

        })

    it('Transcode integer value',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `50`;
            val = VariableEncoder.transcodeVariable(strVal, "number", "numberVal")
            assert.equal(val, 50)

        })


    it('Transcode float value',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `50.4`;
            val = VariableEncoder.transcodeVariable(strVal, "number", "floatVal")
            assert.equal(val, 50.4)

        })

    it('Transcode uuid value as string',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `a0251430-b7ff-ac48-1ec6-8d21674e7464`;
            val = VariableEncoder.transcodeVariable(strVal, "string", "uuidVal")
            assert.equal(val, "a0221430-a7ff-ac48-1ec6-8d21674e8464")

        })

    it('Transcode date value',
        /**
         *
         * @param {Assertions} t
         * @returns {Promise<void>}
         */
        async () => {
            let strVal = `2022-01-01T12:00:00+01:00`;
            val = VariableEncoder.transcodeVariable(strVal, "Date", "dateVal")
            assert.deepEqual(val, new Date(Date.parse(strVal)))
        })
});
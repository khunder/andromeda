import  {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

import md5 from 'md5'
import {VariableEncoder} from "../utils/variable-encoder.js";

export class Variable {

    #oldValue = null;
    #currentValue = null;

    /**
     * @type: string
     */
    _id

    /**
     * @type: string
     */
    name = null;
    /**
     * @type: string
     */
    type;

    constructor(name, type) {
        this.name = name;
        if (type) {
            this.type = type
        }
    }


    needToSave() {
        if(this.type !== "object"){
            return this.#oldValue !== this.#currentValue
        }else{
            return md5(JSON.stringify(this.#currentValue)) !== md5(JSON.stringify( this.#oldValue));
        }
    }

    resetStatus(){
        // this method is invoked after saving the variable (like in bulk save)
        if(this.type !== "object"){
            this.#oldValue =  this.#currentValue;
        }else{
            // deep clone & copy, dot not use reference
            this.#oldValue =  JSON.parse(JSON.stringify(this.#currentValue));
        }

    }



    get value() {
        return this.#currentValue;
    }

    set value(value) {
        // transcode (and validate) against the declared type, so a variable
        // always holds a properly-typed value regardless of what was passed in
        // (e.g. a caller sending {"age": "20"} for a declared "number" variable)
        const transcodedValue = VariableEncoder.transcodeVariable(value, this.type, this.name);
        if(this.type !== "object"){
            Logger.debug(`Set variable ${this.name} to ${transcodedValue}`)
        }else {
            Logger.debug(`set variable '${this.name}' to ${JSON.stringify(transcodedValue)}`)
        }
        this.#oldValue = this.#currentValue;
        this.#currentValue = transcodedValue;
    }
}

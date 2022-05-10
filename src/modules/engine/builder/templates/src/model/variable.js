import  {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

import md5 from 'md5'
import {VariableEncoder} from "../helpers/variable-encoder.js";

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
        VariableEncoder.transcodeVariable(value, this.type, this.name);
        if(this.type !== "object"){
            Logger.debug(`Set variable ${this.name} to ${value}`)
        }else {
            Logger.debug(`set variable '${this.name}' to ${JSON.stringify(value)}`)
        }
        this.#oldValue = this.#currentValue;
        this.#currentValue = value;
    }
}

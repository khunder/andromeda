import  {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

import Md5 from 'yamd5.js'
import {VariableEncoder} from "../helpers/variable-encoder";

export class Variable {
    /**
     * @type: string
     */
    _id
    oldValue = null;
    currentValue = null;
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
            return this.oldValue !== this.currentValue
        }else{
            return Md5.hashStr(JSON.stringify(this.currentValue)) !== Md5.hashStr(JSON.stringify( this.oldValue));
        }
    }

    resetStatus(){
        // this method is invoked after saving the variable
        if(this.type !== "object"){
            this.oldValue =  this.currentValue;
        }else{
            // deep clone & copy, dot not use reference
            this.oldValue =  JSON.parse(JSON.stringify(this.currentValue));
        }

    }

    value() {
       return this.currentValue;
    }

    setValue(value) {
        VariableEncoder.transcodeVariable(value, this.type, this.name);
        if(this.type !== "object"){
            Logger.debug(`Set variable ${this.name} to ${value}`)
        }else {
            Logger.debug(`set variable '${this.name}' to ${JSON.stringify(value)}`)
        }
        this.oldValue = this.currentValue;
        this.currentValue = value;
    }
}

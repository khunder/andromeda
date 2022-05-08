import {AndromedaLogger} from "../config/andromeda-logger.js";

const Logger = new AndromedaLogger();


export class VariableEncoder {

    static transcodeVariable(value, type, name) {
        let expression = `let value;`;
        if (value === undefined) {
            return undefined;
        } else {
            switch (type) {
                case "string":
                    expression += `value = \`${value}\`;`;
                    break;
                case "Date":
                    expression += `value= new Date(Date.parse(\`${value}\`));`
                    break;
                case "boolean":
                    if (!(value === "true" || value === "false" || value === "")) {
                        throw new Error(`cannot transcode variable ${name} of type ${type}, possible values [true|false|""]`);
                    }
                    if (value === "") {
                        expression += `value= !!\`${value}\`;`
                    } else {
                        expression += `value= !!${value};`
                    }
                    break;
                default:
                    if (VariableEncoder.isPrimitiveValue(value)) {
                        expression += `value= ${value};`
                    } else {
                        expression += `value= ${JSON.stringify(value)};`
                    }
            }
        }
        expression += `let variable = value; variable;`
        try {
            Logger.trace(`Transcoding variable ${name} of type: ${type} with string value=${value}`)
            return VariableEncoder.evaluate(expression);
        } catch (e) {
            Logger.trace(`Cannot transcode variable ${name} of type ${type} with string value=${value}`);
            throw new Error(`Cannot transcode variable ${name} of type ${type} with string value=${value}`);
        }
    }

    static evaluate(expression) {
        let code = ` ${expression}; `;
        try {
            return eval(code);
        } catch (e) {
            Logger.error(e);
            throw e;
        }
    }

    static isPrimitiveValue(val) {
        return val !== Object(val);
    }

}

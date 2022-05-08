import  {AndromedaLogger} from "../config/andromeda-logger.js";
const Logger = new AndromedaLogger();


export class VariableEncoder {

    static transcodeVariable(value, type, name?) {
        let expression = this.buildExpression(value, type);
        try {
            Logger.trace(`Transcoding variable ${name} of type: ${type} with string value=${value}`)
            return VariableEncoder.evaluate(expression);
        } catch (e) {
            Logger.trace(`Cannot transcode variable ${name} of type ${type} with string value=${value}`);
            throw new Error(`Cannot transcode variable ${name} of type ${type} with string value=${value}`);
        }
    }

    private static buildExpression(value, type) {
        let expression = `let value;`;
        if (type === 'string') {
            expression += `value = \`${value}\`;`;
        }
        if (type === 'Date') {
            expression += `value = new Date(Date.parse(\`${value}\`));`;
        }
        if(type !== 'string' && type !== 'Date'){
            expression += `value= ${value};`
        }
        expression += `let variable = value; variable;`
        return expression;
    }

    static evaluate(expression: any) {
        let code: string = ` ${expression}; `;
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

    static validateVariable(value, type, name?){
        let expression = `let value;`;
        if(type === "string"){
            expression += `value = \`${value}\`;`;
        }else{
            if(type === "Date"){
                expression += `value= new Date(Date.parse(\`${value}\`));`
            }else{
                if(VariableEncoder.isPrimitiveValue(value)){
                    expression += `value= ${value};`
                }else{
                    expression += `value= ${JSON.stringify(value)};`
                }
            }
        }
        expression += `let variable = value; variable;`
        try{
            Logger.trace(`transcoding variable ${name} of type: ${type} with string value=${value}`)
            return VariableEncoder.evaluate(expression);
        }catch (e) {
            Logger.trace(`cannot transcode variable ${name} of type ${type} with string value=${value}`);
            throw new Error(`cannot transcode variable ${name} of type ${type} with string value=${value}`);
        }
    }
}

import {EventStore} from "./event-store.js";
import AndromedaLogger from "../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();



export class EventDataPayloadValidator {


    static validate(event, schema){
        const validate = EventStore.ajv.compile(schema)
        const valid = validate(event.data)
        if (!valid){
            const error = new Error(`cannot validate event with type ${event.type} in stream ${event.streamId}`, JSON.stringify(validate.errors))
            Logger.error(error, JSON.stringify(validate.errors))
            throw error
        }
    }
}
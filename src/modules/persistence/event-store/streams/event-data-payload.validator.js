import {EventStore} from "../event-store.js";
import AndromedaLogger from "../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();



export class EventDataPayloadValidator {


    static validate(event, schema){
        const validate = EventStore.ajv.compile(schema)
        const valid = validate(event.data)
        if (!valid){
            Logger.error(`cannot validate event with type ${event.streamId}`)
            throw validate.errors
        }
    }
}
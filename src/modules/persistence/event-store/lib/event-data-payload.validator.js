import {EventStore} from "./event-store.js";
import { AndromedaLogger } from "../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();



export class EventDataPayloadValidator {

    // schemas are static objects declared in the stream builders, so each one
    // is compiled once and reused instead of recompiled on every event
    static compiledValidators = new Map()

    static validate(event, schema){
        let validate = EventDataPayloadValidator.compiledValidators.get(schema)
        if (!validate) {
            validate = EventStore.ajv.compile(schema)
            EventDataPayloadValidator.compiledValidators.set(schema, validate)
        }
        const valid = validate(event.data)
        if (!valid){
            const error = new Error(`cannot validate event with type ${event.type} in stream ${event.streamId}`, JSON.stringify(validate.errors))
            Logger.error(error, JSON.stringify(validate.errors))
            throw error
        }
    }
}
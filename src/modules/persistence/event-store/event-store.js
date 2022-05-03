import Ajv from "ajv";
import {EventStoreRepository} from "./internal/event-store.repository.js";
import {TestStream} from "./streams/test/test.stream.js";
import {ProcessInstanceStream} from "./streams/process-instance/process-intance.stream.js";
import AndromedaLogger from "../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class EventStore {


    static ajv = new Ajv()
    static schema = {
        type: "object",
        properties: {
            id: {type: "string"},
            streamId: {type: "string"},
            type: {type: "string"},
            streamPosition: {type: "integer"},
            data: {type: "object"},
            metadata: {type: "object"},
            timestamp: {type: "string"},
        },
        required: ["id", "type", "streamId", "streamPosition", "timestamp"],
        additionalProperties: false,
    }

    static async apply(event) {
        const validate = EventStore.ajv.compile(EventStore.schema)
        const valid = validate(event)
        if (!valid) throw validate.errors
        Logger.info(`valid`)
        EventStore.aggregateStreams(event);
        await new EventStoreRepository().CreateEvent(event)

    }

    //
    static aggregateStreams(event) {
        switch (event.streamId) {
            case TestStream.streamId: // used only for test purpose
                new TestStream().aggregate(event)
                break
                    ;
            case ProcessInstanceStream.streamId:
                new ProcessInstanceStream().aggregate(event)
                break
                    ;
            default:
                throw new Error(`cannot find am aggregator for the streamId: ${event.streamId}`);
        }

    }


}
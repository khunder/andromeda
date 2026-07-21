import Ajv from "ajv";
import { AndromedaLogger } from "../../../../config/andromeda-logger.js";
import {EventDataPayloadValidator} from "./event-data-payload.validator.js";
import {EventStoreRepository} from "../repositories/event-store.repository.js";
import {SnapshotRepository} from "../repositories/snapshot.repository.js";
import {EOL} from 'os';

const Logger = new AndromedaLogger();

export class EventStore {

    static streamsRegistry = {}

    static ajv = new Ajv()
    static eventSchema = {
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
        required: ["id", "type", "streamId", "timestamp"],
        // streamPosition will be filled by the stream if not provided
        additionalProperties: false,
    }

    // compiled once: Ajv compilation is expensive and the schema never changes
    static validateEvent = EventStore.ajv.compile(EventStore.eventSchema)

    static async apply(event) {
        if(!event){
            throw new Error(`event is not defined`)
        }
        Logger.trace(`applying event ${event.id}`)
        const validate = EventStore.validateEvent
        const valid = validate(event)
        if (!valid){
            const error = new Error(`cannot validate event ${JSON.stringify(event)}`)
            error.stack += `${EOL}------------------------------------${EOL}`
            error.stack += JSON.stringify(validate.errors, null,2)
            Logger.error(error)
            throw error
        }
        await EventStore.routeEventToCorrespondingStream(event);
        // save the event
        await new EventStoreRepository().persistEvent(event)
        // snapshot only after the event is safely in the log, so a snapshot
        // never reflects state the log does not contain
        await EventStore.maybeSnapshot(event)

    }

    /**
     * Persist a snapshot of the stream's read-model state every
     * snapshotFrequency events (disabled when 0 or no handler is set).
     */
    static async maybeSnapshot(event) {
        const stream = EventStore.streamsRegistry[event.streamId];
        if (!stream || !stream.snapshotHandler || !stream.snapshotFrequency) {
            return;
        }
        if ((event.streamPosition + 1) % stream.snapshotFrequency !== 0) {
            return;
        }
        const state = await stream.snapshotHandler.captureState();
        await new SnapshotRepository().saveSnapshot(stream.streamId, event.streamPosition, state);
    }

    //
    static async routeEventToCorrespondingStream(event) {
        Logger.trace(`routing event ${event.id}`)
        // choose the stream to route the event into
        if (!(event.streamId in EventStore.streamsRegistry)) {
            throw new Error(`cannot find am aggregator for the streamId: ${event.streamId}`);
        }

        // validate the event before dispatch
        const stream = EventStore.streamsRegistry[event.streamId];
        // compute event stream position if not provided
        this.updateStreamPosition(event, stream);

        if (!(event.type in stream.eventsRegistry)) {
            throw new Error(`event type (${event.type}) not supported by the stream ${stream.streamId}`)
        }
        if (event.type in stream.validators) {
            EventDataPayloadValidator.validate(event, stream.validators[event.type]);
        }
        await stream.dispatch(event);
    }

    static updateStreamPosition(event, stream) {
        // null-aware: 0 is a valid position and must not be overwritten
        if (event.streamPosition == null) {
            event.streamPosition = stream.streamPosition;
        }
        stream.streamPosition++;
    }

    static registerStream(id, streamProcessor){
        EventStore.streamsRegistry[id] = streamProcessor
    }


    static getStream(streamName) {
          return EventStore.streamsRegistry[streamName];
    }
}
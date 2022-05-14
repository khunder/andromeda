import {Stream} from "../../lib/stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../lib/event-store.js";


export class TestStreamBuilder {

    /**
     *
     * @returns {Stream}
     */
    build(){
        const stream = new Stream(StreamIds.TEST);
        stream.eventsRegistry =  {
            TEST: "TEST"
        }
        stream.validators ={
        }

        EventStore.registerStream(stream.streamId, stream);
        return stream;
    }

}
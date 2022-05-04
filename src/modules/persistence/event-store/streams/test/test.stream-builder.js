import {Stream} from "../stream.js";
import {StreamIds} from "../stream-ids.js";
import {EventStore} from "../../event-store.js";


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
import {StreamAggregatorIds} from "../stream-aggregator-ids.js";
import AndromedaLogger from "../../../../../config/andromeda-logger.js";
const Logger = new AndromedaLogger();

export class TestStream {
    get streamId () {
        return StreamAggregatorIds.TEST
    }

    aggregate(event){
        Logger.info(`FAKE TEST Stream aggregator`)
        Logger.trace(event)
    }
}
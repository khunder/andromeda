import {EventStore} from "./event-store/event-store.js";
import {v4} from "uuid";

export class PersistenceGateway {

    static async newProcessInstance({processInstanceId, deploymentId, processDef, containerId}) {
        await EventStore.apply(
            {
                id: v4(),
                streamId: "PROCESS_INSTANCE",
                type: "CREATE_PROCESS_INSTANCE",
                streamPosition: 0,
                data: {
                    id: processInstanceId,
                    deploymentId: deploymentId,
                    processDef: processDef,
                    status: 0,
                    containerId: containerId
                },
                timestamp: new Date().toString()
            }
        )
    }

    static closeProcessInstance() {

    };
}
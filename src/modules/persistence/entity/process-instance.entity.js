import {v4} from "uuid";

export class ProcessInstanceEntity {
    id
    deploymentId
    processDef
    status
    lock
}
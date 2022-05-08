import {EventStore} from "./event-store";

export class PersistenceGateway {

    static newProcessInstance(){
        EventStore.apply()
    }
    static closeProcessInstance(){

    };
}
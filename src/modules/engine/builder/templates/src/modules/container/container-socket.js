import Config from "../../config/config.js";
import  {AndromedaLogger} from "../../config/andromeda-logger.js";
import Utils from "../../utils/utils.js";

const Logger = new AndromedaLogger();

/**
 * User mainly for test purpose, combined with embedded containers
 */
export class ContainerSocket {
    static ipc
    static async init() {
        if (Config.getInstance().socketCallBacks) {
            ContainerSocket.ipc = (await import('node-ipc')).default;
            ContainerSocket.ipc.config.retry= 2000;
            ContainerSocket.ipc.config.id = 'container_socket';


        }
    }

    static callback(callbackName) {
        if(Config.getInstance().socketCallBacks){
            const socketPath = Utils.getSocketPath()+ ".sock";
            const fn = ContainerSocket.processSocket
            ContainerSocket.ipc.connectTo(
                'container_socket',
                socketPath,
                () => ContainerSocket.processSocket(callbackName)
            );
        }
    }

    static processSocket(callbackName){
        ContainerSocket.ipc.of.container_socket.on(
            'connect',
            function () {
                ContainerSocket.ipc.of.container_socket.emit(
                    callbackName,
                    {
                        message: process.pid
                    }
                );
                // ContainerSocket.ipc.disconnect('container_socket');
            }
        );
    }

}

export default ContainerSocket;
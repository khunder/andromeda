import path from "path";
import ipc from "node-ipc";
import {AndromedaLogger} from "../../../config/andromeda-logger.js";
import {Config} from "../../../config/config.js";

const Logger = new AndromedaLogger();

/**
 * NB: THIS HELPER IS USED ONLY LOCALLY IN DEV MODE
 * A helper to kill child (containers aka node process) using a separate daemon when the engine is closed
 * When the daemon detects that the engine is closed, checks pid regularly, it will close all related note processes.
 * When the engine starts, it will start the daemon, and sends its own pid.
 * When a container starts, it will send the pid of the created process, the daemon will store it in memory.
 */
export class EmbeddedSidecarDaemonService {
    static socketPath = path.join(process.cwd(), '/temp/andromeda.ipc.sock');

    static initDaemon() {
        ipc.config.id = 'andromeda_engine';
        ipc.config.retry = 5000;
        ipc.config.stopRetrying = true;

        function initEngine(socket) {
            ipc.of.andromeda_daemon.on(
                'connect',
                function () {
                    ipc.of.andromeda_daemon.emit(
                        'watch_engine_pid',
                        {
                            message: process.pid
                        }
                    );
                    ipc.disconnect('andromeda_engine');
                }
            );

        }

        import('child_process').then(childProcess => {
            childProcess.spawn('node', ['./dev-engine-sidecar.daemon.js'], {
                detached: true
            });
        })

        setTimeout(
            function () {
                ipc.connectTo(
                    'andromeda_daemon',
                    EmbeddedSidecarDaemonService.socketPath,
                    initEngine
                );
            }.bind(this),
            2000
        );
    }

    static watchContainer(pid) {
        try {
            ipc.of.andromeda_daemon.emit(
                'watch_container_pid',
                {
                    message: pid
                }
            );
        } catch (e) {
            Logger.warn(e);
        }
    }


    static unwatchContainerPid(pid) {
        try {
            ipc.of.andromeda_daemon.emit(
                'unwatch_container_pid',
                {
                    message: pid
                }
            );
        } catch (e) {
            Logger.warn(e)
        }
    }

    static shutdownDaemon() {
        ipc.of.andromeda_daemon.emit('shutdown', {});
    }
}
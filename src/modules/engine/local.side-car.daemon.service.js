import path from "path";
import ipc from "node-ipc";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {Config} from "../../config/config.js";

const Logger = new AndromedaLogger();

/**
 * A helper to kill child process via a separate daemon
 * when a process (container is started) we send his pid to the daemon
 */
export class LocalSideCarDaemonService {
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
                    LocalSideCarDaemonService.socketPath,
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
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
    // Use Windows named pipe format on Windows, Unix socket on other platforms
    static socketPath = process.platform === 'win32' 
        ? 'andromeda-daemon-ipc' // Windows named pipe (will become \\.\pipe\andromeda-daemon-ipc)
        : path.join(process.cwd(), '/temp/andromeda.ipc.sock'); // Unix socket
    static daemonInitialized = false;
    static connectionEstablished = false;
    
    static async ensureDaemonConnection() {
        if (!this.daemonInitialized) {
            await this.initDaemon();
        }
        
        // Wait a bit for connection to establish
        let attempts = 0;
        while (!this.connectionEstablished && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        return this.connectionEstablished;
    }

    static async initDaemon() {
        if (this.daemonInitialized) {
            return;
        }
        
        this.daemonInitialized = true;
        ipc.config.id = 'andromeda_engine';
        ipc.config.retry = 5000;
        ipc.config.stopRetrying = true;
        ipc.config.silent = true; // Reduce IPC logging noise
        ipc.config.networkHost = 'localhost'; // For Windows compatibility

        function initEngine(socket) {
            ipc.of.andromeda_daemon.on(
                'connect',
                function () {
                    Logger.info('Connected to andromeda_daemon');
                    EmbeddedSidecarDaemonService.connectionEstablished = true;
                    ipc.of.andromeda_daemon.emit(
                        'watch_engine_pid',
                        {
                            message: process.pid
                        }
                    );
                    // Don't disconnect immediately, keep the connection alive
                    // ipc.disconnect('andromeda_engine');
                }
            );
            
            ipc.of.andromeda_daemon.on(
                'error',
                function(err) {
                    Logger.debug('IPC connection error:', err);
                }
            );
        }

        // Check if daemon is already running by trying to connect first
        ipc.connectTo(
            'andromeda_daemon',
            EmbeddedSidecarDaemonService.socketPath,
            function() {
                ipc.of.andromeda_daemon.on('connect', function() {
                    Logger.info('Daemon already running, reusing existing connection');
                    EmbeddedSidecarDaemonService.connectionEstablished = true;
                    initEngine();
                });
                
                ipc.of.andromeda_daemon.on('error', function(err) {
                    Logger.debug('Daemon not running, starting new instance');
                    // Daemon not running, start it
                    import('child_process').then(childProcess => {
                        try {
                            const daemonScript = path.join(process.cwd(), 'dev-engine-sidecar.daemon.js');
                            
                            // Check if daemon script exists
                            import('fs').then(fs => {
                                if (!fs.existsSync(daemonScript)) {
                                    Logger.debug('Daemon script not found at:', daemonScript);
                                    Logger.debug('Daemon will not be available, but container will still work');
                                    return;
                                }
                            }).catch(() => {
                                // Continue without checking, let spawn handle the error
                            })
                            
                            const child = childProcess.spawn('node', [daemonScript], {
                                detached: true,
                                stdio: 'ignore',
                                shell: false,
                                windowsHide: true // Hide console window on Windows
                            });
                            
                            child.on('error', (err) => {
                                Logger.debug('Failed to spawn daemon process:', err.message);
                            });
                            
                            child.unref();
                            
                            // Wait a bit for daemon to start, then try to connect
                            setTimeout(
                                function () {
                                    ipc.connectTo(
                                        'andromeda_daemon',
                                        EmbeddedSidecarDaemonService.socketPath,
                                        initEngine
                                    );
                                },
                                3000 // Give more time for daemon to start on Windows
                            );
                        } catch (err) {
                            Logger.debug('Error starting daemon:', err.message);
                        }
                    }).catch(err => {
                        Logger.debug('Failed to import child_process:', err.message);
                    });
                });
            }
        );

        // Connection handling is done above
    }

    static async watchContainer(pid) {
        try {
            // Skip daemon in test mode to avoid delays
            if (process.env.isUnitTestMode === 'true') {
                Logger.debug(`Test mode: Skipping daemon watch for PID ${pid}`);
                return;
            }
            
            // Ensure daemon is connected first
            const connected = await this.ensureDaemonConnection();
            
            if (connected && ipc.of && ipc.of.andromeda_daemon) {
                ipc.of.andromeda_daemon.emit(
                    'watch_container_pid',
                    {
                        message: pid
                    }
                );
                Logger.info(`Watching container PID ${pid} with daemon`);
            } else {
                Logger.debug(`Daemon not available. Container PID ${pid} will not be watched. This is OK for testing.`);
            }
        } catch (e) {
            Logger.debug(`Daemon watch failed for PID ${pid}:`, e.message);
            // Don't fail the process, daemon is optional
        }
    }


    static unwatchContainerPid(pid) {
        try {
            // Check if the IPC connection exists before trying to emit
            if (ipc.of && ipc.of.andromeda_daemon) {
                ipc.of.andromeda_daemon.emit(
                    'unwatch_container_pid',
                    {
                        message: pid
                    }
                );
            } else {
                Logger.debug(`IPC connection to andromeda_daemon not established. Cannot unwatch container PID ${pid}.`);
            }
        } catch (e) {
            Logger.warn(e)
        }
    }

    static shutdownDaemon() {
        Logger.warn(`Signal to shutdown the daemon was received`);
        if (ipc.of && ipc.of.andromeda_daemon) {
            ipc.of.andromeda_daemon.emit('shutdown', {});
        } else {
            Logger.debug(`IPC connection to andromeda_daemon not established. Cannot send shutdown signal.`);
        }
    }
}
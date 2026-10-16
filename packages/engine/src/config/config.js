import { AndromedaLogger } from '../config/andromeda-logger.js';
import Utils from '../utils/utils.js';
import path from 'path';


let config

const Logger = new AndromedaLogger();
export class Config {
    mongoDbUri;
    deploymentPath;
    tempPath;
    activateModules=[];
    environment
    host
    port

    isLocalMode
    isUnitTestMode

    static getInstance(force) {
        if (!config || force) {
            Logger.info(`creating new Config instance`)
            Utils.loadEnvVariables();
            config = new Config();
        }
        return config;
    }

    constructor() {
        Logger.trace(`Loading Config values...`)
        this.mongoDbUri = process.env.MONGODB_URI;
        this.deploymentPath = process.env.deploymentPath || path.join(process.cwd(), "deployments");
        this.tempPath = process.env.tempPath || "temp";
        this.activateModules = process.env.ACTIVE_MODULES.split(',').map( e => e.trim());
        this.environment = process.env.ENV || "local";
        this.isLocalMode= this.environment === "local";
        this.isUnitTestMode= process.env.isUnitTestMode === "true";
        this.host= process.env.host || "127.0.0.1";
        this.port= process.env.port || "5000";
        this.galaxyHost = process.env.GALAXY_HOST || '127.0.0.1';
        this.galaxyPort = process.env.GALAXY_PORT || '5001';
        this.galaxyUrl = process.env.GALAXY_URL || `http://${this.galaxyHost}:${this.galaxyPort}`;
        // persistence driver switch: 'sqlite' (default - sql.js, no database
        // server needed) or 'mongodb' (needs MONGODB_URI)
        this.persistenceDriver = process.env.PERSISTENCE_DRIVER || 'sqlite';
        this.sqliteFilePath = process.env.SQLITE_FILE_PATH || path.join(process.cwd(), 'andromeda.sqlite');
        // file variables - handed to embedded containers as-is (see
        // embedded.containers.service.js and the container's own config.js).
        // Defaults live here so every embedded container shares one storage
        // folder instead of one per deployment folder (deleted on recompile).
        this.fileStorageDriver = process.env.FILE_STORAGE_DRIVER || 'local';
        this.fileStorageDir = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), 'storage');
        this.fileInputDir = process.env.FILE_INPUT_DIR ? path.resolve(process.env.FILE_INPUT_DIR) : '';
        this.fileInlineMaxBytes = bytesFromEnv('FILE_INLINE_MAX_BYTES', 256 * 1024);
        this.fileMaxBytes = bytesFromEnv('FILE_MAX_BYTES', 10 * 1024 * 1024);
        this.fileForcedMaxBytes = bytesFromEnv('FILE_FORCED_MAX_BYTES', 100 * 1024 * 1024);
        this.fileUrlTimeoutMs = bytesFromEnv('FILE_URL_TIMEOUT_MS', 30_000);
        // optional OIDC for containers' human tasks - handed to embedded
        // containers as-is; see the container's src/modules/auth
        this.oidcEnabled = process.env.OIDC_ENABLED || '';
        this.oidcIssuer = process.env.OIDC_ISSUER || '';
        this.oidcAudience = process.env.OIDC_AUDIENCE || '';
        this.oidcJwksUri = process.env.OIDC_JWKS_URI || '';
        this.oidcRolesClaim = process.env.OIDC_ROLES_CLAIM || '';
        this.oidcAdminRole = process.env.OIDC_ADMIN_ROLE || '';
    }
}

function bytesFromEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

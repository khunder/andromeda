import  {AndromedaLogger} from "./andromeda-logger.js";

let config;
import {config as LoadDotEnvConfig}  from 'dotenv';
import path from 'path'
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

LoadDotEnvConfig({ path: path.resolve(__dirname, '../../../..', '.env') });
const Logger = new AndromedaLogger();
export class Config {
    mongoDbUri;
    tempPath;
    deploymentId

    host
    port

    socketCallBacks // list of ids of activities to associate with a common callback
    // if an id is found, we trigger a callback, this call back will communicate via ipc file socket

    static getInstance() {
        if (!config) {
           Logger.info(`creating new Config instance`)
            config = new Config();
        }
        return config;
    }

    constructor() {
        Logger.trace(`Loading Config values...`)
        this.mongoDbUri = process.env.MONGODB_URI;
        this.tempPath = process.env.tempPath || "temp";
        this.host= process.env.host || "127.0.0.1";
        this.port = process.env.port || 10000;
        this.deploymentId = process.env.deploymentId;
        if(process.env.socketCallBacks){
            this.socketCallBacks =  process.env.socketCallBacks.split(",");
        }
        // persistence driver switch: 'sqlite' (default - sql.js) or 'mongodb'
        // (needs MONGODB_URI). Embedded containers are handed the engine's own
        // driver and, for sqlite, SQLITE_FILE_PATH (see
        // embedded.containers.service.js) so both share the same database.
        this.persistenceDriver = process.env.PERSISTENCE_DRIVER || 'sqlite';
        this.sqliteFilePath = process.env.SQLITE_FILE_PATH || path.join(process.cwd(), 'andromeda.sqlite');
        // file variables (see src/modules/files). Embedded containers are
        // handed the engine's own values (see embedded.containers.service.js).
        // object storage for files above fileInlineMaxBytes: 'local' (folder) for now
        this.fileStorageDriver = process.env.FILE_STORAGE_DRIVER || 'local';
        this.fileStorageDir = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), 'storage');
        // folder `path` file inputs may be read from - unset = path inputs disabled
        this.fileInputDir = process.env.FILE_INPUT_DIR || '';
        // up to this size a file is kept in the database rather than object storage
        this.fileInlineMaxBytes = bytesFromEnv('FILE_INLINE_MAX_BYTES', 256 * 1024);
        // bigger files fail the process instance at start, unless forced
        this.fileMaxBytes = bytesFromEnv('FILE_MAX_BYTES', 10 * 1024 * 1024);
        // absolute cap for forced files (also the multipart upload limit)
        this.fileForcedMaxBytes = bytesFromEnv('FILE_FORCED_MAX_BYTES', 100 * 1024 * 1024);
        this.fileUrlTimeoutMs = bytesFromEnv('FILE_URL_TIMEOUT_MS', 30_000);
        // optional OIDC (see src/modules/auth): off = every caller acts as the admin
        this.oidcEnabled = /^(true|1|yes|on)$/i.test(process.env.OIDC_ENABLED || '');
        this.oidcIssuer = process.env.OIDC_ISSUER || '';
        // when set, the token's `aud` must contain it
        this.oidcAudience = process.env.OIDC_AUDIENCE || '';
        // skips discovery when set
        this.oidcJwksUri = process.env.OIDC_JWKS_URI || '';
        // comma-separated claim paths roles are read from
        this.oidcRolesClaims = (process.env.OIDC_ROLES_CLAIM || 'roles,realm_access.roles').split(',').map((claim) => claim.trim()).filter(Boolean);
        // may complete any task
        this.oidcAdminRole = process.env.OIDC_ADMIN_ROLE || 'process-admin';
    }
}

function bytesFromEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export default Config;

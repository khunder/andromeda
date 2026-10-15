import {Config} from "../../config/config.js";
import {AndromedaLogger} from "../../config/andromeda-logger.js";
import {PersistenceGateway} from "../persistence/persistence-gateway.js";
import {createObjectStorage, DatabaseFileStorage} from "./object-storage.js";
import {FileService} from "./file.service.js";

/**
 * This container's FileService, built from its configuration (see
 * src/config/config.js: FILE_STORAGE_DRIVER, FILE_STORAGE_DIR, FILE_INPUT_DIR,
 * FILE_INLINE_MAX_BYTES, FILE_MAX_BYTES, FILE_FORCED_MAX_BYTES).
 */
let fileService = null;

/** @returns {FileService} */
export function getFileService() {
    if (!fileService) {
        const config = Config.getInstance();
        fileService = new FileService({
            objectStorage: createObjectStorage({driver: config.fileStorageDriver, rootDir: config.fileStorageDir}),
            databaseStorage: new DatabaseFileStorage(PersistenceGateway),
            limits: {
                inlineMaxBytes: config.fileInlineMaxBytes,
                maxBytes: config.fileMaxBytes,
                forcedMaxBytes: config.fileForcedMaxBytes,
            },
            logger: new AndromedaLogger(),
        });
    }
    return fileService;
}

/** Names of the `file` variables declared by a process instance context. */
export function fileVariableNames(context) {
    return context.__variablesRef.filter((variable) => variable.type === 'file').map((variable) => variable.name);
}

/** `forceFileSize` from a JSON body (boolean) or a multipart field ("true"). */
export function isForced(body) {
    const value = body?.forceFileSize;
    return value === true || value === 'true' || value === '1' || value === 'on';
}

export {collectFileInputs, FileInputError, FileTooLargeError} from "./file-inputs.js";


import serverController from "../modules/engine/embedded/controllers/embedded-server.controller.js";
import commonServerController from "../modules/engine/common/controllers/server.controller.js";
import {Config} from "../config/config.js";
import constants from "../config/constants.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



function route (fastify, opts, next) {
    if(Config.getInstance().activateModules.filter(e=> e === constants.SERVER).length > 0){
        fastify.route(
            {
                method: 'POST',
                url: '/api/compile',
                preHandler: async (request, reply) => {
                    // Handle multipart form data
                    const parts = request.parts();
                    const files = [];
                    const body = {};
                    
                    for await (const part of parts) {
                        if (part.type === 'file') {
                            // Handle file upload
                            const buffer = await part.toBuffer();
                            const uploadDir = path.join(__dirname, '../../uploads');
                            
                            // Create uploads directory if it doesn't exist
                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }
                            
                            const filename = `${Date.now()}-${part.filename}`;
                            const filepath = path.join(uploadDir, filename);
                            
                            fs.writeFileSync(filepath, buffer);
                            
                            files.push({
                                fieldname: part.fieldname,
                                filename: part.filename,
                                path: filepath,
                                mimetype: part.mimetype
                            });
                        } else {
                            // Handle form fields
                            body[part.fieldname] = part.value;
                        }
                    }
                    
                    // Attach processed data to request
                    request.files = files;
                    request.body = body;
                },
                handler: commonServerController.compile
            }
        )

        fastify.route(
            {
                method: 'POST',
                url: '/api/run-embedded',
                preHandler: async (request, reply) => {
                    // Handle multipart form data
                    const parts = request.parts();
                    const files = [];
                    const body = {};
                    
                    for await (const part of parts) {
                        if (part.type === 'file') {
                            // Handle file upload
                            const buffer = await part.toBuffer();
                            const uploadDir = path.join(__dirname, '../../uploads');
                            
                            // Create uploads directory if it doesn't exist
                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }
                            
                            const filename = `${Date.now()}-${part.filename}`;
                            const filepath = path.join(uploadDir, filename);
                            
                            fs.writeFileSync(filepath, buffer);
                            
                            files.push({
                                fieldname: part.fieldname,
                                filename: part.filename,
                                path: filepath,
                                mimetype: part.mimetype
                            });
                        } else {
                            // Handle form fields
                            body[part.fieldname] = part.value;
                        }
                    }
                    
                    // Attach processed data to request
                    request.files = files;
                    request.body = body;
                },
                handler: serverController.runEmbeddedContainer
            }
        )
    }


    next();
}

export default  route
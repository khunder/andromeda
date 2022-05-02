import YAML from 'yaml';

export class OpenApiGenerator {
    version = "3.0.0"
    info = {
        description: "Test swagger specification",
        version: "1.0.0",
        title: "Test swagger specification",
        contact: {
            email: "super.developer@gmail.com"
        }
    }

    components = {
        schemas: {
            "User": {
                type: "object",
                properties: {
                    id: {
                        type: "integer",
                        example: 4
                    },
                    name: {
                        type: "string",
                        example: "Arthur Dent"
                    }
                },
                required: [
                    "id"
                    , "name"
                ]
            }
        }
    }

    servers = []

    paths = {}


    setServer(url, description) {
        this.servers.push({url: url, description: description});
        return this;
    }


    setInfo(info) {
        this.info = info;
        return this;
    }

    setInfoTitle(title) {
        if (this.info) {
            this.info.title = title;
        }
        return this;
    }

    setInfoDescription(description) {
        if (this.info) {
            this.info.description = description;
        }
        return this;
    }

    setInfoVersion(version) {
        if (this.info) {
            this.info.version = version;
        }
        return this;
    }

    setInfoContactEmail(email) {
        if (this.info && this.info.contact) {
            this.info.contact.email = email;
        } else {
            this.info.contact = {email: email}
        }
        return this;
    }

    addPath(path, verb) {
        if (this.paths && this.paths[path]) {
            // Object.keys().forEach(key => {
            //     this.paths[key] = this.paths[]
            // })
            // this.paths = {...this.paths}
            this.paths[path][verb] = {};
        } else {
            this.paths[path] = {}
            this.paths[path][verb] = {}
        }

        return this;
    }

    addPathDescription(path, verb, desc) {
        if (this.paths[path] && this.paths[path][verb]) {
            this.paths[path][verb].description = desc
        }
        return this;
    }

    addPathTags(path, verb, tags) {
        if (this.paths[path] && this.paths[path][verb]) {
            this.paths[path][verb].tags = tags
        }
        return this;
    }

    addResponse(path, verb, response) {
        if (this.paths[path] && this.paths[path][verb]) {
            this.paths[path][verb].responses = {...this.paths[path][verb].responses}
            Object.keys(response).forEach(k => {
                this.paths[path][verb].responses[k] = response[k]
            })
        }
        return this;
    }

    setPathResponseSchema(path, verb, statusCode, contentType, schema) {
        const original = this.paths[path][verb].responses[statusCode]
        const patchedVersion = JSON.parse(`{
            "content": {
                "${contentType}":
                    {
                        "schema": ${JSON.stringify(schema)}
                    }
            }
        }`)
        this.paths[path][verb].responses[statusCode] = {...original, ...patchedVersion}
        return this;
    }

    setRequestBodyContent(path, verb, content) {
        if (this.paths[path]
            && this.paths[path][verb]
            && this.paths[path][verb].requestBody.content
        ) {
            const original = this.paths[path][verb].requestBody.content
            const patchedVersion = content
            this.paths[path][verb].requestBody.content = {...original, ...patchedVersion}
        } else {
            console.log(`cannot get request body content`)
        }
        return this;
    }

    setRequestBody(path, verb, requestBody) {
        if (this.paths[path] && this.paths[path][verb]) {
            this.paths[path][verb].requestBody = requestBody;
        }
        return this;
    }

    render() {
        const root = {}
        root.openapi = this.version;
        root.info = this.info;
        root.servers = this.servers;
        if (this.components)
            root.components = this.components;
        root.paths = this.paths;


        return this.toYaml(root)


    }

    toYaml(json) {
        const doc = new YAML.Document();
        doc.contents = json;
        return doc.toString();
    }
}


let opt = {
    "200":
        {
            description: "",
            content: {
                "application/json":
                    {
                        schema: {
                            type: "object",
                            example: {
                                uptime: "number"
                            },
                            properties: {
                                bpmnFile: {
                                    type: "array",
                                    items: {
                                        type: "string",
                                        format: "binary"
                                    }
                                },
                                deploymentId: {
                                    type: "string"
                                }
                            }
                        }
                    }
            }
        }
}


let opt2 = {
    "201":
        {
            description: "",
        }
}


let optCombined = {
    "202":
        {
            description: "",
            content: {
                "application/json":
                    {
                        schema: {
                            type: "object",
                            example: {
                                uptime: "string"
                            }
                        }
                    }
            }
        },
    "203":
        {
            description: "",
            content: {
                "application/json":
                    {
                        schema: {
                            type: "object",
                            example: {
                                uptime: "number"
                            }
                        }
                    }
            }
        }
}

/**
 *
 * @type {OpenApiGenerator}
 */
const op = new OpenApiGenerator();
op.setServer("http://127.0.0.1:5000/", "localhost1")
    .setServer("http://127.0.0.1:5001/", "localhost2")
    .setInfo({
        description: "Container swagger specification",
        version: "0.0.0",
        title: "Container swagger specification",
    })
    .setInfoTitle("Info updated")
    .setInfoDescription("desc updated")
    .setInfoVersion("1.0.1")
    .setInfoContactEmail("benrhoumazied@gmail.com")

    .addPath("/live", "get")
    .addPathDescription("/live", "get", "www")
    .addPathTags("/live", "get", ["startup probe"])

    .addResponse("/live", "get", opt)
    .addResponse("/live", "get", opt2)
    .addResponse("/live", "get", optCombined)
    .addPath("/live", "post")
    .addResponse("/live", "post", opt)
    .setPathResponseSchema("/live", "post", "200", "application/json", {$ref: '#/components/schemas/User'})
    .setRequestBody("/live", "get", {
        required: true,
        content:
            {
                "application/json":
                    {
                        schema: {
                            type: "object",
                            properties: {
                                username: {
                                    type: "string"
                                }
                            }
                        }
                    }
            }
    })
    .setRequestBody("/live", "post", {
        required: true,
        content:
            {
                "application/json":
                    {
                        schema: {
                            type: "object",
                            properties: {
                                username: {
                                    type: "string"
                                }
                            }
                        }
                    }
            }
    })
    .setRequestBodyContent("/live", "post",
        {
            "application/json":
                {
                    schema: {
                        $ref: '#/components/schemas/User'
                    }
                }
        })


console.log(op.render())

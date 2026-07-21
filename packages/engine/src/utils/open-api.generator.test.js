import {OpenApiGenerator} from "./open-api.generator.js";


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

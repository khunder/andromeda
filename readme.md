# Bpmn Engine for microservice cloud era.

> A Node.js project

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm start
```
## Prerequisites
- Nodejs
- MongoDB

`.env file`
``` properties
MONGODB_URI=mongodb://127.0.0.1:27017/andromeda
#ACTIVE_MODULES=server, persistence
ACTIVE_MODULES=server
ENV=local

```

## RUN Generated Code (valid for local dev mode)
Inside the folder deployment, and only during dev mode, when you want to debug locally your workflow
you can run the generated code using only node, to do so, you must make sure that node modules are correctly installed.
also you will need to install dotenv-cli globally

```shell
npm install dotenv-cli -g
```

```shell
yarn run start:container:local
npm  run start:container:local
```
The target `start:container:local` will load default env variables from the file `.env` located in the project root,
then it will bootstrap the container code.
this method is very useful when you need to **debug a workflow**.
YEAH BABY, debug...

## Andromeda in nutshell  

Andromeda is a workflow engine based on **CODE GENERATION**.  
A workflow (bpmn file) will be translated into a full functional nodejs APP, we call it **CONTAINER**.  
A `container` can be thought of as a `microservice`.

Andromeda have many deployment modes.
- The engine with embedded container (a node process side by side with the engine)
- The engine with an external container (build docker image and deployed it elsewhere)
- The galaxy module is an annex module used to query the runtime execution of the workflows.
  - Galaxy can be embedded with the engine (No HA)
  - Galaxy can be deployed as separate app
    - When we have an intensive use of workflows, too many deployed workflows.
    - 
### JAVASCRIPT / TYPESCRIPT ?
The engine, the generated code and all the annex modules are developed using pure ES6 javascript.  
It was a tough decision to make, along with too many others repercussion related to this choice.  

**pros**
- No transpile, the error you get comes from the code you have written, not the transpiled.
- No transpile, means less memory footprint.
- More optimised code, ***to be taken with a pinch of salt***.
- A pure es6 with minimum dependencies, will live longer.
- Support ESM modules

**Cons**:
- cannot use types, advance class features (abstract, visibility modifiers...)
- cannot use frameworks like nestjs, typeorm ...


## Andromeda Modules
This project is based on a powerful modular design made to be activated using env variables.  
some of these modules are included even in the generated code as they are (a dump copy).  
Example: The galaxy module which regroups common rest endpoint to query the workflow model.
- Get process instances status
- Get variables
- Get tasks (human forms)
- ...


Also, the web module is copied to the generated container, the web module does not depend on
other component, it uses `fastify`s which provide a way to self discover routes.  
just put your routes in a folder called `routes` nad that's it, they will be scanned and exposed.  
this mechanism makes possible to generate routes for each module without modify the module itself.

#### Why? ... Code reuse
- Persistence
- Web module
- Galaxy module (depend on persistence)

Some functional use cases need some modules to be activated, for example, for a small application that need a basic
validation process, we don't need to have a separate galaxy application deployed by itself since we will have only
a small number of workflows. this of it as a combo, the app will expose routes to create new process instances and in the same time
will expose other endpoints to query the list of process instances, the status of each process instance...  

Also, for demos and for sandbox engines, Andromeda will be shipped with all modules,

- engine
- persistence
- galaxy 
- Web
  
In this case you can start using the product with minimum effort, you can generate embedded containers 


### Persistence

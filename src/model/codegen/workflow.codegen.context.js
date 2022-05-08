import * as tsMorph from "ts-morph";

class WorkflowCodegenContext {

    processId
    /**
     * @param {ContainerCodegenContext} containerCodegenContext
     */
    containerCodegenContext
    /**
     * @type {Project}
     */
    project = new tsMorph.Project({});

    serviceClass;
    controllerClass;

    /**
     * @type {SourceFile}
     */
    serviceClassFile;
    /**
     * @type {SourceFile}
     */
    controllerClassFile;

    controllerClassImports =[];
    serviceClassImports =[];


    constructor(containerCodegenContext) {
        this.containerCodegenContext = containerCodegenContext;
    }

    addControllerClassImport(defaultImport, moduleSpecifier){
        this.controllerClassImports.push({defaultImport,moduleSpecifier})
    }

    renderImports() {
        this.controllerClassImports.forEach((entry) => {
            this.controllerClassFile.addImportDeclaration({
                defaultImport: entry.defaultImport,
                moduleSpecifier: entry.moduleSpecifier,
            });
        });
        this.serviceClassImports.forEach((entry) => {
            this.serviceClassFile.addImportDeclaration({
                defaultImport: entry.defaultImport,
                moduleSpecifier: entry.moduleSpecifier,
            });
        });
    }
}

export default WorkflowCodegenContext;
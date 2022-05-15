import * as tsMorph from "ts-morph";

class WorkflowCodegenContext {

    processId
    /**
     * @param {ContainerCodegenContext} containerCodegenContext
     */
    containerCodegenContext
    /**
     * @type {tsMorph.Project}
     */
    project = new tsMorph.Project({});

    /**
     * @type {tsMorph.ClassDeclaration}
     */
    serviceClass;

    /**
     * @type {tsMorph.ClassDeclaration}
     */
    controllerClass;

    /**
     * @type {tsMorph.ClassDeclaration}
     */
    workflowModelClass

    /**
     * @type {tsMorph.SourceFile}
     */
    workflowModelFile


    /**
     * @type {tsMorph.SourceFile}
     */
    serviceClassFile;
    /**
     * @type {tsMorph.SourceFile}
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
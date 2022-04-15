import * as tsMorph from "ts-morph";

class WorkflowCodegenContext {

    processId
    containerCodegenContext
    project = new tsMorph.Project({});

    serviceClass;
    controllerClass;

    serviceClassFile;
    controllerClassFile;

    controllerClassImports =[];
    serviceClassImports =[];


    constructor(containerCodegenContext) {
        this.containerCodegenContext = containerCodegenContext;
    }

    renderImports() {
        this.controllerClassImports.forEach((entry) => {
            this.controllerClassFile.addImportDeclaration({
                defaultImport: entry.object,
                moduleSpecifier: entry.from,
            });
        });
        this.serviceClassImports.forEach((entry) => {
            this.serviceClassFile.addImportDeclaration({
                defaultImport: entry.object,
                moduleSpecifier: entry.from,
            });
        });
    }
}

export default WorkflowCodegenContext;
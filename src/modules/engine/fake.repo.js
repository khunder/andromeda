import path from "path";
import fs from "fs";
import {Shell} from "../../services/shell.js";
import nunjucks from "nunjucks";

class FakeRepo{
    extractWorkflowPrefix(containerContext) {
        if (!containerContext.model)
            return undefined;
    }

    /**
     * method to load template, evaluate it
     * @param sourceTemplate: nunjucks template
     * @param destFile: file to create
     * @param containerContext: variables
     */
    createFile(sourceTemplate, destFile, containerContext) {
        try {
            const destFolder = path.dirname(destFile);
            if (!fs.existsSync(destFolder)) {
                Shell.mkdir( destFolder);
            }
            //
            nunjucks.configure({
                autoescape: false,
                trimBlocks: true,
                lstripBlocks: true,
            });
            const resultText = nunjucks.renderString(
                fs.readFileSync(sourceTemplate, 'utf-8'),
                {
                    ...containerContext,
                },
            );
            fs.writeFileSync(
                destFile,
                resultText,
            );
        } catch (e) {
            throw new Error(e);
        }
    }

}
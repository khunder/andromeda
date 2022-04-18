import fs from "fs";


export class Shell{

    static mkdir(path){
        fs.mkdirSync(path, { recursive: true })
    }
}
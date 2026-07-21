import path from "path";
import Config from "../config/config.js";

export class Utils {
    static getSocketPath() {
        return path.join(process.cwd(), `./.pid_${Config.getInstance().port}`);
    }

}

export default Utils;
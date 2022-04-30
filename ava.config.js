import * as dotenv  from "dotenv";

dotenv.config({ path: './test/.env' });

export default {

    files: ["**/*.test.ava.js"],

    "verbose": true,
    "nodeArguments": [
        "--trace-deprecation",
        "--napi-modules"
    ],
    "failWithoutAssertions": false
};
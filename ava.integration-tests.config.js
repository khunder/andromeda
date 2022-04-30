import {default as baseConfig}  from "./ava.config.js";

export default  {
    ...baseConfig,
    files: ['**/*.integration.ava.test.js']
};
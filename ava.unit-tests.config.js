import {default as baseConfig}  from "./ava.config.js";

export default  {
    ...baseConfig,
    files: ['**/*.unit.ava.test.js'],
};
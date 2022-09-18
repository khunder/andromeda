import Log4jsConfigJs from "../config/log4js.config.js";

import sinon, {stub} from "sinon";
import assert from "assert";

/**
 * ESM with Node <=16.13.1 cannot be unloaded, we are using separate test files for testing log4js
 * because
 */
it('Logger json to stdout',
    /**
     *
     * @param {Assertions}t
     * @returns {Promise<void>}
     */
    async () => {

        //given
        const log4jsConfigJs = new Log4jsConfigJs()
        log4jsConfigJs._log4jsConfig.categories.default.appenders.push("fluentbit");
        log4jsConfigJs._log4jsConfig.appenders.fluentbit = {
            type: 'stdout',
            layout: {type: 'json'},
        };

        process.env.ENV = "test"
        process.env.IP = "127.0.0.1"

        let messagesCount = 0
        let stb = stub(process.stdout, 'write').callsFake(function () {
            return true;
        })

        const AndromedaLogger = await import ("./andromeda-logger.js")
        const logger = new AndromedaLogger.AndromedaLogger("test logger", log4jsConfigJs.getConfig());


        // when
        logger.info("test")
        messagesCount += 1;
        // then each tome two messages are logged the stdout (standard stdout + json message )

        assert.equal(stb.getCalls().length, 2)
        // when
        logger.error("error message")
        messagesCount += 1;

        //then
        // expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        assert.equal(stb.getCalls().length, messagesCount * 2)
        // // when
        logger.error({})
        messagesCount += 1;
        //then
        // expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        assert.equal(stb.getCalls().length, messagesCount * 2)

        // // when
        logger.warn("warn")
        messagesCount += 1;
        //then
        // expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        assert.equal(stb.getCalls().length, messagesCount * 2)

        // when
        logger.trace("trace")
        messagesCount+=1;
        //then
        assert.equal(stb.getCalls().length,messagesCount*2)

        // when
        logger.fatal("fatal")
        messagesCount+=1;
        //then
        assert.equal(stb.getCalls().length,messagesCount*2)

        // when
        logger.debug("debug")
        messagesCount+=1;
        //then
        assert.equal(stb.getCalls().length,messagesCount*2)

        //
        // given another config and another instance of AndromedaLogger
        const log4jsConfigJs2= new Log4jsConfigJs()
        const AndromedaLogger2 = await import ("./andromeda-logger.js")
        const logger2= new AndromedaLogger2.AndromedaLogger(undefined,log4jsConfigJs2.getConfig());
        // when
        logger2.info("test")
        // then make sure this time we write once to the stdout
        // expect(process.stdout.write).toBeCalledTimes(messagesCount*2+1)
        assert.equal(stb.getCalls().length,messagesCount*2+1)


    })

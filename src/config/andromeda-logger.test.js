import {jest} from '@jest/globals'
import Log4jsConfigJs from "../config/log4js.config.js";

describe("Logger test", () => {

    /**
     * ESM with Node <=16.13.1 cannot be unloaded, we are using separate test files for testing log4js
     * because
     */
    test('Logger json to stdout', async () => {

        //given
        const log4jsConfigJs= new Log4jsConfigJs()
        log4jsConfigJs._log4jsConfig.categories.default.appenders.push("fluentbit");
        log4jsConfigJs._log4jsConfig.appenders.fluentbit = {
            type: 'stdout',
            layout: { type: 'json' },
        };

        process.env.ENV = "test"
        process.env.IP = "127.0.0.1"

        let messagesCount = 0
        jest.spyOn(process.stdout, 'write').mockImplementation(function () {
            return true;
        });

        const AndromedaLogger = await import ("./andromeda-logger.js")
        const logger= new AndromedaLogger.AndromedaLogger("test logger",log4jsConfigJs.getConfig());

        expect(logger.child()).not.toBeNull();


        // when
        logger.info("test")
        messagesCount+=1;
        // then each tome two messages are logged the stdout (standard stdout + json message )
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.error("error message")
        messagesCount+=1;

        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.error({})
        messagesCount+=1;
        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.warn("warn")
        messagesCount+=1;
        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.trace("trace")
        messagesCount+=1;
        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.fatal("fatal")
        messagesCount+=1;
        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)
        // when
        logger.debug("debug")
        messagesCount+=1;
        //then
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2)

        // given another config and another instance of AndromedaLogger
        const log4jsConfigJs2= new Log4jsConfigJs()
        const AndromedaLogger2 = await import ("./andromeda-logger.js")
        const logger2= new AndromedaLogger2.AndromedaLogger(undefined,log4jsConfigJs2.getConfig());
        // when
        logger2.info("test")
        // then make sure this time we write once to the stdout
        expect(process.stdout.write).toBeCalledTimes(messagesCount*2+1)

    })




})
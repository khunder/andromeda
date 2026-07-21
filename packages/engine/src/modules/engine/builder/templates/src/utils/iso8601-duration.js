import {AndromedaLogger} from "../config/andromeda-logger.js";

const Logger = new AndromedaLogger();

// PnYnMnDTnHnMnS - years/months are calendar-relative and ambiguous in
// isolation, so they're resolved as fixed averages (365.25 / 30.44 days)
// rather than against a specific calendar date, same simplification most
// duration libraries make.
const ISO8601_DURATION_PATTERN = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 30.44 * MS_PER_DAY;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

export class Iso8601Duration {

    // returns milliseconds, or null if the string isn't a valid ISO 8601
    // duration (e.g. a <bpmn:timeDuration> body that was typed by hand)
    static toMilliseconds(duration) {
        if (typeof duration !== 'string') {
            return null;
        }
        const match = ISO8601_DURATION_PATTERN.exec(duration.trim());
        if (!match || duration.trim() === 'P') {
            Logger.error(`invalid ISO 8601 duration: "${duration}"`);
            return null;
        }
        const [, years, months, weeks, days, hours, minutes, seconds] = match;
        return (
            (Number(years) || 0) * MS_PER_YEAR +
            (Number(months) || 0) * MS_PER_MONTH +
            (Number(weeks) || 0) * MS_PER_WEEK +
            (Number(days) || 0) * MS_PER_DAY +
            (Number(hours) || 0) * MS_PER_HOUR +
            (Number(minutes) || 0) * MS_PER_MINUTE +
            (Number(seconds) || 0) * MS_PER_SECOND
        );
    }
}

export default Iso8601Duration;

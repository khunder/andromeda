/**
 * Base class for timer jobs, kept intentionally tiny: this container never
 * runs more than one job class (TimerCatchResumeJob) and always runs it
 * inline against the TimerJob queue in TimerJobRepository (see
 * timer.service.js), so there's no dynamic script resolution, no worker
 * pool, no forking to support - just the `run()` contract and a `complete()`
 * convenience wrapper for readability at call sites.
 */
export class Job {

    /**
     * Marks the job's outcome. Purely a naming convenience - `run()`'s
     * return value is only ever logged, never inspected by the dispatcher -
     * kept so subclasses read the same way whether or not they're wrapped by
     * a fuller job framework.
     * @param {*} result
     * @returns {*}
     */
    complete(result) {
        return result;
    }

    /**
     * The job's logic. Must be implemented by subclasses. Throwing schedules
     * a retry (see TimerService.runJob() in timer.service.js).
     */
    async run() {
        throw new Error('run() must be implemented by subclass');
    }
}

export default Job;

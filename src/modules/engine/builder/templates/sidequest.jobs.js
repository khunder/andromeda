// Manual job resolution registry for Sidequest (see TimerService.init(),
// `manualJobResolution: true`) - lists every Job class this container can
// run. Explicit rather than relying on Sidequest's own stack-trace-based
// auto-resolution, which assumes a conventional flat project layout that
// doesn't match this generated container's directory structure.
export {TimerCatchResumeJob} from "./src/modules/timer/timer-catch-resume.job.js";

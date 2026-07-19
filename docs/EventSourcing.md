Event sourcing
=

You deploy a workflow (say, container "wer"). Someone calls POST http://host:port/start on it. That's a process instance being born , one specific run of your BPMN diagram.

- ProcessInstance collection = the table that answers "is run #wer-123 still active, or done?"
- FlowEvent collection = the table that answers "which step of run #wer-123 just fired?" (a script task starting, closing...)
- EventStore collection = the permanent diary of literally every "a process instance was created," "a process instance closed," "a flow event happened," across every run, of every workflow, in this whole engine , forever.
- A snapshot = a periodic photo of the ProcessInstance/FlowEvent tables, so if you ever need to rebuild them, you don't have to replay the diary from day one.

Real call chain, start to finish

1. Someone POSTs to /start → the container's generated controller calls {{ProcessDef}}ProcessInstanceService.createInstance().
2. That calls:
   PersistenceGateway.newProcessInstance({
   processInstanceId, deploymentId, processDef, containerId
   })
3. Which builds an event object and calls EventStore.apply(event). Inside:
- Stamp a number on it: streamId: "PROCESS_INSTANCE", streamPosition: 37 (say this is the 38th process instance ever created, across the whole engine).
- Update the ProcessInstance table right now: insert {_id: processInstanceId, deploymentId: "wer", processDef: "...", status: 0, lock: {...}}.
- Write the event itself into EventStore (permanent).
- Check: was that position 99, 199, 299...? If not , nothing else happens.

So every single /start call, every script task starting/closing, every process instance closing , all of it funnels through this same diary, EventStore, position by position, no matter which of your deployed workflows or which container it came from.

The 100th one , automatic snapshot

Say the 100th process-instance-created event just landed (streamPosition: 99). Now:
maybeSnapshot(event)
→ processInstanceProjection.captureState() // dump the whole ProcessInstance table
→ SnapshotRepository.saveSnapshot("PROCESS_INSTANCE", 99, state)
This saves: "here's every process instance that exists, as of the 100th one ever created." Whoever made the 100th /start call waits a bit longer while this happens , it's not a background job, it rides along on that request.

Disaster: someone wipes the ProcessInstance table

Now Galaxy, or your /api dashboard, or anything querying "is run #wer-123 still active" gets nothing back , the table's empty. But EventStore still has the full diary, say 250 events deep now.

Rebuilding it: replay

PersistenceGateway.replayStream("PROCESS_INSTANCE")
1. Find the newest snapshot → the one at position 99.
2. restoreState(snapshot.state) → wipes ProcessInstance (empty) and reloads it to exactly what it looked like right after process instance #100 was created.
3. Fetch events 100 through 250 from EventStore (getEvents("PROCESS_INSTANCE", 100)).
4. Re-run each one through the projection only (dispatch) , re-creating/re-closing process instances #101 through #251 in the table, without writing them into EventStore again (they're already there).

End result: ProcessInstance is back to correct, using 1 saved photo + 150 replayed events, instead of replaying all 250 process instances from event #1.

Doing it on purpose, not waiting for #100

PersistenceGateway.snapshotStream("PROCESS_INSTANCE")
Takes the photo right now, whatever position the diary is currently at , no need to wait for a multiple of 100. Nothing in the codebase calls this automatically yet; it's there for you to trigger manually (e.g. before a risky deploy).

The key thing to notice

FlowEvent and ProcessInstance are completely separate diaries ("FLOW_EVENT" and "PROCESS_INSTANCE" streams) with their own independent position counters and their own snapshots. Replaying/snapshotting one never touches the other.

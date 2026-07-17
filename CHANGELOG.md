# Changelog

## 2026-07-18

- Fixed `process-instance.int.test.js`: tests were calling `EventStore.apply` without the streams ever being registered/initialized, causing the "cannot find an aggregator for the streamId" failures. Added `beforeAll`/`afterAll` hooks around `PersistenceModule.init()`/`dispose()`, and switched the hardcoded `"PROCESS_INSTANCE"`/`"CREATE_PROCESS_INSTANCE"` strings and `streamPosition: 0` literals to the `StreamIds`/`EventTypes` constants (positions are now assigned by the stream, matching the persistence-gateway fix from 2026-07-17).
- Fixed an incorrect assertion message in `transcode-variable-encoder.ava.test.js`: the expected error text for an invalid boolean transcode now includes the empty-string case (`possible values [true|false|""]`).
- Minor cleanup in `src/config/constants.js`: removed a stray blank line and added missing semicolons.
- Added `docs/EventSourcing.md`: a walkthrough of the event-sourcing/replay/snapshot mechanism added on 2026-07-17 — what a process instance, flow event, and snapshot are in this project's terms, the real call chain from `POST /start` down to `EventStore.apply`, when automatic snapshots fire, and how `PersistenceGateway.replayStream` rebuilds a read model from a snapshot plus the events after it.

## 2026-07-17

- Added event replay and snapshots to the persistence module, making the event store a real source of truth: a new `ReplayService` rebuilds a stream's read model by restoring its latest snapshot (or resetting when none exists) and re-dispatching only the events logged after it, without re-persisting them. Snapshots are read-model state dumps stored in a new `Snapshot` collection keyed by `(streamId, streamPosition)`, written automatically every 100 events (after the event is safely in the log) or on demand. Everything is exposed through `PersistenceGateway.replayStream/replayAll/snapshotStream`, keeping the gateway the persistence layer's only external entry point.
- Engine restarts no longer corrupt event numbering: `PersistenceGateway.init()` now seeds each stream's in-memory position counter from the highest persisted position in the log, instead of restarting at 0 and colliding with the unique `(streamId, streamPosition)` index.
- Fixed status-transition writes (`complete`/`removeLock` on process instances, `close`/`abort`/`fail` on flow events) creating partial, unvalidated documents when the target record didn't exist — they now use a non-upserting update.
- Fixed event `streamPosition` handling: emitted events no longer hardcode position 0 (the stream assigns it), and a legitimate position 0 supplied by a caller is no longer silently overwritten.
- Event timestamps are now ISO-8601 (`toISOString`) instead of locale strings, so they sort correctly and keep millisecond precision.
- Fixed Mongoose `_id` defaults on the process-instance and flow-event models generating the same UUID for every document (`default: v4()` was evaluated once at schema definition).
- Performance: Ajv event and payload schemas are now compiled once and cached instead of recompiled on every event.
- Replaced deprecated Mongoose calls in the base repository (`count`→`countDocuments`, `remove`→`deleteOne`/`deleteMany`), unblocking future Mongoose upgrades.
- Fixed the unit-test fake repository matching a nonexistent `id` field (documents are stored under `_id`) and its `findOne` throwing instead of searching.

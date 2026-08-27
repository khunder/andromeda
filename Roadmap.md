Road Map

- add version to xml, at the same level as process tag, reflect the change in the designer
- by default the version is 1.0.0
- the version is concat to the deployment_id, 1.0.0 becomes 1_0_0 for the folder name
- add the possibility to deploy with the same deployment id with different versions,
- generated the version and add it to container service
- also in the container service , add the list of proces defs used during the generation of the process, 
- add a route to list the container properties, like, id, version, process defs

- run two containers in the same process
- support signal events (notify same process catch event)
- support signal events (notify another process catch event)

- define role for human tasks
- Support JWT authentication for container http endpoints like human tasks and catch events

- support correlation in catch events
- support scheduled task and cron start
- deploy multiple processes in the same container using the same deploymentId
- add container dependencies dynamically exp: sql.js vs mongoose
- support ingesting big files via Object storage driver



DONE
==
- add version to xml, at the same level as definition tag, reflect the change in the designer
- by default the version is 1.0.0
- the version is concat to the deployment_id, 1.0.0 becomes 1_0_0 for the folder name
- add the possibility to deploy with the same deployment id with different versions,
- generated the version and add it to container service
- also in the container service , add the list of proces defs used during the generation of the process,
- add a route to list the container properties, like, id, version, process defs
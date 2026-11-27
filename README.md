# EPISERVE Platform Status

**Live page: https://status.episerve.zib.de/**

Static status page for the EPISERVE platform, served with GitHub Pages.

## What the page shows

- Overall banner: "All systems operational", "Partial outage" (a service or
  flow is not OK), "Critical alerts active" (everything is OK but critical
  alerts are firing; warnings do not change the banner) or, when the data is
  older than 2.5 hours, "Status data is outdated". All but the first are shown
  in red. If the data cannot be loaded: "Status data unavailable".
- One line with the number of active warning and critical alerts
  (counts only, no alert details).
- Public services (website, data hub, API server, DOIP server) with a
  30-day bar, one square per day. The DOIP server counts as up only when both
  its website and a DOIP hello on TCP port 3567 answer.
- Workflow Server: "All components" (server, worker, database, scheduler;
  up only when all are up) and "All flows" (up only when every scheduled flow
  ran successfully, on time and has a next run), each with a 30-day bar. Below
  "All flows": how many last runs were OK and how many flows are scheduled,
  plus one line per flow with an error.
- Specs: for each spec (`model-card`, `fdo`) the release and schema versions
  on GitHub, in the data hub sync check and in the API server, marked as OK, behind,
  invalid or unknown.

Times are shown in the viewer's local time zone; hover for UTC.

## Data

The page reads `status.json` from the `data` branch of this repository.
The file is written hourly by a CronJob running inside the cluster
(`episerve-k8s/apps/status-page`). The page marks the data as outdated
after 2.5 hours and re-fetches every 10 minutes. If the CronJob cannot read the
previous file (other than "not found"), it publishes nothing, so that the
history is not overwritten.

## Development

No build step and no dependencies. `render.js` holds the pure logic,
`index.js` the DOM code.

```
node --test            # run the tests in tests/
python3 -m http.server # then open index.html?src=sample.json
```

`?src=` accepts only a relative path in the same directory tree
(for example `sample.json`); anything else is ignored.
`sample.json` is a local copy of a status file and is not committed.

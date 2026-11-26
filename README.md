# EPISERVE Platform Status

**Live page: https://the-episerve-consortium.github.io/episerve-status/**

Static status page for the EPISERVE platform, served with GitHub Pages.

## What the page shows

- Overall banner: "All systems operational", "Partial outage" or, when the
  data is older than 2.5 hours, "Status data is outdated" (shown in red).
  If the data cannot be loaded: "Status data unavailable".
- One line with the number of active warning and critical alerts
  (counts only, no alert details).
- Public services (website, data hub, API server, DOIP server) with a
  30-day bar, one square per day.
- Prefect: server, worker and database as dots, the scheduler with a
  30-day bar.
- Prefect flows: last run, next run and status. The dataset download flows
  are collapsed into one expandable row.
- Platform pods as dots.

Times are shown in the viewer's local time zone; hover for UTC.

## Data

The page reads `status.json` from the `data` branch of this repository.
The file is written hourly by a CronJob running inside the cluster
(`episerve-k8s/apps/status-page`). The page marks the data as outdated
after 2.5 hours and re-fetches every 10 minutes.

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

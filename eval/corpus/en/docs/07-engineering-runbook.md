# Engineering On-Call Runbook

Owner: David Park, Chief Technology Officer. On-call program lead: Ethan Brooks.

## Service levels

- Signal ingestion availability target: 99.95% per calendar month.
- Signal ingestion p95 latency target: under 800 milliseconds.
- Alert delivery p95 latency target: under 5 seconds.
- Status page: status.northwindlabs.com.

## Severity levels

| Severity | Definition | Response |
| --- | --- | --- |
| SEV1 | Customer-facing outage or data loss | Page immediately; acknowledge within 15 minutes |
| SEV2 | Major degradation with a workaround | Page on-call; acknowledge within 30 minutes |
| SEV3 | Limited impact or single tenant | Ticket during business hours |
| SEV4 | Cosmetic or documentation issue | Normal backlog |

## On-call expectations

1. Acknowledge PagerDuty pages within 15 minutes.
2. Open an incident channel in Slack named `#incident-<date>` for SEV1 and SEV2 events.
3. Assign an incident commander from the on-call rotation.
4. Post a customer-facing update on the status page within 30 minutes of a SEV1.

## Rollback and change management

- All services deploy behind feature flags; the default rollback time is 10 minutes.
- Blue/green deployment is required for the ingestion pipeline.
- A change freeze runs from December 20 through January 2.
- Database migrations must be backward compatible for one release.

## Postmortems

Write a blameless postmortem within five business days for every SEV1 and SEV2. Include the
timeline, customer impact, root cause, and follow-up owners. David Park reviews all SEV1
postmortems.

## Escalation

- Primary: on-call engineer via PagerDuty.
- Secondary: Ethan Brooks, on-call program lead.
- Executive: David Park, Chief Technology Officer.

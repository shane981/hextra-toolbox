# Toolbox talk JSON schema (v1)

Each weekly talk is one JSON file: `talks/<id>.json`. `talks/index.json` is **generated** by
`scripts/publish.sh` (newest first). Never edit `index.json` by hand.

- Machine-readable schema: [`schema/talk.schema.json`](schema/talk.schema.json) (JSON Schema 2020-12)
- Validator used by publish (no dependencies): `node scripts/validate.mjs path/to/talk.json`
- Example: [`talks/2026-11-09.json`](talks/2026-11-09.json)
- Text is plain text (no HTML/Markdown). Use Australian English. Dates are Australia/Sydney.

## Fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | `YYYY-MM-DD`, or `YYYY-MM-DD-suffix` (lowercase a–z, 0–9, hyphens) for a second talk on the same date. Must start with `date`. The file name must be `<id>.json`. |
| `title` | string | yes | 5–140 characters. |
| `date` | string | yes | Real calendar date, `YYYY-MM-DD` (the day the talk is delivered/published). Sort order is by `date`, then `id`. |
| `week_label` | string | yes | 3–80 chars, e.g. `Week of Tuesday 6 October 2026`. |
| `sources_reviewed` | array of objects | yes | At least 1. Each: `name` (publisher, e.g. `SafeWork NSW`), `title`, `url` (absolute http/https), `date` (`YYYY-MM-DD`, `YYYY-MM`, `YYYY` or `undated`). Optional: `type` (`regulator` \| `government` \| `industry` \| `other` – industry items are labelled "industry context" in the app), `accessed` (`YYYY-MM-DD`), `note` (≤400 chars – what was taken from the source). Only list sources that were actually read. |
| `key_risk` | string | yes | 20–1200 chars. The one main risk for the week. |
| `drivers_need_to_know` | array of strings | yes | At least 1 item, each 3–1200 chars. Shown as "What workers need to know" (field name kept from the original schema). Start each item with the trades it applies to in brackets, e.g. `[Electrical, Solar]`. |
| `supervisors_must_check` | array of strings | yes | At least 1 item. |
| `discussion_questions` | array of strings | yes | **Exactly 5.** |
| `practical_checklist` | array of strings | yes | At least 1 item. Shown as tick boxes (not saved). |
| `required_records` | array of strings **or** a string | yes | List preferred. |
| `follow_up_actions` | array | yes | At least 1. Each item is either a string or `{ "action": string, "owner"?: string (≤80), "due"?: string (≤40) }`. Supervisors tick these off in the app (saved on the device). |
| `schema_version` | number | no | `1` if present. |
| `summary` | string | no | ≤800 chars. Intro paragraph under the title. |
| `prepared_by` | string | no | ≤120 chars. |

No other top-level fields are allowed (the validator rejects unknown fields to catch typos).

## Skeleton

```json
{
  "schema_version": 1,
  "id": "2026-10-13",
  "title": "…",
  "date": "2026-10-13",
  "week_label": "Week of Tuesday 13 October 2026",
  "summary": "…",
  "key_risk": "…",
  "drivers_need_to_know": ["…"],
  "supervisors_must_check": ["…"],
  "discussion_questions": ["…", "…", "…", "…", "…"],
  "practical_checklist": ["…"],
  "required_records": ["…"],
  "follow_up_actions": [{ "action": "…", "owner": "Supervisor", "due": "Friday 16 October 2026" }],
  "sources_reviewed": [
    { "name": "NHVR", "type": "regulator", "title": "…", "url": "https://www.nhvr.gov.au/…", "date": "2026-10-01", "accessed": "2026-10-13", "note": "…" }
  ]
}
```

## Generated `talks/index.json`

```json
{
  "schema_version": 1,
  "generated_at": "2026-10-06T03:48:32.346Z",
  "latest": "2026-10-06",
  "count": 1,
  "talks": [
    { "id": "2026-10-06", "title": "…", "date": "2026-10-06", "week_label": "…", "file": "2026-10-06.json" }
  ]
}
```

The app always opens `latest` as "This week". The service worker fetches `talks/*` and `version.json`
network-first (6 s timeout, then cached copy), so a new week appears as soon as the phone has signal.

## Sign-on CSV export columns

`talk_id, talk_title, talk_date, week_label, worker_name, role, site_job, attended_and_understood,
signed_at_sydney, signed_at_utc_iso, device_id, signon_id, signature_png_data_url`

UTF-8 with BOM (opens cleanly in Excel). `signature_png_data_url` is a `data:image/png;base64,…` image
of the drawn signature (paste into a browser address bar to view it). Cells starting with `= + - @` are
prefixed with `'` to stop spreadsheet formula injection.

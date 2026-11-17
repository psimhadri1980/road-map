# Data model: Live events

No stored data. A live event (JSON, one per SSE `data:` line):

| Field      | Meaning                                  |
| ---------- | ---------------------------------------- |
| `kind`     | one of the kinds in research R5          |
| `proposal` | proposal id, when the event is about one |
| `version`  | the version number, for `currentChanged` |
| `baseline` | the baseline id, for `baselineSaved`     |
| `actor`    | readable name of who did it              |
| `at`       | ISO time                                 |

An in-memory stream is `(slug, subject, emitter, expiresAt)`; lost on restart.

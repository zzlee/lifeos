## $(date +%Y-%m-%d) - Combine DB lookups with INNER JOIN
**Learning:** Sequential DB queries (e.g. fetching user_id from an API key then fetching the user) introduce unnecessary round trips and latency.
**Action:** Always consider using `INNER JOIN` or single aggregate queries instead of executing sequential `DB.prepare` calls to minimize HTTP network round-trips.

# Local Ports

This project avoids ports already used by your other local agent stack.

## Reserved Elsewhere

Already in use on your machine:
- `3000`
- `8000`
- `5432`

## Remotion Agent Ports

- Web UI: `3101`

## Notes

- The worker currently does not expose a public HTTP port.
- If a database or queue is added later, choose ports that do not conflict with the reserved set above.

import json
import os
from pathlib import Path
import shlex
import sys


def _fail(message: str) -> None:
    sys.stderr.write(message + "\n")
    sys.exit(1)


try:
    from openshell import SandboxClient, SandboxSession
except Exception as exc:  # pragma: no cover
    _fail(f"openshell import failed: {exc}")


def _client():
    return SandboxClient.from_active_cluster()


def _session_for_name(name: str) -> SandboxSession:
    client = _client()
    ref = client.get(name)
    return SandboxSession(client, ref)


def _workspace_path(root_path: str, target_path: str) -> str:
    if target_path.startswith("/"):
        normalized = os.path.normpath(target_path)
    else:
        normalized = os.path.normpath(os.path.join(root_path, target_path))

    root_normalized = os.path.normpath(root_path)
    if normalized != root_normalized and not normalized.startswith(root_normalized + os.sep):
        _fail(f"path escapes workspace: {target_path}")
    return normalized


def _create_workspace(payload: dict) -> dict:
    job_id = payload["jobId"]
    requested_name = payload.get("sandboxName") or os.getenv("OPENSHELL_SANDBOX_NAME")

    client = _client()
    if requested_name:
        ref = client.get(requested_name)
        ref = client.wait_ready(ref.name)
        sandbox_name = ref.name
    else:
        ref = client.create()
        ref = client.wait_ready(ref.name)
        sandbox_name = ref.name

    session = SandboxSession(client, ref)
    session.exec(["bash", "-lc", "mkdir -p /sandbox/workspace /sandbox/memory"])

    return {
        "id": ref.name,
        "rootPath": "/sandbox/workspace",
        "sandboxName": ref.name,
    }


def _run_command(payload: dict) -> dict:
    session = _session_for_name(payload["sandboxName"])
    root_path = payload["rootPath"]
    command = payload["command"]
    timeout_seconds = max(1, int(payload.get("timeoutSeconds", 1800)))
    result = session.exec(
        ["bash", "-lc", f"cd {shlex.quote(root_path)} && {command}"],
        timeout_seconds=timeout_seconds,
    )
    return {
        "exitCode": result.exit_code,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _read_file(payload: dict) -> dict:
    session = _session_for_name(payload["sandboxName"])
    path = _workspace_path("/sandbox/workspace", payload["path"])
    result = session.exec(["bash", "-lc", f"cat {shlex.quote(path)}"])
    if result.exit_code != 0:
        _fail(result.stderr or f"failed to read {path}")
    return {"content": result.stdout}


def _write_file(payload: dict) -> dict:
    session = _session_for_name(payload["sandboxName"])
    path = _workspace_path("/sandbox/workspace", payload["path"])
    content = payload["content"].encode("utf-8")
    parent = shlex.quote(os.path.dirname(path) or ".")
    dest = shlex.quote(path)
    result = session.exec(
        ["bash", "-lc", f"mkdir -p {parent} && cat > {dest}"],
        stdin=content,
    )
    if result.exit_code != 0:
        _fail(result.stderr or f"failed to write {path}")
    return {"ok": True}


def _sync_to_workspace(payload: dict) -> dict:
    session = _session_for_name(payload["sandboxName"])
    root_path = payload["rootPath"]
    local_path = Path(payload["localPath"]).expanduser().resolve()

    if not local_path.exists():
        _fail(f"local path does not exist: {local_path}")

    if local_path.is_file():
        files = [local_path]
        base_dir = local_path.parent
    else:
        files = [
            file_path
            for file_path in local_path.rglob("*")
            if file_path.is_file() and not any(
                part in {".git", "node_modules", ".next", "dist"} for part in file_path.parts
            )
        ]
        base_dir = local_path

    max_file_bytes = int(payload.get("maxFileBytes", 900_000))
    uploaded = 0
    skipped = 0
    for file_path in files:
        size = file_path.stat().st_size
        if size > max_file_bytes:
            skipped += 1
            continue
        relative_path = file_path.relative_to(base_dir).as_posix()
        destination = _workspace_path(root_path, relative_path)
        parent = shlex.quote(os.path.dirname(destination) or ".")
        dest = shlex.quote(destination)
        result = session.exec(
            ["bash", "-lc", f"mkdir -p {parent} && cat > {dest}"],
            stdin=file_path.read_bytes(),
        )
        if result.exit_code != 0:
            _fail(result.stderr or f"failed to sync {file_path}")
        uploaded += 1

    return {"ok": True, "filesUploaded": uploaded, "filesSkipped": skipped}


def _cleanup_workspace(payload: dict) -> dict:
    sandbox_name = payload["sandboxName"]
    if os.getenv("OPENSHELL_SANDBOX_NAME"):
        return {"ok": True, "reused": True}
    client = _client()
    client.delete(sandbox_name)
    return {"ok": True, "reused": False}


def main() -> None:
    if len(sys.argv) < 2:
        _fail("missing action")

    action = sys.argv[1]
    payload = json.loads(sys.stdin.read() or "{}")

    handlers = {
        "create_workspace": _create_workspace,
        "run_command": _run_command,
        "sync_to_workspace": _sync_to_workspace,
        "read_file": _read_file,
        "write_file": _write_file,
        "cleanup_workspace": _cleanup_workspace,
    }

    if action not in handlers:
        _fail(f"unknown action: {action}")

    result = handlers[action](payload)
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()

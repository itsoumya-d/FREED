#!/usr/bin/env python3
"""Query the Appllama MCP (https://mcp.appllama.io/mcp) and save raw results.

Uses the OAuth session already cached by mcp-remote in ~/.mcp-auth, so it never
prints or stores the access token. Each non-free call spends one Appllama credit
(get_credits is free). Results are written to the given --out directory so the
durable screen ids and metrics survive after the media links expire.
"""

import argparse
import glob
import json
import os
import sys
import urllib.error
import urllib.request

MCP_URL = "https://mcp.appllama.io/mcp"
TOKEN_GLOB = os.path.expanduser("~/.mcp-auth/mcp-remote-v1/*_tokens.json")


def load_token():
    for path in sorted(glob.glob(TOKEN_GLOB)):
        try:
            data = json.load(open(path))
        except Exception:
            continue
        token = data.get("access_token")
        if token and data.get("scope") == "appllama":
            return token
    raise SystemExit("No cached Appllama OAuth token found. Run: npx -y mcp-remote https://mcp.appllama.io/mcp")


class Client:
    def __init__(self, token):
        self.token = token
        self.session_id = None
        self._rpc(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "freed-research", "version": "1.0"},
                },
            }
        )
        self._rpc({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self._id = 1

    def _headers(self):
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": "Bearer " + self.token,
            "MCP-Protocol-Version": "2025-06-18",
        }
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        return headers

    def _post(self, body):
        request = urllib.request.Request(
            MCP_URL, data=json.dumps(body).encode(), headers=self._headers(), method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                self.session_id = response.headers.get("mcp-session-id") or self.session_id
                return response.headers.get("content-type", ""), response.read().decode()
        except urllib.error.HTTPError as error:
            raise SystemExit(f"MCP HTTP {error.code}: {error.read().decode()[:400]}")

    def _rpc(self, body):
        content_type, raw = self._post(body)
        if "text/event-stream" in content_type:
            messages = []
            for line in raw.splitlines():
                if line.startswith("data:"):
                    try:
                        messages.append(json.loads(line[5:].strip()))
                    except Exception:
                        pass
            return messages
        try:
            return [json.loads(raw)]
        except Exception:
            return [{"raw": raw[:400]}]

    def call_tool(self, name, arguments):
        self._id += 1
        messages = self._rpc(
            {
                "jsonrpc": "2.0",
                "id": self._id,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments},
            }
        )
        for message in messages:
            if isinstance(message, dict) and "result" in message:
                content = message["result"].get("content") or []
                texts = [part.get("text", "") for part in content if part.get("type") == "text"]
                joined = "\n".join(texts)
                try:
                    return json.loads(joined)
                except Exception:
                    return {"text": joined}
            if isinstance(message, dict) and "error" in message:
                return {"error": message["error"]}
        return {"error": "no result"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, help="directory for raw JSON results")
    parser.add_argument(
        "--calls",
        required=True,
        help='JSON array: [{"name":"search_apps","args":{...},"file":"01-search-apps.json"}]',
    )
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    calls = json.loads(args.calls)
    client = Client(load_token())

    for call in calls:
        result = client.call_tool(call["name"], call.get("args", {}))
        path = os.path.join(args.out, call["file"])
        with open(path, "w") as handle:
            json.dump(result, handle, indent=2)
        summary = json.dumps(result)[:220].replace("\n", " ")
        print(f"{call['name']} -> {call['file']}: {summary}")


if __name__ == "__main__":
    sys.exit(main())

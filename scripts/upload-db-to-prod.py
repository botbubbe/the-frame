#!/usr/bin/env python3
"""Upload local DB to production via chunked REST API."""
import base64
import json
import os
import sys
import urllib.request

DB_PATH = os.path.expanduser("~/Dropbox/Obsidian/jaxy/the-frame/app/data/the-frame.db")
API_URL = "https://the-frame-production.up.railway.app/api/admin/restore-db"
ADMIN_KEY = "jaxy2026"
CHUNK_SIZE = 2 * 1024 * 1024  # 2MB chunks

def api_call(data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(API_URL, data=body, headers={
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_KEY,
    })
    resp = urllib.request.urlopen(req, timeout=60)
    return json.loads(resp.read())

def main():
    file_size = os.path.getsize(DB_PATH)
    print(f"DB: {file_size} bytes ({file_size/1024/1024:.1f} MB)")
    
    # Start
    result = api_call({"action": "start"})
    print(f"Start: {result}")
    
    # Upload chunks
    with open(DB_PATH, "rb") as f:
        chunk_num = 0
        uploaded = 0
        while True:
            data = f.read(CHUNK_SIZE)
            if not data:
                break
            chunk_num += 1
            b64 = base64.b64encode(data).decode()
            result = api_call({"action": "chunk", "data": b64, "chunk": chunk_num})
            uploaded += len(data)
            pct = uploaded / file_size * 100
            print(f"  Chunk {chunk_num}: {uploaded}/{file_size} ({pct:.0f}%) → server size: {result.get('size', '?')}")
    
    # Finish
    result = api_call({"action": "finish"})
    print(f"Finish: {result}")
    print("Done! Restart the Railway service to pick up new DB.")

if __name__ == "__main__":
    main()

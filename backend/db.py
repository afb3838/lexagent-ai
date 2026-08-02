import os
from typing import Any, Dict, List, Optional

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

REST_BASE = f"{SUPABASE_URL}/rest/v1"
STORAGE_BASE = f"{SUPABASE_URL}/storage/v1"

_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}


def _require_config():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sunucuda tanimli degil.")


async def select(table: str, filters: Optional[Dict[str, str]] = None, order: Optional[str] = None) -> List[dict]:
    """filters degerleri PostgREST operator sozdizimiyle verilir, orn: {"id": "eq.<uuid>"}"""
    _require_config()
    params = dict(filters or {})
    params["select"] = "*"
    if order:
        params["order"] = order
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{REST_BASE}/{table}", headers=_HEADERS, params=params)
    resp.raise_for_status()
    return resp.json()


async def select_one(table: str, filters: Dict[str, str]) -> Optional[dict]:
    rows = await select(table, filters)
    return rows[0] if rows else None


async def insert(table: str, row: Dict[str, Any]) -> dict:
    _require_config()
    headers = {**_HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{REST_BASE}/{table}", headers=headers, json=row)
    resp.raise_for_status()
    return resp.json()[0]


async def patch(table: str, filters: Dict[str, str], fields: Dict[str, Any]) -> List[dict]:
    _require_config()
    headers = {**_HEADERS, "Content-Type": "application/json", "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.patch(f"{REST_BASE}/{table}", headers=headers, params=filters, json=fields)
    resp.raise_for_status()
    return resp.json()


async def upload_file(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Storage'a yukler, storage_path'i (bucket/path) dondurur."""
    _require_config()
    headers = {**_HEADERS, "Content-Type": content_type or "application/octet-stream"}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{STORAGE_BASE}/object/{bucket}/{path}", headers=headers, content=data)
    resp.raise_for_status()
    return f"{bucket}/{path}"

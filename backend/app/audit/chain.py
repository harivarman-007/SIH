import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def compute_entry_hash(
    prev_hash: str,
    actor_id: Optional[UUID],
    action: str,
    payload: Dict[str, Any],
    ts_iso: str,
) -> str:
    raw = json.dumps(
        {
            "prev": prev_hash,
            "actor": str(actor_id) if actor_id else None,
            "action": action,
            "payload": payload,
            "ts": ts_iso,
        },
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def append_audit_entry(
    db: AsyncSession,
    action: str,
    payload: Dict[str, Any],
    actor_id: Optional[UUID] = None,
) -> AuditLog:
    # Fetch the most recent audit entry with row lock to serialize concurrent appends and prevent chain forks
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(1).with_for_update()
    result = await db.execute(stmt)
    latest_entry = result.scalar_one_or_none()

    prev_hash = latest_entry.entry_hash if latest_entry else "GENESIS"
    now_utc = datetime.now(timezone.utc)
    ts_iso = now_utc.isoformat()

    entry_hash = compute_entry_hash(
        prev_hash=prev_hash,
        actor_id=actor_id,
        action=action,
        payload=payload,
        ts_iso=ts_iso,
    )

    new_log = AuditLog(
        entry_hash=entry_hash,
        prev_hash=prev_hash,
        actor_id=actor_id,
        action=action,
        payload=payload,
        ts=now_utc,
    )
    db.add(new_log)
    await db.flush()
    return new_log


async def verify_audit_chain(db: AsyncSession) -> Tuple[bool, int, Optional[int], str]:
    """
    Verifies the entire append-only hash-chain from start to finish.
    Returns: (is_valid, total_checked, broken_at_id, message)
    """
    stmt = select(AuditLog).order_by(AuditLog.id.asc())
    result = await db.execute(stmt)
    entries = result.scalars().all()

    if not entries:
        return True, 0, None, "Audit chain is empty"

    expected_prev = "GENESIS"
    for idx, entry in enumerate(entries):
        # 1. Verify prev_hash matches prior entry's hash
        if entry.prev_hash != expected_prev:
            return (
                False,
                idx,
                entry.id,
                f"Chain broken at ID {entry.id}: expected prev_hash '{expected_prev}', found '{entry.prev_hash}'",
            )

        # 2. Verify entry_hash matches recomputed hash
        ts_iso = entry.ts.isoformat()
        computed_hash = compute_entry_hash(
            prev_hash=entry.prev_hash,
            actor_id=entry.actor_id,
            action=entry.action,
            payload=entry.payload,
            ts_iso=ts_iso,
        )

        if computed_hash != entry.entry_hash:
            return (
                False,
                idx,
                entry.id,
                f"Chain tampered at ID {entry.id}: computed hash '{computed_hash}' does not match stored '{entry.entry_hash}'",
            )

        expected_prev = entry.entry_hash

    return True, len(entries), None, f"Hash-chain verified successfully across {len(entries)} records"

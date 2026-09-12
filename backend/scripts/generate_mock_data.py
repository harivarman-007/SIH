"""
generate_mock_data.py
Generates and seeds realistic synthetic data into the Intellifusion database.

Data generated:
  - 5 mine sites across major Indian coal belt regions
  - 3 zones per site (surface, underground A, underground B)
  - 1 regulator, 1 corporate manager, 5 mine officials, 10 inspectors, 5 contractors
  - 200 observations across a 90-day window with varied categories, risk levels, statuses
  - Intentionally overdue high-risk observations for escalation demo
  - Audit log entries for every observation creation and status change

Usage (run inside docker-compose backend container or locally with DB reachable):
    DATABASE_URL_SYNC=postgresql://intellifusion:intellifusion_dev@localhost:5432/intellifusion \
    python scripts/generate_mock_data.py
"""

import hashlib
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
import bcrypt

# ---------------------------------------------------------------------------
# DB connection
# ---------------------------------------------------------------------------
DB_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://intellifusion:intellifusion_dev@localhost:5432/intellifusion",
)

def get_conn():
    return psycopg2.connect(DB_URL)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
NOW = datetime.now(tz=timezone.utc)
rng = random.Random(42)  # deterministic seed for reproducibility


def uid():
    return str(uuid.uuid4())


def ts(days_ago: float, jitter_hours: float = 6) -> datetime:
    """Return a timestamp from `days_ago` days ago ± jitter."""
    offset = timedelta(days=days_ago, hours=rng.uniform(-jitter_hours, jitter_hours))
    return NOW - offset


def sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


SAFETY_KEYWORDS = [
    "roof fall", "gas leakage", "equipment malfunction", "fire hazard",
    "ventilation failure", "blast misfiring", "electrical fault",
    "unsafe scaffolding", "blocked emergency exit",
]
ENV_KEYWORDS = [
    "dust emission", "water contamination", "slurry overflow",
    "oil spill", "noise pollution", "land subsidence", "effluent discharge",
]
LABOUR_KEYWORDS = [
    "missing PPE", "overtime violation", "undocumented worker",
    "safety training not completed", "missing medical certificate",
    "unauthorised contractor worker", "rest period violation",
]

CATEGORIES = ["safety", "environment", "labour"]
RISK_FLAGS = ["low", "medium", "high"]
STATUSES = ["open", "in_progress", "closed", "escalated"]


def pick_description(category: str) -> str:
    if category == "safety":
        kw = rng.choice(SAFETY_KEYWORDS)
        return f"Observed {kw} in the zone during routine inspection. Immediate attention required."
    elif category == "environment":
        kw = rng.choice(ENV_KEYWORDS)
        return f"Noted {kw} near the extraction area. Samples may be needed for compliance record."
    else:
        kw = rng.choice(LABOUR_KEYWORDS)
        return f"Found instance of {kw} among crew members. Supervisor notified."


def edge_score_from_category(category: str, flag: str) -> float:
    base = {"low": 0.2, "medium": 0.55, "high": 0.85}[flag]
    noise = rng.uniform(-0.08, 0.08)
    return round(min(1.0, max(0.0, base + noise)), 3)


def make_edge_reasons(category: str, flag: str) -> dict:
    features = {
        "zone_risk_baseline": round(rng.uniform(0.2, 0.9), 3),
        "keyword_safety_flag": 1 if category == "safety" else 0,
        "keyword_env_flag": 1 if category == "environment" else 0,
        "keyword_labour_flag": 1 if category == "labour" else 0,
        "hour_of_day_normalised": round(rng.uniform(0, 1), 3),
        "inspector_historical_high_rate": round(rng.uniform(0.1, 0.6), 3),
        "days_since_last_zone_inspection": rng.randint(1, 30),
        "photo_attached": rng.randint(0, 1),
    }
    # Top contributors based on flag
    if flag == "high":
        features["zone_risk_baseline"] = round(rng.uniform(0.7, 0.95), 3)
        features["inspector_historical_high_rate"] = round(rng.uniform(0.4, 0.7), 3)
    return {"features": features, "top_contributors": sorted(features, key=lambda k: -abs(features[k]))[:3]}


def suggested_action(category: str, flag: str) -> str:
    actions = {
        ("safety", "high"): "Immediately evacuate zone and suspend operations. Notify Mine Manager and Safety Officer. File incident report within 2 hours.",
        ("safety", "medium"): "Cordon off affected area. Assign safety officer for investigation within 4 hours. Document findings.",
        ("safety", "low"): "Log for safety officer review at next shift briefing. Monitor for recurrence.",
        ("environment", "high"): "Halt extraction activity in zone. Notify Environmental Officer immediately. Initiate containment protocol.",
        ("environment", "medium"): "Increase monitoring frequency. File environmental observation report with site manager within 24 hours.",
        ("environment", "low"): "Record for monthly environmental compliance report. No immediate action required.",
        ("labour", "high"): "Suspend crew until compliance verified. Notify HR and DGMS. Issue formal written notice.",
        ("labour", "medium"): "Brief crew supervisor. Conduct spot compliance check. Update attendance/certification records.",
        ("labour", "low"): "Issue verbal reminder to crew. Record in shift log.",
    }
    return actions.get((category, flag), "Review observation with supervisor and take appropriate corrective action.")


# ---------------------------------------------------------------------------
# Audit log helpers
# ---------------------------------------------------------------------------
_audit_prev_hash = "GENESIS"

def append_audit(cur, actor_id, action, payload):
    global _audit_prev_hash
    ts_str = NOW.isoformat()
    raw = json.dumps({
        "prev": _audit_prev_hash,
        "actor": str(actor_id) if actor_id else None,
        "action": action,
        "payload": payload,
        "ts": ts_str,
    }, sort_keys=True)
    entry_hash = sha256(raw)
    cur.execute(
        """INSERT INTO audit_log (entry_hash, prev_hash, actor_id, action, payload, ts)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (entry_hash, _audit_prev_hash, str(actor_id) if actor_id else None,
         action, json.dumps(payload), NOW),
    )
    _audit_prev_hash = entry_hash


# ---------------------------------------------------------------------------
# Main seeding logic
# ---------------------------------------------------------------------------
def seed():
    conn = get_conn()
    cur = conn.cursor()

    print("Clearing existing data...")
    # Order matters — respect FK constraints
    for table in [
        "contractor_assignments",
        "corporate_mine_access",
        "ocr_review_queue",
        "audit_log",
        "observations",
        "users",
        "zones",
        "mine_sites",
    ]:
        cur.execute(f"TRUNCATE TABLE {table} CASCADE")

    # -----------------------------------------------------------------------
    # Mine sites (5 real Indian coal belt locations)
    # -----------------------------------------------------------------------
    mine_sites_data = [
        ("Jharia Coalfield Central", "Dhanbad, Jharkhand", 23.7957, 86.4304),
        ("Raniganj North Block", "Raniganj, West Bengal", 23.6169, 87.1275),
        ("Korba East Mine", "Korba, Chhattisgarh", 22.3595, 82.7501),
        ("Singrauli Opencast", "Singrauli, Madhya Pradesh", 24.1993, 82.6647),
        ("Talcher Phase II", "Talcher, Odisha", 20.9516, 85.2279),
    ]
    site_ids = []
    for name, loc, lat, lng in mine_sites_data:
        sid = uid()
        site_ids.append(sid)
        cur.execute(
            "INSERT INTO mine_sites (id, name, location_name, lat, lng) VALUES (%s, %s, %s, %s, %s)",
            (sid, name, loc, lat, lng),
        )
    print(f"Inserted {len(site_ids)} mine sites.")

    # -----------------------------------------------------------------------
    # Zones (3 per site)
    # -----------------------------------------------------------------------
    zone_ids_by_site = {}
    for sid in site_ids:
        zone_ids_by_site[sid] = []
        zone_defs = [
            ("Surface Processing Area", "surface", round(rng.uniform(0.2, 0.5), 2)),
            ("Underground Gallery A", "underground", round(rng.uniform(0.5, 0.8), 2)),
            ("Underground Gallery B", "underground", round(rng.uniform(0.55, 0.9), 2)),
        ]
        for zname, ztype, zbaseline in zone_defs:
            zid = uid()
            zone_ids_by_site[sid].append((zid, zbaseline))
            cur.execute(
                "INSERT INTO zones (id, mine_site_id, name, zone_type, risk_baseline) VALUES (%s, %s, %s, %s, %s)",
                (zid, sid, zname, ztype, zbaseline),
            )
    print("Inserted zones.")

    # -----------------------------------------------------------------------
    # Users
    # -----------------------------------------------------------------------
    DEFAULT_PW = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")

    def make_user(email, name, role, site_id=None):
        uid_ = uid()
        cur.execute(
            "INSERT INTO users (id, email, password_hash, full_name, role, mine_site_id, is_active) VALUES (%s, %s, %s, %s, %s, %s, TRUE)",
            (uid_, email, DEFAULT_PW, name, role, site_id),
        )
        return uid_

    # 1. Super Admin (Platform-wide, exactly one seeded on first setup)
    super_admin_id = make_user("superadmin@intellifusion.gov.in", "System Super Admin", "super_admin")

    # 2. Regulatory Authority (Platform-wide audit & statutory oversight)
    regulator_id = make_user("regulator@dgms.gov.in", "A.K. Verma (DGMS)", "regulator")

    # 3. Corporate Management (Multi-mine monitoring, explicit corporate_mine_access)
    corporate_id = make_user("corporate@coalindia.in", "Priya Sharma (Corporate HQ)", "corporate_management")
    # Grant corporate access to first 3 mine sites explicitly
    for sid in site_ids[:3]:
        cur.execute(
            "INSERT INTO corporate_mine_access (id, user_id, mine_site_id) VALUES (%s, %s, %s)",
            (uid(), corporate_id, sid),
        )

    # 4. Mine Officials (Single mine site scoped)
    official_ids = []
    for i, sid in enumerate(site_ids):
        oid = make_user(f"official{i+1}@mine.in", f"Mine Official {i+1}", "mine_official", sid)
        official_ids.append((oid, sid))

    # 5. Field Inspectors (Conduct inspections, log observations)
    inspector_ids = []
    for i in range(10):
        sid = site_ids[i % len(site_ids)]
        iid = make_user(f"inspector{i+1}@mine.in", f"Inspector {i+1}", "inspector", sid)
        inspector_ids.append((iid, sid))

    # 6. Contractors (Only see work explicitly assigned to them)
    contractor_ids = []
    for i in range(5):
        # Contractors 1-4 will receive assignments; Contractor 5 is left with 0 assignments to verify negative access boundaries
        cid = make_user(f"contractor{i+1}@contractor.in", f"Contractor Worker {i+1}", "contractor")
        contractor_ids.append(cid)

    print(
        f"Inserted users: 1 super_admin, 1 regulator, 1 corporate (3 mine access grants), "
        f"{len(official_ids)} officials, {len(inspector_ids)} inspectors, {len(contractor_ids)} contractors."
    )

    # -----------------------------------------------------------------------
    # Observations (200 total)
    # -----------------------------------------------------------------------
    # Distribution:
    # - 40% closed (varied ages)
    # - 20% in_progress
    # - 25% open (recent)
    # - 15% escalated (overdue high-risk, older than 48h with no closure)

    target_distribution = (
        [("closed", 80)] +
        [("in_progress", 40)] +
        [("open", 50)] +
        [("escalated", 30)]
    )

    obs_records = []
    for status, count in target_distribution:
        for _ in range(count):
            # Pick inspector + matching site
            inspector_id, site_id = rng.choice(inspector_ids)
            zone_id, zone_baseline = rng.choice(zone_ids_by_site[site_id])
            category = rng.choice(CATEGORIES)

            # Risk flag weighted toward distribution
            if status == "escalated":
                flag = "high"
            elif status == "closed":
                flag = rng.choices(RISK_FLAGS, weights=[0.4, 0.4, 0.2])[0]
            else:
                flag = rng.choices(RISK_FLAGS, weights=[0.3, 0.45, 0.25])[0]

            # Timestamps
            if status == "escalated":
                days_ago = rng.uniform(3, 14)  # overdue
            elif status == "closed":
                days_ago = rng.uniform(5, 90)
            elif status == "in_progress":
                days_ago = rng.uniform(0.5, 7)
            else:
                days_ago = rng.uniform(0, 3)

            created = ts(days_ago)
            synced = created + timedelta(minutes=rng.uniform(1, 60))
            closed_at = None
            closed_by_id = None
            closure_note = None
            escalated_at = None

            if status == "closed":
                closed_at = created + timedelta(hours=rng.uniform(2, 72))
                official_id = next((o for o, s in official_ids if s == site_id), official_ids[0][0])
                closed_by_id = official_id
                closure_note = rng.choice([
                    "Issue resolved. Safety officer confirmed corrective action taken.",
                    "Equipment repaired and zone cleared. Normal operations resumed.",
                    "Worker briefed and certification updated. No further action needed.",
                    "Environmental sampling completed. Results within acceptable range.",
                    "Contractor crew compliance verified. Permits updated.",
                ])
            if status == "escalated":
                escalated_at = created + timedelta(hours=49)

            edge_s = edge_score_from_category(category, flag)
            edge_r = make_edge_reasons(category, flag)
            cloud_s = round(min(1.0, max(0.0, edge_s + rng.uniform(-0.1, 0.15))), 3)
            cloud_flag = "high" if cloud_s >= 0.7 else ("medium" if cloud_s >= 0.4 else "low")
            cloud_r = make_edge_reasons(category, cloud_flag)
            action = suggested_action(category, cloud_flag)

            has_photo = rng.random() > 0.3
            lat_val = None
            lng_val = None
            beacon_id = None
            # Surface zones get real-ish lat/lng; underground gets beacon ID
            site_lat = next(lat for n, l, lat, lng in mine_sites_data if True)  # just use first for simplicity
            for sn, sl, slat, slng in mine_sites_data:
                if True:
                    pass  # we'll use zone type
            # Assign lat/lng based on zone type — simplification
            if "surface" in zone_id.lower() or rng.random() > 0.5:
                # pick site lat/lng + small jitter
                idx = site_ids.index(site_id)
                _, _, slat, slng = mine_sites_data[idx]
                lat_val = round(slat + rng.uniform(-0.01, 0.01), 6)
                lng_val = round(slng + rng.uniform(-0.01, 0.01), 6)
            else:
                beacon_id = f"BLC-{rng.randint(100,999)}-{rng.choice(['A','B','C'])}"

            obs_id = uid()
            obs_records.append({
                "id": obs_id,
                "created_at": created,
                "synced_at": synced,
                "inspector_id": inspector_id,
                "mine_site_id": site_id,
                "zone_id": zone_id,
                "category": category,
                "description": pick_description(category),
                "has_photo": has_photo,
                "lat": lat_val,
                "lng": lng_val,
                "beacon_id": beacon_id,
                "edge_score": edge_s,
                "edge_flag": flag,
                "edge_reasons": json.dumps(edge_r),
                "cloud_score": cloud_s,
                "cloud_flag": cloud_flag,
                "cloud_reasons": json.dumps(cloud_r),
                "suggested_action": action,
                "status": status,
                "closed_at": closed_at,
                "closed_by_id": closed_by_id,
                "closure_note": closure_note,
                "escalated_at": escalated_at,
            })

    for o in obs_records:
        cur.execute("""
            INSERT INTO observations (
                id, created_at, synced_at, inspector_id, mine_site_id, zone_id,
                category, description, has_photo, lat, lng, beacon_id,
                edge_score, edge_flag, edge_reasons,
                cloud_score, cloud_flag, cloud_reasons, suggested_action,
                status, closed_at, closed_by_id, closure_note, escalated_at,
                version, versions_json, enriched_at
            ) VALUES (
                %(id)s, %(created_at)s, %(synced_at)s, %(inspector_id)s, %(mine_site_id)s, %(zone_id)s,
                %(category)s, %(description)s, %(has_photo)s, %(lat)s, %(lng)s, %(beacon_id)s,
                %(edge_score)s, %(edge_flag)s, %(edge_reasons)s,
                %(cloud_score)s, %(cloud_flag)s, %(cloud_reasons)s, %(suggested_action)s,
                %(status)s, %(closed_at)s, %(closed_by_id)s, %(closure_note)s, %(escalated_at)s,
                1, '[]', NOW()
            )
        """, o)
        # Audit log entry for each observation
        append_audit(cur, o["inspector_id"], "observation.created", {
            "observation_id": o["id"],
            "category": o["category"],
            "status": o["status"],
            "edge_flag": o["edge_flag"],
        })
        if o["status"] == "closed":
            append_audit(cur, o["closed_by_id"], "observation.closed", {
                "observation_id": o["id"],
                "closure_note": o["closure_note"],
            })
        if o["status"] == "escalated":
            append_audit(cur, None, "observation.escalated", {
                "observation_id": o["id"],
                "reason": "High-risk observation not closed within 48 hours",
            })

    print(f"Inserted {len(obs_records)} observations.")
    print(f"Inserted {sum(1 for _ in obs_records if _['status']=='closed')} closed.")
    print(f"Inserted {sum(1 for _ in obs_records if _['status']=='escalated')} escalated.")
    print(f"Inserted audit log entries.")

    # -----------------------------------------------------------------------
    # Contractor Assignments (Explicit work orders)
    # Assign observations to contractors 1-4; contractor 5 gets 0 assignments
    # -----------------------------------------------------------------------
    assignment_count = 0
    for i, o in enumerate(obs_records[:24]):
        assigned_contractor = contractor_ids[i % 4]  # leaves contractor_ids[4] unassigned
        cur.execute(
            """INSERT INTO contractor_assignments (id, contractor_id, observation_id, notes)
               VALUES (%s, %s, %s, %s)""",
            (uid(), assigned_contractor, o["id"], f"Rectification work order #{2001 + i}"),
        )
        assignment_count += 1
    print(f"Inserted {assignment_count} explicit contractor assignments across 4 contractors (1 contractor deliberately unassigned).")

    conn.commit()
    cur.close()
    conn.close()
    print("\n✅ Mock data seeded successfully.")

    # Print quick verification stats
    conn2 = get_conn()
    cur2 = conn2.cursor()
    cur2.execute("SELECT COUNT(*) FROM observations")
    print(f"   observations: {cur2.fetchone()[0]}")
    cur2.execute("SELECT COUNT(*) FROM audit_log")
    print(f"   audit_log entries: {cur2.fetchone()[0]}")
    cur2.execute("SELECT COUNT(*) FROM users")
    print(f"   users: {cur2.fetchone()[0]}")
    cur2.execute("SELECT COUNT(*) FROM corporate_mine_access")
    print(f"   corporate_mine_access: {cur2.fetchone()[0]}")
    cur2.execute("SELECT COUNT(*) FROM contractor_assignments")
    print(f"   contractor_assignments: {cur2.fetchone()[0]}")
    cur2.execute("SELECT status, COUNT(*) FROM observations GROUP BY status")
    for row in cur2.fetchall():
        print(f"   observations[{row[0]}]: {row[1]}")
    cur2.close()
    conn2.close()


if __name__ == "__main__":
    try:
        seed()
    except Exception as e:
        print(f"❌ Seeding failed: {e}", file=sys.stderr)
        sys.exit(1)

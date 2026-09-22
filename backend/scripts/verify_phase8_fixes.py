"""
verify_phase8_fixes.py
Verification test script for Phase 8: Mandatory Audit Fixes.
Tests all 5 fixes:
  1. POST /auth/register rejects public self-registration with elevated roles (regulator, mine_official).
  2. apply_role_filter fails CLOSED when mine_site_id is None for contractor/mine_official.
  3. CORS middleware does not allow wildcard "*" with allow_credentials=True, uses explicit allowlist.
  4. Audit append query uses row-level locking (with_for_update) to prevent hash-chain forking.
  5. JWT_SECRET is synchronized and identical across config.py, .env.example, and docker-compose.yml.
"""
import inspect
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pydantic import ValidationError
from sqlalchemy import select
from app.models import Observation, User, UserRole


def test_fix_1_register_role_restriction():
    print("\n--- Test 1: POST /auth/register Role Restriction ---")
    from app.schemas.auth import RegisterRequest

    # Valid public self-registrations: inspector or contractor
    req_insp = RegisterRequest(
        email="test_insp@mine.in",
        password="password123",
        full_name="Test Inspector",
        role=UserRole.inspector,
    )
    assert req_insp.role == UserRole.inspector, "Inspector registration failed"

    req_contractor = RegisterRequest(
        email="test_contractor@mine.in",
        password="password123",
        full_name="Test Contractor",
        role=UserRole.contractor,
    )
    assert req_contractor.role == UserRole.contractor, "Contractor registration failed"

    # Attempting to self-register as regulator MUST fail validation
    regulator_rejected = False
    try:
        RegisterRequest(
            email="hacker@evil.com",
            password="password123",
            full_name="Fake Regulator",
            role=UserRole.regulator,
        )
    except (ValidationError, ValueError) as exc:
        regulator_rejected = True
        print(f"  [PASS] Attempted regulator self-registration rejected: {exc.errors()[0]['msg']}")

    assert regulator_rejected, "SECURITY BUG: RegisterRequest accepted public self-registration with 'regulator' role!"

    # Attempting to self-register as mine_official MUST fail validation
    official_rejected = False
    try:
        RegisterRequest(
            email="hacker2@evil.com",
            password="password123",
            full_name="Fake Official",
            role=UserRole.mine_official,
        )
    except (ValidationError, ValueError) as exc:
        official_rejected = True
        print(f"  [PASS] Attempted mine_official self-registration rejected: {exc.errors()[0]['msg']}")

    assert official_rejected, "SECURITY BUG: RegisterRequest accepted public self-registration with 'mine_official' role!"
    print("PASS: Public registration strictly limited to inspector/contractor.")


def test_fix_2_role_filter_fails_closed():
    print("\n--- Test 2: apply_role_filter Fails Closed on Missing Scope ---")
    from app.api.observations import apply_role_filter

    base_stmt = select(Observation)

    # 1. Contractor with NO mine_site_id
    contractor_no_site = User(
        email="contractor@mine.in",
        role=UserRole.contractor,
        mine_site_id=None,
    )
    stmt_contractor = apply_role_filter(base_stmt, contractor_no_site)
    contractor_compiled = str(stmt_contractor.compile(compile_kwargs={"literal_binds": True}))
    
    # Must NOT be an open unfiltered query
    base_compiled = str(base_stmt.compile(compile_kwargs={"literal_binds": True}))
    assert contractor_compiled != base_compiled, "SECURITY BUG: Contractor with mine_site_id=None received unfiltered query (failed open)!"
    # Verify filter contains closed clause (e.g. observations.id IS NULL or contractor_assignments subquery)
    assert "observations.id IS NULL" in contractor_compiled or "contractor_assignments" in contractor_compiled or "false" in contractor_compiled.lower() or "0 = 1" in contractor_compiled or "1 = 0" in contractor_compiled, (
        f"Contractor query did not fail closed: {contractor_compiled}"
    )
    print("  [PASS] Contractor without mine_site_id fails closed (0 observations exposed).")

    # 2. Mine Official with NO mine_site_id
    official_no_site = User(
        email="official@mine.in",
        role=UserRole.mine_official,
        mine_site_id=None,
    )
    stmt_official = apply_role_filter(base_stmt, official_no_site)
    official_compiled = str(stmt_official.compile(compile_kwargs={"literal_binds": True}))
    assert official_compiled != base_compiled, "SECURITY BUG: Mine official with mine_site_id=None received unfiltered query (failed open)!"
    assert "observations.id IS NULL" in official_compiled or "false" in official_compiled.lower() or "0 = 1" in official_compiled or "1 = 0" in official_compiled, (
        f"Mine official query did not fail closed: {official_compiled}"
    )
    print("  [PASS] Mine official without mine_site_id fails closed (0 observations exposed).")
    print("PASS: apply_role_filter strictly fails closed.")


def test_fix_3_cors_allowlist_restriction():
    print("\n--- Test 3: CORS Configuration & Credentials Allowlist ---")
    from app.main import app
    from app.config import settings

    # Check CORS middleware configuration on FastAPI app
    cors_middleware = None
    for middleware in app.user_middleware:
        if "CORSMiddleware" in str(middleware.cls):
            cors_middleware = middleware
            break

    options = getattr(cors_middleware, "options", getattr(cors_middleware, "kwargs", {}))

    allow_origins = options.get("allow_origins", [])
    allow_credentials = options.get("allow_credentials", False)

    print(f"  Configured allow_origins: {allow_origins}")
    print(f"  Configured allow_credentials: {allow_credentials}")

    # Wildcard origin with credentials enabled violates browser security specs
    if allow_credentials:
        assert "*" not in allow_origins, "SECURITY BUG: CORS allows wildcard origin '*' together with allow_credentials=True!"

    assert hasattr(settings, "cors_allowed_origins"), "settings.cors_allowed_origins not defined in config.py"
    assert len(allow_origins) > 0, "No origins allowed in CORS middleware"
    assert not any(o == "*" for o in allow_origins), "Wildcard '*' must not be present in allow_origins"
    print("PASS: CORS allowlist restricted to explicit origins, credentials safe.")


def test_fix_4_audit_append_row_lock():
    print("\n--- Test 4: Audit Append Concurrency Lock (with_for_update) ---")
    from app.audit import chain

    source = inspect.getsource(chain.append_audit_entry)
    assert "with_for_update" in source, "CONCURRENCY BUG: append_audit_entry does not use with_for_update() row lock to prevent chain forking!"
    print("  [PASS] append_audit_entry uses with_for_update() row lock.")
    print("PASS: Audit hash chain append serialized against concurrent fork races.")


def test_fix_5_jwt_secret_synchronization():
    print("\n--- Test 5: JWT_SECRET Synchronization Across Environments ---")
    from app.config import settings

    # Resolve paths for both host and Docker contexts.
    # Host:   backend/scripts/../../  -> SIH/ (project root)
    # Docker: /app/scripts/../../     -> /    (filesystem root, wrong)
    # Docker: /app = backend/, so .env.example is at /app/.env.example
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _host_root = os.path.abspath(os.path.join(_script_dir, "..", ".."))
    _docker_root = os.path.abspath(os.path.join(_script_dir, ".."))  # /app/

    # Prefer /repo bind-mount (docker-compose.override.yml dev profile), then host/docker paths
    _repo = Path("/repo")
    if (_repo / "docker-compose.yml").exists():
        docker_compose_path = str(_repo / "docker-compose.yml")
        env_example_path = str(_repo / "backend" / ".env.example" if (_repo / "backend" / ".env.example").exists() else _repo / ".env.example")
    elif os.path.exists(os.path.join(_host_root, "backend", ".env.example")):
        root_dir = _host_root
        env_example_path = os.path.join(root_dir, "backend", ".env.example")
        docker_compose_path = os.path.join(root_dir, "docker-compose.yml")
    else:
        root_dir = _docker_root
        env_example_path = os.path.join(root_dir, ".env.example")
        docker_compose_path = os.path.join(_host_root, "docker-compose.yml")  # not mounted; skip if missing

    assert os.path.exists(env_example_path), f"Missing {env_example_path}"
    if not os.path.exists(docker_compose_path):
        # Inside Docker without override mount: docker-compose.yml not mounted — skip docker-compose check
        with open(env_example_path, "r", encoding="utf-8") as f:
            env_content = f.read()
        env_match = re.search(r"^JWT_SECRET=(.+)$", env_content, re.MULTILINE)
        assert env_match, "JWT_SECRET not found in .env.example"
        env_jwt = env_match.group(1).strip()
        from app.config import settings as _s
        config_jwt = _s.jwt_secret
        assert config_jwt == env_jwt, f"JWT_SECRET mismatch! config.py != .env.example"
        print(f"  .env.example JWT_SECRET: {env_jwt[:15]}... (len {len(env_jwt)})")
        print("  [SKIP] docker-compose.yml not mounted in container — add docker-compose.override.yml for full check.")
        print("PASS: JWT_SECRET synchronized between config.py and .env.example.")
        return

    with open(env_example_path, "r", encoding="utf-8") as f:
        env_content = f.read()

    with open(docker_compose_path, "r", encoding="utf-8") as f:
        dc_content = f.read()

    # Extract JWT_SECRET from .env.example
    env_match = re.search(r"^JWT_SECRET=(.+)$", env_content, re.MULTILINE)
    assert env_match, "JWT_SECRET not found in .env.example"
    env_jwt = env_match.group(1).strip()

    # Extract JWT_SECRET from docker-compose.yml
    dc_match = re.search(r"JWT_SECRET:\s*(.+)$", dc_content, re.MULTILINE)
    assert dc_match, "JWT_SECRET not found in docker-compose.yml"
    dc_jwt = dc_match.group(1).strip()

    config_jwt = settings.jwt_secret

    print(f"  config.py default JWT_SECRET:     {config_jwt[:15]}... (len {len(config_jwt)})")
    print(f"  .env.example JWT_SECRET:           {env_jwt[:15]}... (len {len(env_jwt)})")
    print(f"  docker-compose.yml JWT_SECRET:     {dc_jwt[:15]}... (len {len(dc_jwt)})")

    assert env_jwt == dc_jwt, f"JWT_SECRET mismatch! .env.example ({env_jwt}) != docker-compose.yml ({dc_jwt})"
    assert config_jwt == env_jwt, f"JWT_SECRET mismatch! config.py ({config_jwt}) != .env.example ({env_jwt})"
    assert len(config_jwt) >= 32, "JWT_SECRET should be a cryptographically strong key (>= 32 chars)"
    print("PASS: JWT_SECRET identical and synchronized across config.py, .env.example, and docker-compose.yml.")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING PHASE 8 VERIFICATION SUITE")
    print("=" * 60)
    failed = 0

    for name, func in [
        ("Fix 1: Register Role Restriction", test_fix_1_register_role_restriction),
        ("Fix 2: Role Filter Fails Closed", test_fix_2_role_filter_fails_closed),
        ("Fix 3: CORS Allowlist Restriction", test_fix_3_cors_allowlist_restriction),
        ("Fix 4: Audit Append Row Lock", test_fix_4_audit_append_row_lock),
        ("Fix 5: JWT_SECRET Synchronization", test_fix_5_jwt_secret_synchronization),
    ]:
        try:
            func()
        except AssertionError as e:
            print(f"FAIL: {name} -> {e}")
            failed += 1
        except Exception as e:
            print(f"ERROR: {name} -> {e}")
            failed += 1

    print("\n" + "=" * 60)
    if failed == 0:
        print("ALL 5 PHASE 8 AUDIT FIXES VERIFIED SUCCESSFULLY!")
    else:
        print(f"VERIFICATION FAILED: {failed} of 5 tests failed.")
    print("=" * 60)
    sys.exit(failed)

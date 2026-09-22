"""
verify_phase24_authz.py
Phase 24 Authorization Foundation — Verification Suite

Tests (offline / without live DB where possible):
  1. Code registry vs DEFAULT_ROLE_PERMISSIONS shape check
  2. HARD_DENY rules validation (all D9 super_admin deny rules present)
  3. Permission enum completeness (all PERMISSIONS_REGISTRY codes exist)
  4. authz/deps.py importability and function presence
  5. authz/scope.py importability
  6. authz/errors.py {code, message, detail} structure (MUST #3)
  7. UserOut schema has permissions and scope fields (MUST #2)
  8. Migration 006 file exists and has valid Python syntax
  9. docs/RBAC_SPEC.md and docs/UNIFIED_FLOW_PROMPT.md exist (MUST #1)
  10. Mobile auth.ts has best-effort logout (SHOULD #12)
  11. D9: super_admin not in close_observation / assign-contractor dependencies
  12. SHOULD #6: Migration 006 has no 'import app.' statements (frozen snapshot)
  13. config.py demo_mode default False (MUST #4)
  14. docker-compose.yml DEMO_MODE=true explicitly set (MUST #4)
"""
import ast
import importlib
import os
import re
import sys
import traceback

# Make backend importable
BACKEND = os.path.join(os.path.dirname(__file__), "..", "app")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PASS = "PASS"
FAIL = "FAIL"
results = []


def check(name: str, condition: bool, detail: str = "") -> None:
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# 1. Permission enum completeness
# ---------------------------------------------------------------------------
try:
    from app.authz.permissions import Permission, PERMISSIONS_REGISTRY, DEFAULT_ROLE_PERMISSIONS, HARD_DENY

    missing = [p for p in Permission if p not in PERMISSIONS_REGISTRY]
    check("1. Permission enum fully in PERMISSIONS_REGISTRY", not missing,
          f"Missing: {missing}" if missing else f"{len(Permission)} permissions")
except Exception as e:
    check("1. Permission enum fully in PERMISSIONS_REGISTRY", False, str(e))

# ---------------------------------------------------------------------------
# 2. DEFAULT_ROLE_PERMISSIONS completeness (all 6 roles present)
# ---------------------------------------------------------------------------
try:
    from app.models import UserRole
    all_roles = set(UserRole)
    missing_roles = all_roles - set(DEFAULT_ROLE_PERMISSIONS.keys())
    check("2. DEFAULT_ROLE_PERMISSIONS covers all 6 roles", not missing_roles,
          f"Missing: {missing_roles}" if missing_roles else "6/6 roles")
except Exception as e:
    check("2. DEFAULT_ROLE_PERMISSIONS covers all 6 roles", False, str(e))

# ---------------------------------------------------------------------------
# 3. HARD_DENY — D9: super_admin denied operator actions
# ---------------------------------------------------------------------------
try:
    from app.authz.permissions import HARD_DENY, Permission, is_hard_denied
    from app.models import UserRole

    d9_checks = [
        (UserRole.super_admin, Permission.OBSERVATION_CLOSE),
        (UserRole.super_admin, Permission.ACTION_VERIFY),
        (UserRole.super_admin, Permission.ACTION_REJECT),
        (UserRole.super_admin, Permission.INSPECTION_START),
        (UserRole.super_admin, Permission.INSPECTION_SUBMIT),
    ]
    all_denied = all(is_hard_denied(role, perm) for role, perm in d9_checks)
    check("3. D9 super_admin operator HARD_DENY rules", all_denied,
          "5 operator permissions hard-denied for super_admin")
except Exception as e:
    check("3. D9 super_admin operator HARD_DENY rules", False, str(e))

# ---------------------------------------------------------------------------
# 4. authz/deps.py importability and required functions
# ---------------------------------------------------------------------------
try:
    from app.authz.deps import authenticate, require_permission, require_roles, get_current_user
    fns_ok = all(callable(f) for f in [authenticate, require_permission, require_roles, get_current_user])
    check("4. authz/deps.py imports and functions callable", fns_ok)
except Exception as e:
    check("4. authz/deps.py imports and functions callable", False, str(e))

# ---------------------------------------------------------------------------
# 5. authz/scope.py importability
# ---------------------------------------------------------------------------
try:
    from app.authz.scope import visible_mine_ids, apply_observation_scope, assert_can_access_observation, apply_alert_scope
    check("5. authz/scope.py all helpers importable", True)
except Exception as e:
    check("5. authz/scope.py all helpers importable", False, str(e))

# ---------------------------------------------------------------------------
# 6. authz/errors.py returns {code, message, detail} with detail==message (MUST #3)
# ---------------------------------------------------------------------------
try:
    from app.authz.errors import forbidden, unauthenticated, session_expired, account_disabled

    err = forbidden("test message")
    detail_payload = err.detail
    ok = (
        isinstance(detail_payload, dict)
        and detail_payload.get("code") == "FORBIDDEN"
        and detail_payload.get("detail") == detail_payload.get("message")
        and detail_payload.get("message") == "test message"
    )
    check("6. MUST #3 — {code, message, detail} where detail==message", ok,
          f"detail={detail_payload}")
except Exception as e:
    check("6. MUST #3 — {code, message, detail} where detail==message", False, str(e))

# ---------------------------------------------------------------------------
# 7. UserOut has permissions and scope (MUST #2)
# ---------------------------------------------------------------------------
try:
    from app.schemas.auth import UserOut
    fields = UserOut.model_fields
    has_permissions = "permissions" in fields
    has_scope = "scope" in fields
    # Ensure original fields still present (backward compat)
    original_fields = {"id", "email", "full_name", "role", "mine_site_id", "is_active"}
    missing_original = original_fields - set(fields.keys())
    ok = has_permissions and has_scope and not missing_original
    check("7. MUST #2 — UserOut has permissions, scope, and original fields", ok,
          f"permissions={has_permissions}, scope={has_scope}, missing_original={missing_original}")
except Exception as e:
    check("7. MUST #2 — UserOut has permissions, scope, and original fields", False, str(e))

# ---------------------------------------------------------------------------
# 8. Migration 006 exists and has valid Python syntax
# ---------------------------------------------------------------------------
try:
    mig_path = os.path.join(os.path.dirname(__file__), "..", "alembic", "versions", "006_authz_and_sessions.py")
    exists = os.path.exists(mig_path)
    check("8a. Migration 006 file exists", exists, mig_path)
    if exists:
        with open(mig_path) as f:
            src = f.read()
        ast.parse(src)  # syntax check
        check("8b. Migration 006 valid Python syntax", True)
except SyntaxError as e:
    check("8b. Migration 006 valid Python syntax", False, str(e))
except Exception as e:
    check("8. Migration 006 check", False, str(e))

# ---------------------------------------------------------------------------
# 9. docs/RBAC_SPEC.md and UNIFIED_FLOW_PROMPT.md exist (MUST #1)
# ---------------------------------------------------------------------------
try:
    # Script lives at backend/scripts/ — project root is two levels up on host,
    # but inside Docker /app = backend/ so project root is one level up.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Prefer /repo bind-mount (docker-compose.override.yml dev profile), then host paths
    _repo = "/repo"
    candidates = [
        os.path.join(_repo, "docs") if os.path.isdir(_repo) else None,
        os.path.join(script_dir, "..", "..", "docs"),        # host: SIH/backend/scripts -> SIH/docs
        os.path.join(script_dir, "..", "docs"),              # Docker: /app/scripts -> /app/docs
        os.path.join(script_dir, "..", "..", "..", "docs"),  # fallback
    ]
    docs_dir = next((c for c in candidates if c and os.path.isdir(c)), None)

    if docs_dir:
        rbac = os.path.join(docs_dir, "RBAC_SPEC.md")
        flow = os.path.join(docs_dir, "UNIFIED_FLOW_PROMPT.md")
        rbac_exists = os.path.exists(rbac)
        flow_exists = os.path.exists(flow)
        check("9a. docs/RBAC_SPEC.md exists", rbac_exists, rbac)
        check("9b. docs/UNIFIED_FLOW_PROMPT.md exists", flow_exists, flow)
    else:
        results.append(("SKIP", "9a. docs/RBAC_SPEC.md exists", "docs/ not mounted — add docker-compose.override.yml"))
        results.append(("SKIP", "9b. docs/UNIFIED_FLOW_PROMPT.md exists", "docs/ not mounted — add docker-compose.override.yml"))
        print("[SKIP] 9a. docs/RBAC_SPEC.md exists — docs/ not mounted — add docker-compose.override.yml")
        print("[SKIP] 9b. docs/UNIFIED_FLOW_PROMPT.md exists — docs/ not mounted — add docker-compose.override.yml")
except Exception as e:
    check("9. docs files existence", False, str(e))

# ---------------------------------------------------------------------------
# 10. Mobile auth.ts has best-effort logout (SHOULD #12)
# ---------------------------------------------------------------------------
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    _repo = "/repo"
    mobile_candidates = [
        os.path.join(_repo, "mobile", "src", "api", "auth.ts") if os.path.isdir(_repo) else None,
        os.path.join(script_dir, "..", "..", "mobile", "src", "api", "auth.ts"),
        os.path.join(script_dir, "..", "mobile", "src", "api", "auth.ts"),
        os.path.join(script_dir, "..", "..", "..", "mobile", "src", "api", "auth.ts"),
    ]
    mobile_auth = next((p for p in mobile_candidates if p and os.path.exists(p)), None)
    if mobile_auth:
        with open(mobile_auth) as f:
            content = f.read()
        has_best_effort = "best-effort" in content or "Best-effort" in content
        has_post_logout = 'post("/auth/logout")' in content
        ok = has_best_effort and has_post_logout
        check("10. SHOULD #12 — mobile logout is best-effort with POST /auth/logout", ok,
              f"best_effort={has_best_effort}, post_logout={has_post_logout}")
    else:
        results.append(("SKIP", "10. SHOULD #12 — mobile auth.ts not reachable from container",
                        "mobile/ not mounted — add docker-compose.override.yml"))
        print("[SKIP] 10. SHOULD #12 — mobile auth.ts not reachable — add docker-compose.override.yml")
except Exception as e:
    check("10. SHOULD #12 — mobile best-effort logout", False, str(e))

# ---------------------------------------------------------------------------
# 11. D9: super_admin NOT in close/assign-contractor role checks in observations.py
# ---------------------------------------------------------------------------
try:
    obs_path = os.path.join(os.path.dirname(__file__), "..", "app", "api", "observations.py")
    with open(obs_path) as f:
        obs_src = f.read()

    # Parse the AST to find close_observation and assign_contractor functions
    tree = ast.parse(obs_src)

    def get_func_src(tree, func_name):
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == func_name:
                lines = obs_src.split("\n")
                return "\n".join(lines[node.lineno - 1: node.end_lineno])
        return ""

    close_src = get_func_src(tree, "close_observation")
    assign_src = get_func_src(tree, "assign_contractor")

    # super_admin must NOT appear in the require_roles call of these functions
    # But it's acceptable that super_admin appears in comments or other places.
    # The critical check: no require_roles(... super_admin ...) in the Depends line
    import re
    close_super = bool(re.search(r"require_roles\([^)]*super_admin[^)]*\)", close_src))
    assign_super = bool(re.search(r"require_roles\([^)]*super_admin[^)]*\)", assign_src))

    ok = not close_super and not assign_super
    check("11. D9 — super_admin removed from close/assign-contractor", ok,
          f"close_has_super={close_super}, assign_has_super={assign_super}")
except Exception as e:
    check("11. D9 — super_admin check in observations.py", False, str(e))

# ---------------------------------------------------------------------------
# 12. SHOULD #6 — Migration 006 has no 'import app.' (frozen snapshot)
# ---------------------------------------------------------------------------
try:
    mig_path = os.path.join(os.path.dirname(__file__), "..", "alembic", "versions", "006_authz_and_sessions.py")
    if os.path.exists(mig_path):
        with open(mig_path) as f:
            mig_src = f.read()
        app_imports = re.findall(r"^(?:import|from)\s+app\.", mig_src, re.MULTILINE)
        check("12. SHOULD #6 — Migration 006 has no app.* imports (frozen)", not app_imports,
              f"Found: {app_imports}" if app_imports else "No app.* imports")
    else:
        check("12. SHOULD #6 — Migration 006 frozen", False, "file not found")
except Exception as e:
    check("12. SHOULD #6 — Migration 006 frozen check", False, str(e))

# ---------------------------------------------------------------------------
# 13. MUST #4 — config.py demo_mode default is False
# ---------------------------------------------------------------------------
try:
    from app.config import Settings
    if hasattr(Settings, "model_fields"):
        demo_default = Settings.model_fields["demo_mode"].default
    elif hasattr(Settings, "__fields__"):
        demo_default = Settings.__fields__["demo_mode"].default
    else:
        demo_default = Settings(_env_file=None).demo_mode
    check("13. MUST #4 — config.py demo_mode defaults to False", demo_default is False,
          f"demo_mode default={demo_default}")
except Exception as e:
    check("13. MUST #4 — config.py demo_mode default", False, str(e))

# ---------------------------------------------------------------------------
# 14. MUST #4 — docker-compose.yml has DEMO_MODE=true
# ---------------------------------------------------------------------------
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    _repo = "/repo"
    dc_candidates = [
        os.path.join(_repo, "docker-compose.yml") if os.path.isdir(_repo) else None,
        os.path.join(script_dir, "..", "..", "docker-compose.yml"),        # host
        os.path.join(script_dir, "..", "docker-compose.yml"),              # Docker
        os.path.join(script_dir, "..", "..", "..", "docker-compose.yml"),  # fallback
    ]
    dc_path = next((p for p in dc_candidates if p and os.path.exists(p)), None)
    if dc_path:
        with open(dc_path) as f:
            dc_src = f.read()
        has_demo_true = 'DEMO_MODE: "true"' in dc_src or "DEMO_MODE: 'true'" in dc_src or "DEMO_MODE=true" in dc_src
        check("14. MUST #4 — docker-compose.yml DEMO_MODE=true", has_demo_true)
    else:
        results.append(("SKIP", "14. MUST #4 — docker-compose.yml DEMO_MODE=true", "docker-compose.yml not mounted in container — add docker-compose.override.yml"))
        print("[SKIP] 14. MUST #4 — docker-compose.yml DEMO_MODE=true — docker-compose.yml not mounted in container")
except Exception as e:
    check("14. MUST #4 — docker-compose.yml DEMO_MODE", False, str(e))

# ---------------------------------------------------------------------------
# 15. Permissions JSON synchronization: committed backend_permissions.json matches live PERMISSIONS_REGISTRY
# ---------------------------------------------------------------------------
try:
    import json
    json_candidates = [
        os.path.join(_repo, "dashboard", "src", "config", "backend_permissions.json") if os.path.isdir(_repo) else None,
        os.path.join(script_dir, "..", "..", "dashboard", "src", "config", "backend_permissions.json"),
        os.path.join(script_dir, "..", "dashboard", "src", "config", "backend_permissions.json"),
    ]
    json_path = next((p for p in json_candidates if p and os.path.exists(p)), None)
    if json_path:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        committed_perms = sorted(data.get("permissions", []))
        live_perms = sorted([p.value for p in PERMISSIONS_REGISTRY.keys()])
        match = (committed_perms == live_perms)
        check("15. Permissions JSON matches live PERMISSIONS_REGISTRY", match,
              f"{len(committed_perms)} committed vs {len(live_perms)} live")
    else:
        results.append(("SKIP", "15. Permissions JSON matches live PERMISSIONS_REGISTRY", "backend_permissions.json not mounted"))
        print("[SKIP] 15. Permissions JSON matches live PERMISSIONS_REGISTRY — file not found")
except Exception as e:
    check("15. Permissions JSON matches live PERMISSIONS_REGISTRY", False, str(e))

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print()
SKIP = "SKIP"
passed = sum(1 for s, _, _ in results if s == PASS)
failed = sum(1 for s, _, _ in results if s == FAIL)
skipped = sum(1 for s, _, _ in results if s == SKIP)
ran = passed + failed
print(f"Phase 24 Verification: {passed}/{ran} PASSED, {failed} FAILED, {skipped} SKIPPED")

if failed > 0:
    print("\nFailed checks:")
    for s, name, detail in results:
        if s == FAIL:
            print(f"  \u2717 {name}: {detail}")
    sys.exit(1)
else:
    print(f"\u2713 {passed}/{ran} Phase 24 checks PASSED  [{skipped} SKIPPED]")

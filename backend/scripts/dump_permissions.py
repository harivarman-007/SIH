"""dump_permissions.py

Dumps the backend PERMISSIONS_REGISTRY to dashboard/src/config/backend_permissions.json
to guarantee exact parity testing in Vitest without hardcoded / hand-copied lists.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.authz.permissions import PERMISSIONS_REGISTRY


def main():
    root = Path(__file__).resolve().parent.parent.parent
    dashboard_cfg = root / "dashboard" / "src" / "config"
    dashboard_cfg.mkdir(parents=True, exist_ok=True)
    out_file = dashboard_cfg / "backend_permissions.json"

    # Also handle running inside Docker container where SIH root may be at /repo
    if not dashboard_cfg.is_dir() and Path("/repo/dashboard/src/config").is_dir():
        out_file = Path("/repo/dashboard/src/config/backend_permissions.json")

    perms_list = sorted([p.value for p in PERMISSIONS_REGISTRY.keys()])

    data = {
        "source": "backend/app/authz/permissions.py::PERMISSIONS_REGISTRY",
        "count": len(perms_list),
        "permissions": perms_list,
    }

    out_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Successfully dumped {len(perms_list)} permissions from backend registry to {out_file}")


if __name__ == "__main__":
    main()

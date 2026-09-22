"""verify_all.py

Phase 27b Test Runner:
Runs every verify script in backend/scripts/ and reports PASS / FAIL / SKIP separately.
Exits with non-zero code if ANY script has failures.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS = [
    ("Phase 8", "verify_phase8_fixes.py"),
    ("Phase 9", "verify_phase9_roles.py"),
    ("Phase 11", "verify_phase11_corporate.py"),
    ("Escalation", "verify_escalation.py"),
    ("Phase 20", "verify_phase20_telemetry.py"),
    ("Phase 21", "verify_phase21_ocr_image.py"),
    ("Phase 22", "verify_phase22_alerts.py"),
    ("Phase 24", "verify_phase24_authz.py"),
    ("Phase 25", "verify_phase25_inspections.py"),
    ("Phase 26", "verify_phase26_actions.py"),
    ("Phase 27", "verify_phase27_auth.py"),
    ("Phase 27b Overdue", "verify_phase27b_overdue.py"),
    ("Phase 27b KPI", "verify_phase27b_kpi.py"),
    ("Phase 29 Pull Sync", "verify_phase29_pull_sync.py"),
    ("Phase 30 Admin & Reports", "verify_phase30_admin_reports.py"),
]



def parse_counts(output: str, exit_code: int):
    """
    Parses PASS, FAIL, and SKIP counts from script output.
    """
    # 1. First look for summary lines
    # e.g.: "Phase 24 Verification: 14/14 PASSED, 0 FAILED, 3 SKIPPED"
    m = re.search(r"(\d+)\s+PASSED[,\s]+(\d+)\s+FAILED[,\s]+(\d+)\s+SKIPPED", output, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))

    # e.g.: "Results: 6 PASSED, 0 FAILED"
    m = re.search(r"Results:\s*(\d+)\s+PASSED,\s*(\d+)\s+FAILED", output, re.IGNORECASE)
    if m:
        p = int(m.group(1))
        f = int(m.group(2))
        s = len(re.findall(r"\[SKIP\]", output))
        return p, f, s

    # Phase 20 unittest format: "Results: 5/5 passed"
    m = re.search(r"Results:\s*(\d+)/(\d+)\s+passed", output, re.IGNORECASE)
    if m:
        p = int(m.group(1))
        total = int(m.group(2))
        f = total - p
        s = len(re.findall(r"\[SKIP\]", output))
        return p, f, s

    # e.g.: "PASS: 17/17 Phase 22 checks PASSED  [13 SKIPPED]"
    m = re.search(r"PASS:\s*(\d+)/\d+.*?PASSED\s*\[(\d+)\s*SKIPPED\]", output, re.IGNORECASE)
    if m:
        return int(m.group(1)), 0, int(m.group(2))

    # e.g.: "FAIL: 1 check(s) FAILED  (16/17 passed, 13 SKIPPED)"
    m = re.search(r"FAIL:\s*(\d+)\s*check.*?\((\d+)/\d+\s*passed,\s*(\d+)\s*SKIPPED\)", output, re.IGNORECASE)
    if m:
        return int(m.group(2)), int(m.group(1)), int(m.group(3))

    # e.g.: "Total Tests: 22 | Passed: 22 | Failed: 0"
    m = re.search(r"Total Tests:\s*\d+\s*\|\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)", output, re.IGNORECASE)
    if m:
        p = int(m.group(1))
        f = int(m.group(2))
        s = len(re.findall(r"\[SKIP\]", output))
        return p, f, s

    # Fallback line-by-line counting.
    # Note: unittest interleaves progress dots before [PASS] markers (e.g. ".  [PASS] ...").
    # Count [PASS]/[FAIL]/[SKIP] anywhere on a line, not just at line start.
    p = len(re.findall(r"\[PASS\]", output))
    f = len(re.findall(r"\[FAIL\]", output))
    s = len(re.findall(r"\[SKIP\]", output))

    # If script output uses "PASS: ..." summary lines instead of [PASS] markers
    if p == 0:
        p = len(re.findall(r"^PASS:", output, re.MULTILINE))
    if f == 0 and exit_code != 0:
        f = 1

    return p, f, s


def main():
    scripts_dir = Path(__file__).resolve().parent
    repo_root = scripts_dir.parent.parent
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_file = reports_dir / "verify_all_latest.txt"

    # Get git commit hash
    try:
        git_hash = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(repo_root), text=True).strip()
    except Exception:
        git_hash = "UNKNOWN_COMMIT"

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    # Custom Tee writer
    class TeeWriter:
        def __init__(self, original_stream, log_file_path, header: str):
            self.original = original_stream
            self.file = open(log_file_path, "w", encoding="utf-8")
            self.file.write(header + "\n")
            self.file.flush()

        def write(self, data):
            self.original.write(data)
            self.file.write(data)
            self.file.flush()

        def flush(self):
            self.original.flush()
            self.file.flush()

        def close(self):
            self.file.close()

    header_line = f"# Commit: {git_hash} | Timestamp: {now_iso}"
    tee = TeeWriter(sys.stdout, report_file, header_line)
    sys.stdout = tee

    python_bin = sys.executable
    venv_python_win = repo_root / ".venv" / "Scripts" / "python.exe"
    venv_python_nix = repo_root / ".venv" / "bin" / "python"
    if venv_python_win.is_file():
        python_bin = str(venv_python_win)
    elif venv_python_nix.is_file():
        python_bin = str(venv_python_nix)

    print("\n" + "=" * 78)
    print("INTELLIFUSION MASTER VERIFICATION SUITE (ALL PHASES)")
    print("=" * 78 + "\n")

    summary = []
    total_passed = 0
    total_failed = 0
    total_skipped = 0
    any_script_failed = False

    for label, filename in SCRIPTS:
        script_path = scripts_dir / filename
        if not script_path.is_file():
            print(f"\n[ERROR] Script {filename} not found at {script_path}!\n")
            summary.append((label, filename, 0, 1, 0, 1))
            total_failed += 1
            any_script_failed = True
            continue

        print(f"\n>>> Running {label} ({filename}) ...")
        print("-" * 60)

        # Set unbuffered output and utf-8 encoding
        env = dict(os.environ)
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"

        proc = subprocess.run(
            [python_bin, str(script_path)],
            cwd=str(scripts_dir.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )

        output = proc.stdout or ""
        print(output.rstrip())
        print("-" * 60)

        p_count, f_count, s_count = parse_counts(output, proc.returncode)

        if proc.returncode != 0 and f_count == 0:
            f_count = 1

        is_fail = (proc.returncode != 0) or (f_count > 0)
        status_str = "FAIL" if is_fail else "PASS"

        if is_fail:
            any_script_failed = True

        total_passed += p_count
        total_failed += f_count
        total_skipped += s_count

        summary.append((label, filename, p_count, f_count, s_count, status_str))
        print(f"[{status_str}] {label} ({filename}): {p_count} PASS, {f_count} FAIL, {s_count} SKIP (exit: {proc.returncode})\n")

    # Final Reconciliation Table
    print("\n" + "=" * 78)
    print("FINAL VERIFICATION RECONCILIATION TABLE")
    print("=" * 78)
    print(f"{'Phase / Script':<30} | {'PASS':<6} | {'FAIL':<6} | {'SKIP':<6} | {'Status':<6}")
    print("-" * 78)

    for label, filename, p, f, s, st in summary:
        print(f"{label + ' (' + filename + ')':<30} | {p:<6} | {f:<6} | {s:<6} | {st:<6}")

    print("-" * 78)
    total_ran = total_passed + total_failed
    print(f"{'GRAND TOTAL':<30} | {total_passed:<6} | {total_failed:<6} | {total_skipped:<6} | {'FAIL' if any_script_failed else 'PASS':<6}")
    print("=" * 78)
    print(f"Grand Total Checks Run: {total_ran} ({total_passed} Passed, {total_failed} Failed)")
    print(f"Total Checks Skipped:   {total_skipped}")
    print("=" * 78 + "\n")

    if any_script_failed:
        print(">>> ONE OR MORE VERIFICATION SCRIPTS FAILED. <<<")
        sys.exit(1)
    else:
        print(">>> ALL VERIFICATION SUITES PASSED SUCCESSFULLY! <<<")
        sys.exit(0)


if __name__ == "__main__":
    main()

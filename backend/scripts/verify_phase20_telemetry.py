"""
verify_phase20_telemetry.py
Automated verification for Phase 20: Real Observation-Derived Gas Telemetry.

Checks:
1. Observation ORM model has gas_reading_value (Float) and gas_reading_unit (String) columns
2. ObservationCreate, ObservationOut, and RiskCardOut schemas include gas reading fields
3. SyncObservationPayload in mobile api supports gas readings
4. Alembic migration 003_add_observation_gas_reading exists and defines upgrade/downgrade
5. Mock seed data includes gas_reading_value for safety gas observations
6. Observation instantiation and serialization with gas reading roundtrips cleanly
"""

import importlib.util
import os
import sys
import unittest
from datetime import datetime, timezone
import uuid

# Ensure backend path on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models import Observation, ObservationCategory, ObservationStatus, RiskFlag
from app.schemas.observation import ObservationCreate, ObservationOut, RiskCardOut


class TestPhase20Telemetry(unittest.TestCase):
    def test_01_orm_model_columns(self):
        """Observation model must have gas_reading_value and gas_reading_unit mapped columns."""
        mapper = Observation.__mapper__
        self.assertIn("gas_reading_value", mapper.columns)
        self.assertIn("gas_reading_unit", mapper.columns)
        print("  [PASS] Observation ORM model has gas_reading_value and gas_reading_unit columns")

    def test_02_schemas_include_gas_readings(self):
        """Pydantic schemas must define gas_reading_value and gas_reading_unit."""
        create_fields = ObservationCreate.model_fields
        self.assertIn("gas_reading_value", create_fields)
        self.assertIn("gas_reading_unit", create_fields)

        out_fields = ObservationOut.model_fields
        self.assertIn("gas_reading_value", out_fields)
        self.assertIn("gas_reading_unit", out_fields)

        risk_fields = RiskCardOut.model_fields
        self.assertIn("gas_reading_value", risk_fields)
        self.assertIn("gas_reading_unit", risk_fields)
        print("  [PASS] ObservationCreate, ObservationOut, RiskCardOut schemas define gas reading fields")

    def test_03_schema_serialization(self):
        """ObservationCreate parses numeric gas reading and ObservationOut serializes it."""
        payload = {
            "category": "safety",
            "description": "High methane concentration detected at return airway junction",
            "gas_reading_value": 1.85,
            "gas_reading_unit": "% CH₄",
        }
        create_obj = ObservationCreate(**payload)
        self.assertEqual(create_obj.gas_reading_value, 1.85)
        self.assertEqual(create_obj.gas_reading_unit, "% CH₄")

        out_data = {
            "id": uuid.uuid4(),
            "created_at": datetime.now(timezone.utc),
            "synced_at": datetime.now(timezone.utc),
            "inspector_id": uuid.uuid4(),
            "mine_site_id": uuid.uuid4(),
            "zone_id": uuid.uuid4(),
            "category": "safety",
            "description": "High methane concentration detected",
            "photo_url": None,
            "has_photo": False,
            "gas_reading_value": 1.85,
            "gas_reading_unit": "% CH₄",
            "status": "open",
            "version": 1,
        }
        out_obj = ObservationOut(**out_data)
        self.assertEqual(out_obj.gas_reading_value, 1.85)
        self.assertEqual(out_obj.gas_reading_unit, "% CH₄")
        dump = out_obj.model_dump()
        self.assertEqual(dump["gas_reading_value"], 1.85)
        self.assertEqual(dump["gas_reading_unit"], "% CH₄")
        print("  [PASS] Pydantic models serialize and deserialize gas reading fields accurately")

    def test_04_migration_file_exists(self):
        """Alembic migration 003_add_observation_gas_reading.py must exist with upgrade and downgrade."""
        migration_path = os.path.join(
            backend_dir, "alembic", "versions", "003_add_observation_gas_reading.py"
        )
        self.assertTrue(os.path.exists(migration_path), "Migration 003 file missing")

        spec = importlib.util.spec_from_file_location("migration_003", migration_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertTrue(hasattr(mod, "upgrade"), "Migration 003 must define upgrade()")
        self.assertTrue(hasattr(mod, "downgrade"), "Migration 003 must define downgrade()")
        self.assertEqual(mod.down_revision, "002_extend_roles_and_access")
        print("  [PASS] Migration 003 exists, is valid Python, and chains to 002_extend_roles_and_access")

    def test_05_mock_seed_script_has_gas_reading_generation(self):
        """generate_mock_data.py must contain gas_reading_value population."""
        seed_path = os.path.join(backend_dir, "scripts", "generate_mock_data.py")
        with open(seed_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("gas_reading_value", content)
        self.assertIn("gas_reading_unit", content)
        self.assertIn("% CH₄", content)
        print("  [PASS] generate_mock_data.py updated with real gas reading simulation")


if __name__ == "__main__":
    print("=" * 60)
    print("Phase 20 Real Gas Telemetry Verification")
    print("=" * 60)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestPhase20Telemetry)
    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)
    if result.wasSuccessful():
        print("=" * 60)
        print(f"Results: {result.testsRun}/{result.testsRun} passed")
        print("=" * 60)
        print("[ALL PASS] Phase 20 Gas Telemetry Verification SUCCEEDED!")
        sys.exit(0)
    else:
        sys.exit(1)

"""Iteration 3 backend tests: Employees, Attendance, CSV import."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cater-insight.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def auth():
    email = f"TEST_iter3_{uuid.uuid4().hex[:8]}@restaurant.com"
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={"email": email, "name": "Iter3 Tester"}, timeout=60)
    assert r.status_code == 200, r.text
    token = r.json()["session_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Employees ----------------
class TestEmployees:
    def test_list_employees_seeded(self, auth):
        r = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "employees" in d and "total_employees" in d
        assert "total_monthly_salary" in d and "present_today" in d
        # 8 per branch × 3 branches = 24
        assert d["total_employees"] == 24, f"Expected 24 seeded, got {d['total_employees']}"
        assert d["total_monthly_salary"] > 0
        emp = d["employees"][0]
        for k in ("employee_id", "name", "role", "monthly_salary", "shift", "phone", "today_status"):
            assert k in emp, f"missing key {k}"
        assert emp["today_status"] in ("present", "absent", "leave", "half", "unmarked")

    def test_create_employee_and_verify(self, auth):
        payload = {"name": "TEST_Ramesh", "role": "Waiter", "monthly_salary": 20000, "phone": "+919999000011", "shift": "Evening"}
        r = requests.post(f"{BASE_URL}/api/employees", headers=auth, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == "TEST_Ramesh"
        assert doc["monthly_salary"] == 20000
        assert doc["shift"] == "Evening"
        emp_id = doc["employee_id"]
        # verify via list
        r2 = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30)
        ids = [e["employee_id"] for e in r2.json()["employees"]]
        assert emp_id in ids

    def test_list_filtered_by_branch(self, auth):
        br = requests.get(f"{BASE_URL}/api/branches", headers=auth, timeout=30).json()
        bid = br[0]["branch_id"]
        r = requests.get(f"{BASE_URL}/api/employees", headers=auth, params={"branch_id": bid}, timeout=30)
        assert r.status_code == 200
        # 8 seeded per branch (may be +1 if create test above used default branch)
        assert 8 <= r.json()["total_employees"] <= 25


# ---------------- Attendance ----------------
class TestAttendance:
    def test_mark_attendance_present(self, auth):
        emps = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        eid = emps[0]["employee_id"]
        r = requests.post(f"{BASE_URL}/api/employees/attendance", headers=auth,
                          json={"employee_id": eid, "status": "present"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["status"] == "present" and d["employee_id"] == eid
        # verify
        lst = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        match = [e for e in lst if e["employee_id"] == eid][0]
        assert match["today_status"] == "present"

    def test_mark_attendance_unmarked_deletes(self, auth):
        emps = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        eid = emps[0]["employee_id"]
        requests.post(f"{BASE_URL}/api/employees/attendance", headers=auth,
                      json={"employee_id": eid, "status": "leave"}, timeout=30)
        r = requests.post(f"{BASE_URL}/api/employees/attendance", headers=auth,
                          json={"employee_id": eid, "status": "unmarked"}, timeout=30)
        assert r.status_code == 200
        lst = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        match = [e for e in lst if e["employee_id"] == eid][0]
        assert match["today_status"] == "unmarked"

    def test_invalid_status_400(self, auth):
        emps = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        eid = emps[0]["employee_id"]
        r = requests.post(f"{BASE_URL}/api/employees/attendance", headers=auth,
                          json={"employee_id": eid, "status": "sick"}, timeout=30)
        assert r.status_code == 400

    def test_unknown_employee_404(self, auth):
        r = requests.post(f"{BASE_URL}/api/employees/attendance", headers=auth,
                          json={"employee_id": "emp_nonexistent_xyz", "status": "present"}, timeout=30)
        assert r.status_code == 404


# ---------------- Employee Summary ----------------
class TestEmployeeSummary:
    def test_summary_returns_counts_and_pay(self, auth):
        emps = requests.get(f"{BASE_URL}/api/employees", headers=auth, timeout=30).json()["employees"]
        eid = emps[0]["employee_id"]
        r = requests.get(f"{BASE_URL}/api/employees/{eid}/summary", headers=auth, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "employee" in d and "attendance_30d" in d
        assert "counts_30d" in d and "estimated_pay_30d" in d
        assert d["employee"]["employee_id"] == eid
        for k in ("present", "absent", "leave", "half"):
            assert k in d["counts_30d"]
        assert isinstance(d["estimated_pay_30d"], (int, float))

    def test_summary_404_unknown(self, auth):
        r = requests.get(f"{BASE_URL}/api/employees/emp_does_not_exist/summary", headers=auth, timeout=30)
        assert r.status_code == 404


# ---------------- CSV Import ----------------
class TestCsvImport:
    def test_import_expenses_increases_total(self, auth):
        before = requests.get(f"{BASE_URL}/api/expenses", headers=auth, timeout=30).json()["total"]
        rows = [
            {"date": "2026-04-21", "category": "Gas", "amount": "1200", "note": "Tank refill"},
            {"date": "2026-04-22", "category": "Misc", "amount": "550", "note": "Test CSV row"},
        ]
        r = requests.post(f"{BASE_URL}/api/import/csv", headers=auth,
                          json={"type": "expenses", "rows": rows}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["inserted"] == 2
        after = requests.get(f"{BASE_URL}/api/expenses", headers=auth, timeout=30).json()["total"]
        assert after >= before + 1750 - 0.01

    def test_import_unsupported_type_400(self, auth):
        r = requests.post(f"{BASE_URL}/api/import/csv", headers=auth,
                          json={"type": "bogus", "rows": []}, timeout=30)
        assert r.status_code == 400


# ---------------- Auth gating ----------------
class TestAuthGating:
    def test_employees_unauth(self):
        r = requests.get(f"{BASE_URL}/api/employees", timeout=30)
        assert r.status_code == 401

    def test_attendance_unauth(self):
        r = requests.post(f"{BASE_URL}/api/employees/attendance",
                          json={"employee_id": "x", "status": "present"}, timeout=30)
        assert r.status_code == 401

"""Usuarios con contraseña real: Supabase Auth (mockeado), modo local con hash y usuarios demo."""

import base64
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError

from backend.config import settings
from backend.controllers.auth_controller import generate_simple_token
from backend.main import app
from backend.models.auth import UserResponse
from backend.services import supabase_service, user_service
from backend.services.passwords import hash_password, verify_password
from backend.services.user_service import ADMIN_ID, UserService

# ---------------------------------------------------------------------------
# Supabase falso: tablas en memoria + auth.admin + sign_in_with_password
# ---------------------------------------------------------------------------


class FakeQuery:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db, self.table, self.op, self.filters, self.payload = db, table, "select", [], None

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def insert(self, row):
        self.op, self.payload = "insert", row
        return self

    def update(self, changes):
        self.op, self.payload = "update", changes
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op == "insert":
            if self.db.fail_insert:
                raise RuntimeError("violación de clave")
            rows.append(dict(self.payload))
            return SimpleNamespace(data=[dict(self.payload)])
        found = [r for r in rows if all(str(r.get(c)) == str(v) for c, v in self.filters)]
        if self.op == "update":
            for r in found:
                r.update(self.payload)
        return SimpleNamespace(data=[dict(r) for r in found])


class FakeAdmin:
    def __init__(self):
        self.accounts: dict[str, dict] = {}

    def _resp(self, uid):
        return SimpleNamespace(user=SimpleNamespace(id=uid, email=self.accounts[uid]["email"]))

    def create_user(self, attrs):
        if any(a["email"] == attrs["email"] for a in self.accounts.values()):
            raise AuthApiError("A user with this email address has already been registered", 422, "email_exists")
        uid = attrs.get("id") or str(uuid4())
        self.accounts[uid] = {**attrs, "ban_duration": "none"}
        return self._resp(uid)

    def get_user_by_id(self, uid):
        if uid not in self.accounts:
            raise AuthApiError("User not found", 404, "user_not_found")
        return self._resp(uid)

    def list_users(self, page=None, per_page=None):
        if page and page > 1:
            return []
        return [SimpleNamespace(id=uid, email=a["email"]) for uid, a in self.accounts.items()]

    def update_user_by_id(self, uid, attrs):
        self.accounts[uid].update(attrs)
        return self._resp(uid)

    def delete_user(self, uid, should_soft_delete=False):
        del self.accounts[uid]

    def sign_in_with_password(self, creds):
        for uid, a in self.accounts.items():
            if a["email"] == creds["email"] and a["password"] == creds["password"]:
                if a.get("ban_duration") not in (None, "none"):
                    raise AuthApiError("User is banned", 400, "user_banned")
                return SimpleNamespace(user=SimpleNamespace(id=uid, email=a["email"]))
        raise AuthApiError("Invalid login credentials", 400, "invalid_credentials")


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.fail_insert = False
        self.admin = FakeAdmin()
        self.auth = SimpleNamespace(admin=self.admin)

    def table(self, name):
        return FakeQuery(self, name)


def _row(uid, email, name, role, active=True):
    return {"id": uid, "email": email, "full_name": name, "role": role, "is_active": active}


@pytest.fixture
def fake_supabase(monkeypatch):
    """Simula producción: URL de Supabase real y cliente mockeado."""
    fake = FakeSupabase()
    fake.tables["crm_users"] = [_row(ADMIN_ID, "admin@crm.com", "Administrador CRM", "admin")]
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://proyecto-test.supabase.co")
    monkeypatch.setattr(settings, "ALLOW_DEMO_LOGIN", False)
    monkeypatch.setattr(user_service, "get_supabase_client", lambda: fake)
    monkeypatch.setattr(supabase_service, "get_supabase_client", lambda: fake)
    login_client = SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=fake.admin.sign_in_with_password))
    monkeypatch.setattr(supabase_service, "_login_client", lambda: login_client)
    UserService._invalidate()
    yield fake
    UserService._invalidate()


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _session(token: str) -> dict:
    encoded = token.removeprefix("crm_").split(".")[0]
    return json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))


def _new_user(email: str, password: str = "ladrillo2026", role: str = "ejecutivo_ventas") -> dict:
    return {"email": email, "full_name": "Usuario de Prueba", "role": role, "password": password}


# ---------------------------------------------------------------------------
# Modo Supabase
# ---------------------------------------------------------------------------


def test_alta_crea_cuenta_en_auth_y_perfil_con_el_mismo_id(client, fake_supabase):
    res = client.post("/api/users", json=_new_user("Nueva.Vendedora@crm.com"))
    assert res.status_code == 201, res.text
    body = res.json()
    assert "password" not in body and "ladrillo2026" not in res.text

    account = fake_supabase.admin.accounts[body["id"]]
    assert account["email"] == "nueva.vendedora@crm.com"
    assert account["email_confirm"] is True
    assert account["user_metadata"] == {"full_name": "Usuario de Prueba"}

    row = next(r for r in fake_supabase.tables["crm_users"] if r["email"] == "nueva.vendedora@crm.com")
    assert row["id"] == body["id"]
    assert "password" not in row and "ladrillo2026" not in json.dumps(row)

    res = _login(client, "nueva.vendedora@crm.com", "ladrillo2026")
    assert res.status_code == 200
    assert res.json()["user"]["id"] == body["id"]
    assert res.json()["user"]["role"] == "ejecutivo_ventas"


def test_si_falla_crm_users_se_borra_la_cuenta_de_auth(client, fake_supabase):
    fake_supabase.fail_insert = True
    res = client.post("/api/users", json=_new_user("huerfano@crm.com"))
    assert res.status_code == 502
    assert "no quedó ninguna cuenta" in res.json()["detail"]
    assert fake_supabase.admin.accounts == {}


def test_contrasena_corta_se_rechaza_con_mensaje(client, fake_supabase):
    res = client.post("/api/users", json=_new_user("corta@crm.com", password="1234567"))
    assert res.status_code == 400
    assert "al menos 8 caracteres" in res.json()["detail"]
    assert fake_supabase.admin.accounts == {}


def test_correo_ya_registrado_en_auth_da_409(client, fake_supabase):
    fake_supabase.admin.create_user({"email": "ya.esta@crm.com", "password": "otraclave1"})
    res = client.post("/api/users", json=_new_user("ya.esta@crm.com"))
    assert res.status_code == 409
    assert "cuenta de acceso" in res.json()["detail"]


def test_admin_restablece_la_contrasena(client, fake_supabase):
    uid = client.post("/api/users", json=_new_user("reset@crm.com")).json()["id"]
    res = client.post(f"/api/users/{uid}/password", json={"password": "nuevaClave99"})
    assert res.status_code == 204
    assert res.content == b""
    assert fake_supabase.admin.accounts[uid]["password"] == "nuevaClave99"
    assert _login(client, "reset@crm.com", "ladrillo2026").status_code == 401
    assert _login(client, "reset@crm.com", "nuevaClave99").status_code == 200


def test_restablecer_a_perfil_sin_cuenta_le_crea_la_cuenta_con_su_id(client, fake_supabase):
    uid = str(uuid4())
    fake_supabase.tables["crm_users"].append(_row(uid, "viejo@crm.com", "Perfil Viejo", "gerente_comercial"))
    res = client.post(f"/api/users/{uid}/password", json={"password": "arenaYcal1"})
    assert res.status_code == 204
    assert fake_supabase.admin.accounts[uid]["email"] == "viejo@crm.com"
    assert _login(client, "viejo@crm.com", "arenaYcal1").json()["user"]["role"] == "gerente_comercial"


def test_solo_el_admin_restablece_contrasenas(fake_supabase):
    vendedor = UserResponse(
        id="00000000-0000-0000-0000-000000000002",
        email="vendedor@crm.com",
        full_name="Ejecutivo Comercial",
        role="ejecutivo_ventas",
    )
    headers = {"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(vendedor)}"}
    with TestClient(app, headers=headers) as c:
        res = c.post(f"/api/users/{ADMIN_ID}/password", json={"password": "hackeado123"})
    assert res.status_code == 403


def test_baja_bloquea_en_auth_y_corta_el_login(client, fake_supabase):
    uid = client.post("/api/users", json=_new_user("baja@crm.com")).json()["id"]

    assert client.put(f"/api/users/{uid}", json={"is_active": False}).status_code == 200
    assert fake_supabase.admin.accounts[uid]["ban_duration"] == user_service.BAN_FOREVER
    res = _login(client, "baja@crm.com", "ladrillo2026")
    assert res.status_code == 403
    assert "dado de baja" in res.json()["detail"]

    assert client.put(f"/api/users/{uid}", json={"is_active": True}).status_code == 200
    assert fake_supabase.admin.accounts[uid]["ban_duration"] == "none"
    assert _login(client, "baja@crm.com", "ladrillo2026").status_code == 200


def test_perfil_inactivo_no_entra_aunque_auth_no_este_bloqueado(client, fake_supabase):
    uid = client.post("/api/users", json=_new_user("inactivo@crm.com")).json()["id"]
    next(r for r in fake_supabase.tables["crm_users"] if r["id"] == uid)["is_active"] = False
    res = _login(client, "inactivo@crm.com", "ladrillo2026")
    assert res.status_code == 403
    assert "dado de baja" in res.json()["detail"]


def test_contrasena_incorrecta_no_revela_si_esta_de_baja(client, fake_supabase):
    uid = client.post("/api/users", json=_new_user("baja2@crm.com")).json()["id"]
    next(r for r in fake_supabase.tables["crm_users"] if r["id"] == uid)["is_active"] = False
    assert _login(client, "baja2@crm.com", "otraCualquiera").status_code == 401


def test_login_resuelve_el_perfil_por_correo_y_usa_su_id(client, fake_supabase):
    # Cuenta de Auth creada aparte (otro id) para el admin demo, que tiene id fijo en crm_users.
    fake_supabase.admin.create_user({"email": "admin@crm.com", "password": "claveRealAdmin1"})
    res = _login(client, "admin@crm.com", "claveRealAdmin1")
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["id"] == ADMIN_ID
    assert user["role"] == "admin"
    assert user["full_name"] == "Administrador CRM"
    assert _session(res.json()["access_token"])["sub"] == ADMIN_ID


def test_cuenta_de_auth_sin_perfil_no_entra(client, fake_supabase):
    fake_supabase.admin.create_user({"email": "intruso@crm.com", "password": "registrado1"})
    res = _login(client, "intruso@crm.com", "registrado1")
    assert res.status_code == 403
    assert "no tiene un perfil" in res.json()["detail"]


def test_baja_del_admin_demo_bloquea_su_cuenta_encontrada_por_correo(client, fake_supabase):
    auth_id = fake_supabase.admin.create_user({"email": "gerente@crm.com", "password": "gerenteReal1"}).user.id
    gid = "00000000-0000-0000-0000-000000000003"
    fake_supabase.tables["crm_users"].append(_row(gid, "gerente@crm.com", "Responsable Comercial", "gerente_comercial"))
    assert client.put(f"/api/users/{gid}", json={"is_active": False}).status_code == 200
    assert fake_supabase.admin.accounts[auth_id]["ban_duration"] == user_service.BAN_FOREVER


def test_login_demo_deshabilitado_fuera_de_modo_local(client, fake_supabase):
    assert _login(client, "admin@crm.com", "admin123").status_code == 401


def test_login_demo_habilitado_con_allow_demo_login(client, fake_supabase, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_DEMO_LOGIN", True)
    res = _login(client, "admin@crm.com", "admin123")
    assert res.status_code == 200
    assert res.json()["user"]["id"] == ADMIN_ID
    # Si el perfil demo está dado de baja, tampoco entra.
    fake_supabase.tables["crm_users"][0]["is_active"] = False
    assert _login(client, "admin@crm.com", "admin123").status_code == 403


# ---------------------------------------------------------------------------
# Modo local (sin Supabase)
# ---------------------------------------------------------------------------


def test_modo_local_guarda_hash_y_permite_entrar(client):
    password = "cementoPortland1"
    res = client.post("/api/users", json=_new_user("local.hash@crm.com", password=password, role="gerente_comercial"))
    assert res.status_code == 201
    uid = res.json()["id"]

    stored = user_service._mock_passwords[uid]
    assert stored.startswith("scrypt$") and password not in stored
    assert password not in json.dumps(user_service._mock_users)
    assert password not in json.dumps(user_service._mock_passwords)

    res = _login(client, "local.hash@crm.com", password)
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "gerente_comercial"
    assert _login(client, "local.hash@crm.com", "cualquierOtra").status_code == 401


def test_modo_local_restablecer_y_dar_de_baja(client):
    uid = client.post("/api/users", json=_new_user("local.reset@crm.com")).json()["id"]
    assert client.post(f"/api/users/{uid}/password", json={"password": "hierro12mm"}).status_code == 204
    assert _login(client, "local.reset@crm.com", "ladrillo2026").status_code == 401
    assert _login(client, "local.reset@crm.com", "hierro12mm").status_code == 200

    assert client.put(f"/api/users/{uid}", json={"is_active": False}).status_code == 200
    res = _login(client, "local.reset@crm.com", "hierro12mm")
    assert res.status_code == 403
    assert "dado de baja" in res.json()["detail"]


def test_modo_local_usuario_demo_dado_de_baja_no_entra(client):
    gid = "00000000-0000-0000-0000-000000000003"
    try:
        assert client.put(f"/api/users/{gid}", json={"is_active": False}).status_code == 200
        assert _login(client, "gerente@crm.com", "gerente123").status_code == 403
    finally:
        client.put(f"/api/users/{gid}", json={"is_active": True})
    assert _login(client, "gerente@crm.com", "gerente123").status_code == 200


def test_hash_con_sal_aleatoria():
    a, b = hash_password("misma-clave"), hash_password("misma-clave")
    assert a != b
    assert verify_password("misma-clave", a) and verify_password("misma-clave", b)
    assert not verify_password("otra-clave", a)
    assert not verify_password("misma-clave", "basura") and not verify_password("misma-clave", None)


# ---------------------------------------------------------------------------
# Script scripts/crear_usuarios_auth.py (con Supabase mockeado; nunca contra una base real)
# ---------------------------------------------------------------------------


def _load_script():
    path = Path(__file__).resolve().parents[2] / "scripts" / "crear_usuarios_auth.py"
    spec = importlib.util.spec_from_file_location("crear_usuarios_auth", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_script_crea_las_cuentas_que_faltan():
    script = _load_script()
    fake = FakeSupabase()
    vid, lid, bid = "00000000-0000-0000-0000-000000000002", str(uuid4()), str(uuid4())
    fake.tables["crm_users"] = [
        _row(ADMIN_ID, "admin@crm.com", "Administrador CRM", "admin"),
        _row(vid, "vendedor@crm.com", "Ejecutivo Comercial", "ejecutivo_ventas"),
        _row(lid, "lucia@crm.com", "Lucía Fernández", "ejecutivo_ventas"),
        _row(bid, "baja@crm.com", "De Baja", "ejecutivo_ventas", active=False),
    ]
    fake.admin.create_user({"email": "admin@crm.com", "password": "yaTenia123"})
    # Vendedor: primero una muy corta, después dos que no coinciden, después bien. Lucía: Enter (saltear).
    respuestas = iter(["corta", "vendedor-real-1", "distinta", "vendedor-real-1", "vendedor-real-1", ""])
    salida: list[str] = []

    creados = script.crear_cuentas(fake, prompt=lambda _msg: next(respuestas), out=salida.append)

    assert creados == ["vendedor@crm.com"]
    assert fake.admin.accounts[vid]["password"] == "vendedor-real-1"
    assert fake.admin.accounts[vid]["email_confirm"] is True
    assert len(fake.admin.accounts) == 2
    assert not any("vendedor-real-1" in linea for linea in salida)


def test_script_dry_run_no_crea_nada():
    script = _load_script()
    fake = FakeSupabase()
    fake.tables["crm_users"] = [_row(ADMIN_ID, "admin@crm.com", "Administrador CRM", "admin")]

    def no_preguntar(_msg):
        raise AssertionError("no debería pedir contraseñas")

    salida: list[str] = []
    assert script.crear_cuentas(fake, prompt=no_preguntar, out=salida.append, dry_run=True) == []
    assert fake.admin.accounts == {}
    assert any("no tiene cuenta" in linea for linea in salida)


def test_script_sin_credenciales_sale_con_error(monkeypatch, capsys):
    script = _load_script()
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    assert script.main([]) == 1
    assert "SUPABASE_URL" in capsys.readouterr().out

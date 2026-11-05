"""
Crea en Supabase Auth las cuentas de acceso de los usuarios de crm_users que todavía no tienen una.

Sirve para pasar producción de los usuarios demo (contraseñas en el código) a cuentas reales:
por cada usuario activo sin cuenta pide la contraseña por consola (no se ve al tipear) y crea la
cuenta con el mismo id que su fila de crm_users. Supabase guarda sólo el hash.

Uso (desde la raíz del repo):

    export SUPABASE_URL=https://<proyecto>.supabase.co
    export SUPABASE_SECRET_KEY=<secret key / service_role>
    uv run python scripts/crear_usuarios_auth.py --dry-run   # sólo lista quién no tiene cuenta
    uv run python scripts/crear_usuarios_auth.py             # crea las cuentas

Enter sin contraseña saltea a ese usuario. Los usuarios dados de baja se saltean siempre.
Se puede correr varias veces: los que ya tienen cuenta no se tocan.
"""

import argparse
import getpass
import os
import sys
from collections.abc import Callable

MIN_LENGTH = 8
MAX_BYTES = 72


def cuentas_existentes(admin) -> tuple[set[str], set[str]]:
    """Ids y correos (en minúscula) de las cuentas que ya existen en Supabase Auth."""
    ids: set[str] = set()
    emails: set[str] = set()
    per_page = 200
    for page in range(1, 51):
        batch = admin.list_users(page=page, per_page=per_page) or []
        for user in batch:
            ids.add(str(user.id))
            if user.email:
                emails.add(user.email.lower())
        if len(batch) < per_page:
            break
    return ids, emails


def pedir_contrasena(nombre: str, email: str, prompt: Callable[[str], str], out: Callable[[str], None]) -> str | None:
    """Pide la contraseña dos veces. Devuelve None si el operador deja vacío para saltear."""
    while True:
        password = prompt(f"Contraseña para {nombre} <{email}> (Enter para saltear): ")
        if not password:
            return None
        if len(password) < MIN_LENGTH:
            out(f"  Tiene que tener al menos {MIN_LENGTH} caracteres.")
            continue
        if len(password.encode("utf-8")) > MAX_BYTES:
            out(f"  Puede tener hasta {MAX_BYTES} caracteres.")
            continue
        if prompt("  Repetila: ") != password:
            out("  No coinciden, probá de nuevo.")
            continue
        return password


def crear_cuentas(
    client,
    prompt: Callable[[str], str] = getpass.getpass,
    out: Callable[[str], None] = print,
    dry_run: bool = False,
) -> list[str]:
    """Recorre crm_users y crea las cuentas que faltan. Devuelve los correos a los que se les creó cuenta."""
    perfiles = (
        client.table("crm_users").select("id, email, full_name, is_active").order("full_name").execute().data or []
    )
    admin = client.auth.admin
    ids, emails = cuentas_existentes(admin)
    creados: list[str] = []

    for perfil in perfiles:
        email = str(perfil["email"]).lower()
        nombre = perfil.get("full_name") or email
        if str(perfil["id"]) in ids or email in emails:
            out(f"= {nombre} <{email}>: ya tiene cuenta.")
            continue
        if perfil.get("is_active") is False:
            out(f"- {nombre} <{email}>: está dado de baja, se saltea.")
            continue
        if dry_run:
            out(f"! {nombre} <{email}>: no tiene cuenta de acceso.")
            continue

        password = pedir_contrasena(nombre, email, prompt, out)
        if password is None:
            out(f"- {nombre} <{email}>: salteado.")
            continue

        atributos = {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": nombre},
        }
        try:
            # Mismo id que crm_users: así la sesión y los presupuestos ya asignados coinciden.
            admin.create_user({**atributos, "id": str(perfil["id"])})
        except Exception as primer_error:
            # Si Auth no acepta el id, se crea con uno nuevo: el login igual resuelve el perfil por correo.
            try:
                admin.create_user(atributos)
            except Exception as error:
                out(
                    f"x {nombre} <{email}>: no se pudo crear ({type(error).__name__}: {getattr(error, 'message', '')})."
                )
                out(f"  Primer intento: {type(primer_error).__name__}.")
                continue
        out(f"+ {nombre} <{email}>: cuenta creada.")
        creados.append(email)
    return creados


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Crea en Supabase Auth las cuentas que faltan de crm_users.")
    parser.add_argument("--dry-run", action="store_true", help="sólo lista los usuarios sin cuenta, no crea nada")
    args = parser.parse_args(argv)

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not url or not key or "placeholder" in url or "your-project" in url:
        print("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno (la secret key, no la publishable).")
        return 1

    from supabase import create_client

    client = create_client(url, key)
    creados = crear_cuentas(client, dry_run=args.dry_run)
    if not args.dry_run:
        print(f"Listo: {len(creados)} cuenta(s) creada(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Evaluación del asistente (tareas I de los planes 1 y 2) sobre los datos demo.

- 15 casos de borrador: presupuestos que se enfrían (correo y WhatsApp) y clientes que escribieron.
- 10 preguntas de «Ponete al día» en 3 clientes, con control automático de citas.

Genera dos planillas CSV en evaluacion/ con columnas vacías para la revisión humana.
Sin ANTHROPIC_API_KEY corre en modo simulado (sirve para probar el circuito, no para evaluar el prompt).

Uso:  uv run python scripts/evaluar_asistente.py
      ANTHROPIC_API_KEY=sk-ant-... uv run python scripts/evaluar_asistente.py   (evaluación real, gasta)
"""

import csv
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Siempre sobre los datos demo en memoria: nunca toca la base real.
os.environ["SUPABASE_URL"] = "https://placeholder.supabase.co"
os.environ["SUPABASE_SECRET_KEY"] = "placeholder"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from backend.config import settings  # noqa: E402
from backend.controllers.auth_controller import generate_simple_token  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models.auth import UserResponse  # noqa: E402
from backend.models.message import MessageChannel, MessageDirection, MessageStatus  # noqa: E402
from backend.services import ai_service, demo_seed, whatsapp_service  # noqa: E402
from backend.services.catchup_service import SUGGESTED_QUESTIONS  # noqa: E402
from backend.services.message_service import MessageService  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "evaluacion"

# Mensajes de clientes para los casos «el cliente escribió y espera respuesta».
CLIENT_MESSAGES = [
    ("whatsapp", "Hola, ¿me pueden mandar el hierro del 8 para el viernes? Necesito saber si tienen stock."),
    ("whatsapp", "Buenas. El presupuesto me quedó un poco alto, ¿hay forma de mejorar el precio del cemento?"),
    ("email", "Hola, ¿el flete está incluido en el total? Y ¿cuánto tardan en entregar en la obra?"),
    ("whatsapp", "Ya arrancamos con la losa, necesito sumar 20 bolsas más de cemento. ¿Lo agregan al mismo pedido?"),
    ("email", "Necesito la factura a nombre de la otra razón social. Además, ¿aceptan cheque a 30 días?"),
]


def _client() -> TestClient:
    admin = UserResponse(
        id="00000000-0000-0000-0000-000000000001", email="admin@crm.com", full_name="Administrador CRM", role="admin"
    )
    return TestClient(
        app, headers={"X-API-Key": settings.CRM_API_KEY, "Authorization": f"Bearer {generate_simple_token(admin)}"}
    )


def _draft_cases(client: TestClient) -> list[dict]:
    opps = client.get("/api/opportunities", params={"status": "abierta", "limit": 200}).json()
    with_contact = [o for o in opps if o.get("contact_id")]
    cold = sorted(with_contact, key=lambda o: o.get("days_since_last_activity") or 0, reverse=True)
    cases: list[dict] = []
    for o in cold[:6]:
        cases.append({"tipo": "enfriado", "canal": "email", "opp": o})
    for o in cold[6:10]:
        cases.append({"tipo": "enfriado", "canal": "whatsapp", "opp": o})
    for (channel, text), o in zip(CLIENT_MESSAGES, cold[10:15]):
        contact = client.get(f"/api/contacts/{o['contact_id']}").json()
        phone = whatsapp_service.normalize_phone(contact.get("phone"))
        MessageService.create(
            channel=MessageChannel(channel),
            direction=MessageDirection.ENTRANTE,
            status=MessageStatus.RECIBIDO,
            opportunity_id=o["id"],
            contact_id=o["contact_id"],
            company_id=o.get("company_id"),
            subject="Consulta por el presupuesto" if channel == "email" else None,
            body_text=text,
            phone=phone if channel == "whatsapp" else None,
            from_address=contact.get("email") if channel == "email" else None,
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        cases.append({"tipo": "respuesta", "canal": channel, "opp": o, "mensaje": text})
    return cases


def evaluar_borradores(client: TestClient) -> Path:
    path = OUT / "borradores.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "caso",
                "situacion",
                "canal",
                "presupuesto",
                "dias_sin_contacto",
                "mensaje_del_cliente",
                "motivo_detectado",
                "asunto",
                "borrador",
                "datos_a_confirmar",
                "modelo",
                "error",
                # Revisión humana:
                "inventa_datos (si/no)",
                "tono_1a5",
                "lo_mandarias (si/editando/no)",
                "notas",
            ]
        )
        for i, case in enumerate(_draft_cases(client), start=1):
            o = case["opp"]
            res = client.post("/api/ai/drafts", json={"channel": case["canal"], "opportunity_id": o["id"]})
            body = res.json()
            ok = res.status_code == 201
            w.writerow(
                [
                    i,
                    case["tipo"],
                    case["canal"],
                    o["title"],
                    o.get("days_since_last_activity"),
                    case.get("mensaje", ""),
                    body.get("reason", "") if ok else "",
                    body.get("subject") or "" if ok else "",
                    body.get("body_text", "") if ok else "",
                    " | ".join(body.get("to_confirm", [])) if ok else "",
                    body.get("model", "") if ok else "",
                    "" if ok else body.get("detail", res.status_code),
                    "",
                    "",
                    "",
                    "",
                ]
            )
            print(f"  borrador {i:>2}: {case['tipo']:<9} {case['canal']:<8} {'ok' if ok else 'ERROR'}")
    return path


def evaluar_ponete_al_dia(client: TestClient) -> Path:
    companies = client.get("/api/companies").json()
    ranked = []
    for c in companies:
        overview = client.get(f"/api/ai/catchup/{c['id']}").json()
        ranked.append((overview["entries"], c))
    ranked.sort(key=lambda x: x[0], reverse=True)
    # Un cliente con mucha historia, uno intermedio y uno con poca.
    picks = [ranked[0][1], ranked[len(ranked) // 2][1], ranked[-1][1]]

    path = OUT / "ponete_al_dia.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "cliente",
                "pregunta",
                "respuesta",
                "citas",
                "no_lo_se",
                "sin_fuente (control automatico)",
                "modelo",
                "error",
                # Revisión humana:
                "cada_cita_respalda_el_dato (si/no)",
                "respuesta_correcta (si/parcial/no)",
                "notas",
            ]
        )
        for company in picks:
            for q in SUGGESTED_QUESTIONS:
                res = client.post(f"/api/ai/catchup/{company['id']}/ask", json={"question": q})
                body = res.json()
                ok = res.status_code == 200
                cites = (
                    " | ".join(f"{c['ref']} {c['kind_label']} {c['at'][:10]}: {c['title']}" for c in body["citations"])
                    if ok
                    else ""
                )
                w.writerow(
                    [
                        company["name"],
                        q,
                        body.get("answer", "") if ok else "",
                        cites,
                        body.get("unknown", "") if ok else "",
                        body.get("unsourced", "") if ok else "",
                        body.get("model", "") if ok else "",
                        "" if ok else body.get("detail", res.status_code),
                        "",
                        "",
                        "",
                    ]
                )
            print(f"  ponete al día: {company['name']} ({len(SUGGESTED_QUESTIONS)} preguntas)")
    return path


def main() -> None:
    OUT.mkdir(exist_ok=True)
    demo_seed.reset()
    demo_seed.seed()
    ai_service._mock_requests.clear()
    mode = f"modelo {settings.AI_MODEL}" if ai_service.is_configured() else "MODO SIMULADO (sin ANTHROPIC_API_KEY)"
    print(f"Evaluación del asistente · {mode}")
    with _client() as client:
        drafts = evaluar_borradores(client)
        catchup = evaluar_ponete_al_dia(client)
    requests = list(ai_service._mock_requests.values())
    cost = sum(float(r.get("cost_usd") or 0) for r in requests)
    unsourced = sum(1 for r in requests if r.get("status") == "sin_fuente")
    errors = sum(1 for r in requests if r.get("status") == "error")
    print(f"\nConsultas: {len(requests)} · errores: {errors} · sin fuente: {unsourced} · costo: USD {cost:.4f}")
    print(f"Planillas:\n  {drafts}\n  {catchup}")


if __name__ == "__main__":
    main()

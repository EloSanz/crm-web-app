"""
Datos de demostración para el modo local (sin Supabase).

Arma un año de actividad creíble de un corralón: empresas, contactos, obras y presupuestos con su
recorrido por el embudo (fechas reales en el pasado), renegociaciones con versiones, descuentos,
seguimiento con llamadas / WhatsApp / visitas y cierres ganados o perdidos. Sirve para ver los
indicadores con datos, no sólo con lo cargado a mano en el día.
"""

import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from backend.config import settings
from backend.controllers.opportunity_controller import list_stages
from backend.models.opportunity import OpportunityItemCreate
from backend.services import (
    activity_service,
    company_service,
    contact_service,
    opportunity_service,
    project_service,
    stage_history_service,
    user_service,
)
from backend.services.product_service import ProductService

SELLERS = [
    {"id": user_service.VENDEDOR_ID, "name": "Ejecutivo Comercial", "pace": 1.0},
    {"id": "00000000-0000-0000-0000-000000000004", "name": "Lucía Fernández", "pace": 0.7, "email": "lucia@crm.com"},
    {"id": "00000000-0000-0000-0000-000000000005", "name": "Martín Sosa", "pace": 1.6, "email": "martin@crm.com"},
]

COMPANIES = [
    ("Gómez Construcciones SRL", "30-71234567-8", "Edificios en altura", "cliente", "Cliente existente / recompra"),
    (
        "Desarrollos Urbanos del Oeste SA",
        "30-70998812-3",
        "Barrios cerrados y viviendas",
        "cliente",
        "Recomendación de otro contratista",
    ),
    (
        "Hormigonera & Estructuras San Martín",
        "30-65544321-0",
        "Estructuras de hormigón",
        "potencial",
        "Prospección propia",
    ),
    ("Refacciones & Obras Civiles Morón", "30-71111222-5", "Refacciones", "cliente", "Vino al local (mostrador)"),
    ("Constructora Alvear SRL", "30-70555666-1", "Edificios residenciales", "inactivo", "Redes sociales"),
    ("Techos del Sur SRL", "30-71888444-2", "Cubiertas y techos", "cliente", "Página web"),
    (
        "Arquitectura Haedo Estudio",
        "30-71777333-9",
        "Dirección de obra",
        "potencial",
        "Recomendación de otro contratista",
    ),
    ("Pisos & Revestimientos Castelar", "30-70444111-6", "Terminaciones", "cliente", "Publicidad"),
    ("Obras Públicas Ituzaingó SA", "30-70222999-4", "Obra pública", "potencial", "Prospección propia"),
    (
        "Constructora Río de la Plata SA",
        "30-71333555-7",
        "Naves industriales",
        "cliente",
        "Cliente existente / recompra",
    ),
]

PEOPLE = [
    ("Carlos", "Benítez"),
    ("Marta", "Iglesias"),
    ("Héctor", "Ledesma"),
    ("Silvia", "Paredes"),
    ("Jorge", "Quiroga"),
    ("Paula", "Domínguez"),
    ("Ramón", "Acosta"),
    ("Laura", "Vera"),
    ("Diego", "Maidana"),
    ("Natalia", "Ríos"),
    ("Oscar", "Cabrera"),
    ("Gabriela", "Luna"),
    ("Walter", "Figueroa"),
    ("Verónica", "Sánchez"),
    ("Luis", "Correa"),
    ("Andrea", "Ojeda"),
]
ROLES = [
    "Maestro Mayor de Obra",
    "Contratista General",
    "Capataz de Obra",
    "Arquitecto / Director de Obra",
    "Jefe de Compras",
]

PROJECTS = [
    ("Torre Belgrano 450", "Av. Belgrano 450, Ramos Mejía", "edificio_multifamiliar"),
    ("Lote 42 · Barrio Los Álamos", "Ruta 7 km 38, Moreno", "vivienda_unifamiliar"),
    ("Nave Logística Parque Norte", "Calle 95 N° 2231, San Martín", "comercial_industrial"),
    ("Club Alem · vestuarios", "Alem 1450, Morón", "refaccion"),
    ("Edificio Mitre 870", "Mitre 870, Haedo", "edificio_multifamiliar"),
    ("Casa Ledesma", "Los Aromos 233, Castelar", "vivienda_unifamiliar"),
    ("Plaza Ituzaingó · senderos", "Av. Ratti 1200, Ituzaingó", "obra_publica"),
    ("Local Rivadavia 17.500", "Av. Rivadavia 17500, Haedo", "comercial_industrial"),
]

TITLES = [
    "Cemento y hierros",
    "Losa y columnas",
    "Mampostería planta baja",
    "Contrapiso y carpeta",
    "Techo de chapa",
    "Revoques y cal",
    "Platea de fundación",
    "Ladrillos y arena",
    "Hormigón y encofrado",
    "Caños y cámaras",
]
LOSS_REASONS = [
    "Precio / Presupuesto más caro",
    "Plazo de entrega prolongado",
    "Eligió otro corralón competidor",
    "Obra frenada o postergada",
    "Falta de respuesta del contratista",
]
ACTIVITY_TEXT = {
    "llamada": [
        "Llamó para confirmar cantidades",
        "Consultó plazos de entrega",
        "Pidió actualizar precios",
        "Confirmó la losa para el lunes",
    ],
    "whatsapp": [
        "Mandó fotos del avance de obra",
        "Preguntó si hay stock de hierro",
        "Pidió el presupuesto por WhatsApp",
        "Confirmó dirección de entrega",
    ],
    "visita_obra": ["Visita a la obra: se midió la platea", "Se revisó el acceso para la hidrogrúa"],
    "mostrador": ["Pasó por el local a ver muestras", "Retiró una parte en el mostrador"],
    "email": ["Correo enviado con el presupuesto", "Envió el plano de la estructura"],
    "presupuesto": ["Presupuesto enviado por correo", "Se reenvió el presupuesto actualizado"],
    "reunion": ["Reunión con el arquitecto de la obra"],
    "nota": ["Espera la aprobación del dueño", "Compara con otro corralón"],
}
ACTIVITY_WEIGHTS = {
    "llamada": 5,
    "whatsapp": 6,
    "visita_obra": 2,
    "mostrador": 1,
    "email": 2,
    "presupuesto": 2,
    "reunion": 1,
    "nota": 1,
}

# Días promedio en cada etapa abierta (posición 1 a 4) antes de avanzar.
STAGE_DAYS = {1: 3, 2: 5, 3: 8, 4: 6}


def is_local_mode() -> bool:
    url = (settings.SUPABASE_URL or "").lower()
    return not url or "placeholder" in url or "your-project" in url


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def reset() -> None:
    for store in (
        company_service._mock_companies,
        contact_service._mock_contacts,
        project_service._mock_projects,
        opportunity_service._mock_opportunities,
        opportunity_service._mock_items,
        opportunity_service._mock_versions,
        activity_service._mock_activities,
        stage_history_service._mock_stage_history,
    ):
        store.clear()


def seed(seed_value: int = 20260922) -> dict:
    """Carga los datos de demostración en los almacenes locales y devuelve cuántos registros quedaron."""
    rng = random.Random(seed_value)
    now = datetime.now(timezone.utc)
    stages = sorted(list_stages(), key=lambda s: s["position"])
    open_stages = [s for s in stages if not s["is_closed_won"] and not s["is_closed_lost"]]
    won_stage = next(s for s in stages if s["is_closed_won"])
    lost_stage = next(s for s in stages if s["is_closed_lost"])
    products = ProductService.get_products(limit=500)

    # Vendedores extra del equipo
    for s in SELLERS[1:]:
        user_service._mock_users.setdefault(
            s["id"],
            {
                "id": s["id"],
                "email": s["email"],
                "full_name": s["name"],
                "role": "ejecutivo_ventas",
                "is_active": True,
                "created_at": _iso(now - timedelta(days=400)),
                "updated_at": _iso(now - timedelta(days=400)),
            },
        )
    user_service.UserService._invalidate()

    companies = []
    for name, cuit, industry, status, origin in COMPANIES:
        cid = str(uuid4())
        created = now - timedelta(days=rng.randint(200, 420))
        company_service._mock_companies[cid] = {
            "id": cid,
            "name": name,
            "cuit": cuit,
            "industry": industry,
            "email": f"compras@{name.split()[0].lower().replace('&', '')}.com.ar",
            "phone": f"+54 11 4{rng.randint(100, 999)}-{rng.randint(1000, 9999)}",
            "address": rng.choice(["Ramos Mejía", "Morón", "Haedo", "Castelar", "Ituzaingó", "San Martín", "Moreno"]),
            "website": None,
            "status": status,
            "origin": origin,
            "notes": None,
            "assigned_to": rng.choice(SELLERS)["id"],
            "is_deleted": False,
            "deleted_at": None,
            "created_by": user_service.ADMIN_ID,
            "created_at": _iso(created),
            "updated_at": _iso(created),
        }
        companies.append({"id": cid, "name": name, "status": status})

    contacts = []
    for i, (first, last) in enumerate(PEOPLE):
        kid = str(uuid4())
        company = companies[i % len(companies)] if i < 12 else None
        created = now - timedelta(days=rng.randint(120, 400))
        contact_service._mock_contacts[kid] = {
            "id": kid,
            "company_id": company["id"] if company else None,
            "first_name": first,
            "last_name": last,
            "document_number": f"{rng.randint(20, 45)}.{rng.randint(100, 999)}.{rng.randint(100, 999)}",
            "email": f"{first.lower()}.{last.lower()}@obras.com.ar".replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o"),
            "phone": f"+54 9 11 {rng.randint(3000, 6999)}-{rng.randint(1000, 9999)}",
            "job_title": "Particular / Dueño de Obra" if not company else rng.choice(ROLES),
            "status": "cliente" if rng.random() < 0.6 else "potencial",
            "origin": rng.choice(["Vino al local (mostrador)", "Recomendación de otro contratista", "Redes sociales"]),
            "notes": None,
            "assigned_to": None,
            "created_by": user_service.ADMIN_ID,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": _iso(created),
            "updated_at": _iso(created),
        }
        contacts.append({"id": kid, "company_id": company["id"] if company else None, "name": f"{first} {last}"})

    projects = []
    for i, (name, address, ptype) in enumerate(PROJECTS):
        pid = str(uuid4())
        company = companies[i % len(companies)]
        created = now - timedelta(days=rng.randint(60, 360))
        project_service._mock_projects[pid] = {
            "id": pid,
            "name": name,
            "company_id": company["id"],
            "contact_id": None,
            "company_name": company["name"],
            "contact_name": None,
            "address": address,
            "project_type": ptype,
            "status": rng.choice(["en_curso", "en_curso", "planificacion", "frenada", "finalizada"]),
            "observations": None,
            "opportunities_count": 0,
            "is_deleted": False,
            "created_at": _iso(created),
            "updated_at": _iso(created),
        }
        projects.append({"id": pid, "name": name, "company_id": company["id"], "address": address})

    active_companies = [c for c in companies if c["status"] != "inactivo"]
    stats = {"presupuestos": 0, "actividades": 0, "hitos": 0, "versiones": 0}

    for n in range(56):
        seller = rng.choices(SELLERS, weights=[5, 4, 3])[0]
        recent = rng.random() < 0.5
        created = now - timedelta(days=rng.randint(1, 40) if recent else rng.randint(40, 340), hours=rng.randint(0, 9))
        opp_id = uuid4()
        company = rng.choice(active_companies)
        company_contacts = [c for c in contacts if c["company_id"] == company["id"]]
        project = next((p for p in projects if p["company_id"] == company["id"]), None) if rng.random() < 0.7 else None

        # Materiales: entre 2 y 5 renglones del catálogo, con escala mayorista cuando corresponde.
        chosen = rng.sample(products, k=min(len(products), rng.randint(2, 5)))
        item_objs = []
        for p in chosen:
            qty = Decimal(str(rng.choice([4, 6, 10, 20, 30, 50, 60, 80, 120, 200])))
            unit_price = Decimal(str(p.unit_price))
            tier = "minorista"
            if p.wholesale_price and p.wholesale_min_qty and qty >= Decimal(str(p.wholesale_min_qty)):
                unit_price, tier = Decimal(str(p.wholesale_price)), "mayorista"
            item_objs.append(
                OpportunityItemCreate(
                    product_id=p.id,
                    product_name=p.name,
                    unit=p.unit,
                    quantity=qty,
                    unit_price=unit_price,
                    list_price=Decimal(str(p.unit_price)),
                    price_tier=tier,
                    discount_pct=Decimal(str(rng.choice([0, 0, 0, 5]))),
                )
            )

        # Recorrido por el embudo con fechas reales; cada vendedor tiene su ritmo (y su cuello de botella).
        t = created
        path = [(open_stages[0], t)]
        elapsed_limit = now - timedelta(hours=2)
        final = None
        for stage in open_stages[1:]:
            base = STAGE_DAYS[path[-1][0]["position"]] * seller["pace"]
            if seller["id"] == SELLERS[2]["id"] and path[-1][0]["position"] == 2:
                base *= 2.4  # Martín tarda en preparar presupuestos
            step = timedelta(days=max(0.4, rng.gauss(base, base * 0.35)))
            if t + step > elapsed_limit:
                break
            t = t + step
            path.append((stage, t))
        age_days = (now - created).days
        if len(path) == len(open_stages) and age_days > 20 and rng.random() < 0.8:
            close_step = timedelta(days=max(1.0, rng.gauss(STAGE_DAYS[4] * seller["pace"], 2)))
            if t + close_step < elapsed_limit:
                t = t + close_step
                win = rng.random() < (0.62 if seller["pace"] < 1 else 0.5 if seller["pace"] == 1 else 0.35)
                final = (won_stage if win else lost_stage, t)
        elif age_days > 45 and rng.random() < 0.35:
            t = t + timedelta(days=rng.randint(2, 10))
            if t < elapsed_limit:
                final = (lost_stage, t)

        # Renegociación en la etapa de negociación: sumaron materiales y se hizo un descuento.
        renegotiated = len(path) >= 4 and rng.random() < 0.45
        discount = Decimal(str(rng.choice([0, 0, 3, 5]))) if not renegotiated else Decimal("0")
        items_v1, subtotal_v1 = opportunity_service.OpportunityService._build_items(opp_id, item_objs, created)
        total_v1 = opportunity_service.OpportunityService._total(subtotal_v1, discount)
        opportunity_service.OpportunityService._save_version(
            opp_id, 1, items_v1, subtotal_v1, discount, total_v1, seller["id"], None, created
        )
        items_now, total_now, version, discount_now = items_v1, total_v1, 1, discount
        if renegotiated:
            at = path[3][1] + timedelta(days=1)
            bigger = [it.model_copy(update={"quantity": it.quantity * Decimal("1.5")}) for it in item_objs]
            discount_now = Decimal(str(rng.choice([5, 7, 10])))
            items_now, subtotal_v2 = opportunity_service.OpportunityService._build_items(opp_id, bigger, at)
            total_now = opportunity_service.OpportunityService._total(subtotal_v2, discount_now)
            version = 2
            opportunity_service.OpportunityService._save_version(
                opp_id,
                2,
                items_now,
                subtotal_v2,
                discount_now,
                total_now,
                seller["id"],
                rng.choice(["Sumaron la platea", "Agregaron el segundo piso", "Pidieron mejor precio por volumen"]),
                at,
            )
            stats["versiones"] += 1

        stage_now, status = path[-1][0], "abierta"
        loss_reason = None
        if final:
            stage_now = final[0]
            status = "ganada" if final[0]["is_closed_won"] else "perdida"
            loss_reason = rng.choice(LOSS_REASONS) if status == "perdida" else None

        title = f"{rng.choice(TITLES)} · {project['name'] if project else company['name'].split()[0]}"
        opportunity_service._mock_opportunities[str(opp_id)] = {
            "id": str(opp_id),
            "title": title,
            "company_id": company["id"],
            "contact_id": rng.choice(company_contacts)["id"] if company_contacts else None,
            "project_id": project["id"] if project else None,
            "assigned_to": seller["id"],
            "stage_id": stage_now["id"],
            "status": status,
            "estimated_value": float(total_now),
            "currency": "ARS",
            "expected_close_date": (created + timedelta(days=30)).date().isoformat(),
            "delivery_location": project["address"] if project else None,
            "loss_reason": loss_reason,
            "discount_pct": float(discount_now),
            "current_version": version,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": _iso(created),
            "updated_at": _iso(final[1] if final else path[-1][1]),
        }
        opportunity_service._mock_items[str(opp_id)] = items_now
        stats["presupuestos"] += 1

        # Hitos de etapa
        previous = None
        for stage, at in path + ([final] if final else []):
            hid = str(uuid4())
            stage_history_service._mock_stage_history[hid] = {
                "id": hid,
                "opportunity_id": str(opp_id),
                "from_stage_id": previous["id"] if previous else None,
                "to_stage_id": stage["id"],
                "changed_by": seller["id"],
                "notes": f"Motivo: {loss_reason}" if stage is lost_stage and loss_reason else None,
                "created_at": _iso(at),
            }
            previous = stage
            stats["hitos"] += 1

        # Seguimiento: contactos cada pocos días mientras está abierto; los abiertos quedan con salud variada.
        end = final[1] if final else now
        cursor = created + timedelta(hours=rng.randint(1, 30))
        if not final:
            end = max(cursor + timedelta(hours=1), now - timedelta(days=rng.choice([0, 1, 2, 4, 6, 9, 12, 16, 22])))
        while cursor < end:
            kind = rng.choices(list(ACTIVITY_WEIGHTS), weights=list(ACTIVITY_WEIGHTS.values()))[0]
            aid = str(uuid4())
            attachments = []
            if kind in ("whatsapp", "visita_obra") and rng.random() < 0.3:
                attachments = [
                    {
                        "url": f"https://example.invalid/crm/adjuntos/{aid[:8]}-{k}.jpg",
                        "name": f"obra-{k + 1}.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 240_000,
                    }
                    for k in range(rng.randint(1, 3))
                ]
            activity_service._mock_activities[aid] = {
                "id": aid,
                "opportunity_id": str(opp_id),
                "contact_id": None,
                "company_id": company["id"],
                "user_id": seller["id"],
                "user_name": seller["name"],
                "activity_type": kind,
                "summary": rng.choice(ACTIVITY_TEXT[kind]),
                "description": None,
                "activity_date": _iso(cursor),
                "attachments": attachments,
                "created_at": _iso(cursor),
            }
            stats["actividades"] += 1
            cursor += timedelta(days=max(0.5, rng.gauss(4 * seller["pace"], 2)))

    return {
        "empresas": len(companies),
        "contactos": len(contacts),
        "obras": len(projects),
        **stats,
    }

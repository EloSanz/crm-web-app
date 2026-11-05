"""Expediente de un cliente o de un presupuesto: todo lo que el CRM sabe, en orden y con referencias.

Sin base vectorial: el historial de un cliente entra entero en el prompt. Cada hecho lleva una
referencia corta ([F12]) que el modelo tiene que citar; el backend la traduce a la actividad,
etapa, versión o mensaje real para que el vendedor pueda ir a verlo al seguimiento.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from uuid import UUID

from fastapi import HTTPException

from backend.models.activity import ActivityResponse
from backend.models.company import CompanyResponse
from backend.models.contact import ContactResponse
from backend.models.message import MessageDirection
from backend.models.opportunity import OpportunityResponse
from backend.services.activity_service import ActivityService
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService
from backend.services.message_service import MessageService
from backend.services.opportunity_service import OpportunityService

logger = logging.getLogger("crm.services.dossier")

# Límites para que el prompt no se dispare con clientes de años de historia.
MAX_ENTRIES = 300
MAX_DETAIL = 1200

ACTIVITY_LABEL = {
    "llamada": "Llamada",
    "whatsapp": "WhatsApp",
    "reunion": "Reunión",
    "visita_obra": "Visita a obra",
    "mostrador": "Mostrador",
    "email": "Correo",
    "nota": "Nota",
    "presupuesto": "Presupuesto",
}
STATUS_LABEL = {"abierta": "abierto", "ganada": "venta concretada", "perdida": "perdido"}
KIND_LABEL = {
    "presupuesto": "Presupuesto",
    "etapa": "Cambio de etapa",
    "version": "Nueva versión de materiales",
    "actividad": "Actividad",
    "mensaje": "Mensaje del cliente",
    "ficha": "Ficha del cliente",
}
# Referencia fija de la ficha (datos del cliente y contactos): también se puede citar.
PROFILE_REF = "F0"


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _clip(text: str | None, limit: int = MAX_DETAIL) -> str | None:
    if not text:
        return None
    flat = text.strip()
    return flat if len(flat) <= limit else flat[: limit - 1].rstrip() + "…"


def _money(value) -> str:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return "$ 0"
    return "$ " + f"{n:,.0f}".replace(",", ".")


@dataclass
class Entry:
    kind: str
    at: datetime
    title: str
    detail: str | None = None
    opportunity_id: UUID | None = None
    opportunity_title: str | None = None
    source_id: str | None = None
    user_name: str | None = None
    ref: str = ""
    # Tipo de actividad (llamada, visita_obra…) para que el historial muestre su ícono.
    activity_type: str | None = None

    def citation(self, company_id: UUID | None) -> dict:
        if self.opportunity_id:
            target = f"{self.kind}-{self.source_id}" if self.source_id else ""
            link = f"/opportunities/{self.opportunity_id}" + (f"?ver={target}" if target else "") + "#seguimiento"
        elif company_id:
            link = f"/companies/{company_id}"
        else:
            link = None
        return {
            "ref": self.ref,
            "kind": self.kind,
            "kind_label": KIND_LABEL.get(self.kind, self.kind),
            "at": self.at.isoformat(),
            "title": self.title,
            "detail": _clip(self.detail, 300),
            "opportunity_id": str(self.opportunity_id) if self.opportunity_id else None,
            "opportunity_title": self.opportunity_title,
            "source_id": self.source_id,
            "user_name": self.user_name,
            "link": link,
        }


@dataclass
class Dossier:
    company: CompanyResponse | None
    contacts: list[ContactResponse]
    opportunities: list[OpportunityResponse]
    entries: list[Entry] = field(default_factory=list)
    truncated: bool = False
    profile: Entry | None = None

    @property
    def by_ref(self) -> dict[str, Entry]:
        refs = {e.ref: e for e in self.entries}
        if self.profile:
            refs[self.profile.ref] = self.profile
        return refs

    @property
    def company_id(self) -> UUID | None:
        return self.company.id if self.company else None


@lru_cache(maxsize=1)
def _stage_names() -> dict[str, str]:
    """Las etapas del embudo casi no cambian: se leen una vez por proceso."""
    try:
        from backend.controllers.opportunity_controller import list_stages

        return {str(st["id"]): st["name"] for st in list_stages()}
    except Exception:
        return {}


def stage_of(opp: OpportunityResponse) -> str:
    return opp.stage_name or _stage_names().get(str(opp.stage_id)) or "—"


def _opportunity_entries(opp: OpportunityResponse) -> list[Entry]:
    """Alta del presupuesto, etapas, versiones, actividades y mensajes del cliente."""
    base = {"opportunity_id": opp.id, "opportunity_title": opp.title}
    materials = ", ".join(f"{it.product_name} ({float(it.quantity):g} {it.unit})" for it in (opp.items or [])[:25])
    header = [
        f"Estado: {STATUS_LABEL.get(opp.status.value, opp.status.value)}",
        f"Etapa: {stage_of(opp)}",
        f"Total: {_money(opp.estimated_value)}",
    ]
    if float(opp.discount_pct or 0) > 0:
        header.append(f"Descuento general: {float(opp.discount_pct):g} %")
    if opp.assigned_to_name:
        header.append(f"Responsable: {opp.assigned_to_name}")
    if opp.contact_name:
        header.append(f"Contacto: {opp.contact_name}")
    if opp.project_name:
        header.append(f"Obra: {opp.project_name}")
    if opp.loss_reason:
        header.append(f"Motivo de pérdida: {opp.loss_reason}")
    if opp.expected_close_date:
        header.append(f"Cierre estimado: {opp.expected_close_date.isoformat()}")
    if materials:
        header.append(f"Materiales vigentes (versión {opp.current_version}): {materials}")
    out = [
        Entry(
            kind="presupuesto",
            at=_aware(opp.created_at),
            title=f"Se creó el presupuesto «{opp.title}»",
            detail=" · ".join(header),
            source_id=str(opp.id),
            user_name=opp.assigned_to_name,
            **base,
        )
    ]
    try:
        for ev in OpportunityService.get_timeline(opp.id):
            if ev.kind == "etapa" and not ev.from_stage_id:
                continue  # el alta ya está en la entrada del presupuesto
            detail = ev.detail
            if ev.kind == "version" and ev.total is not None:
                prev = f" (antes {_money(ev.previous_total)})" if ev.previous_total is not None else ""
                detail = " · ".join(filter(None, [ev.detail, f"Nuevo total {_money(ev.total)}{prev}"]))
            out.append(
                Entry(
                    kind=ev.kind,
                    at=_aware(ev.at),
                    title=ev.title,
                    detail=detail,
                    source_id=ev.id.split("-", 1)[-1],
                    user_name=ev.user_name,
                    **base,
                )
            )
    except Exception as e:
        logger.warning(f"No se pudo armar la línea de tiempo de {opp.id}: {e}")
    for a in ActivityService.get_activities_by_opportunity(opp.id):
        out.append(_activity_entry(a, **base))
    return out


def _activity_entry(a: ActivityResponse, **extra) -> Entry:
    return Entry(
        kind="actividad",
        at=_aware(a.activity_date),
        title=f"{ACTIVITY_LABEL.get(a.activity_type.value, a.activity_type.value)}: {a.summary}",
        detail=a.description,
        source_id=str(a.id),
        user_name=a.user_name,
        activity_type=a.activity_type.value,
        **extra,
    )


def _inbound_messages(**filters) -> list[Entry]:
    """Lo que escribió el cliente (lo saliente ya está en las actividades)."""
    out = []
    for m in MessageService.list_messages(direction=MessageDirection.ENTRANTE, limit=200, **filters):
        channel = "Correo" if m.channel.value == "email" else "WhatsApp"
        title = f"{channel} del cliente" + (f": {m.subject}" if m.subject else "")
        out.append(
            Entry(
                kind="mensaje",
                at=_aware(m.created_at),
                title=title,
                detail=m.body_text,
                opportunity_id=m.opportunity_id,
                source_id=str(m.id),
                user_name=m.from_address or (f"+{m.phone}" if m.phone else None),
            )
        )
    return out


def _finish(dossier: Dossier, entries: list[Entry], max_entries: int | None = MAX_ENTRIES) -> Dossier:
    # Sin repetidos (una actividad puede venir por presupuesto y por empresa).
    seen: set[tuple] = set()
    unique: list[Entry] = []
    for e in entries:
        key = (e.kind, e.source_id)
        if e.source_id and key in seen:
            continue
        seen.add(key)
        unique.append(e)
    unique.sort(key=lambda e: e.at)
    if max_entries is not None and len(unique) > max_entries:
        # Se conservan las altas de presupuesto (resumen de cada negocio) y lo más reciente.
        heads = [e for e in unique if e.kind == "presupuesto"]
        rest = [e for e in unique if e.kind != "presupuesto"]
        rest = rest[max(len(rest) - max(max_entries - len(heads), 0), 0) :]
        unique = sorted(heads + rest, key=lambda e: e.at)
        dossier.truncated = True
    titles = {o.id: o.title for o in dossier.opportunities}
    for i, e in enumerate(unique, start=1):
        e.ref = f"F{i}"
        if e.opportunity_id and not e.opportunity_title:
            e.opportunity_title = titles.get(e.opportunity_id)
    dossier.entries = unique
    if dossier.company:
        dossier.profile = Entry(
            kind="ficha",
            at=_aware(dossier.company.created_at),
            title=f"Ficha de {dossier.company.name}",
            detail=" · ".join(
                f"{ct.first_name} {ct.last_name}".strip() + (f" ({ct.job_title})" if ct.job_title else "")
                for ct in dossier.contacts
            )
            or None,
            source_id=str(dossier.company.id),
            ref=PROFILE_REF,
        )
    return dossier


def build_for_company(company_id: UUID, max_entries: int | None = MAX_ENTRIES) -> Dossier:
    """Expediente de una empresa. Con `max_entries=None` va completo (el historial comercial pagina aparte)."""
    company = CompanyService.get_company_by_id(company_id)
    contacts = ContactService.get_contacts(company_id=company_id, limit=100)
    opps = OpportunityService.get_opportunities(company_id=company_id, limit=200)
    entries: list[Entry] = []
    for opp in opps:
        entries += _opportunity_entries(opp)
    titles = {o.id: o.title for o in opps}
    for a in ActivityService.list_by_company(company_id):
        entries.append(
            _activity_entry(
                a,
                opportunity_id=a.opportunity_id,
                opportunity_title=titles.get(a.opportunity_id) if a.opportunity_id else None,
            )
        )
    entries += _inbound_messages(company_id=company_id)
    return _finish(Dossier(company=company, contacts=contacts, opportunities=opps), entries, max_entries)


def build_for_contact(contact_id: UUID, max_entries: int | None = MAX_ENTRIES) -> Dossier:
    """Expediente de un contacto: sus presupuestos (con etapas, versiones y actividades), lo que se
    registró con él aunque no tenga presupuesto y los mensajes que mandó."""
    contact = ContactService.get_contact_by_id(contact_id)
    company = None
    if contact.company_id:
        try:
            company = CompanyService.get_company_by_id(contact.company_id)
        except HTTPException:
            company = None
    opps = OpportunityService.get_opportunities(contact_id=contact_id, limit=200)
    entries: list[Entry] = []
    for opp in opps:
        entries += _opportunity_entries(opp)
    titles = {o.id: o.title for o in opps}
    for a in ActivityService.list_by_contact(contact_id):
        entries.append(
            _activity_entry(
                a,
                opportunity_id=a.opportunity_id,
                opportunity_title=titles.get(a.opportunity_id) if a.opportunity_id else None,
            )
        )
    entries += _inbound_messages(contact_id=contact_id)
    return _finish(Dossier(company=company, contacts=[contact], opportunities=opps), entries, max_entries)


def build_for_opportunity(opp: OpportunityResponse) -> Dossier:
    company = None
    if opp.company_id:
        try:
            company = CompanyService.get_company_by_id(opp.company_id)
        except HTTPException:
            company = None
    contacts: list[ContactResponse] = []
    if opp.contact_id:
        try:
            contacts = [ContactService.get_contact_by_id(opp.contact_id)]
        except HTTPException:
            contacts = []
    entries = _opportunity_entries(opp) + _inbound_messages(opportunity_id=opp.id)
    return _finish(Dossier(company=company, contacts=contacts, opportunities=[opp]), entries)


def render(dossier: Dossier) -> str:
    """Texto del expediente para el prompt (sólo datos, sin instrucciones)."""
    lines: list[str] = []
    c = dossier.company
    if c:
        lines.append(f"[{PROFILE_REF}] Ficha del cliente (datos y contactos cargados en el CRM)")
        lines.append(f"Cliente: {c.name}")
        extra = [
            f"Estado comercial: {c.status.value}",
            f"Rubro: {c.industry}" if c.industry else None,
            f"Origen: {c.origin}" if c.origin else None,
            f"Notas de la ficha: {_clip(c.notes, 600)}" if c.notes else None,
        ]
        lines += [x for x in extra if x]
    if dossier.contacts:
        lines.append("Contactos:")
        for ct in dossier.contacts:
            bits = [f"{ct.first_name} {ct.last_name}".strip(), ct.job_title, ct.email, ct.phone]
            lines.append("- " + " · ".join(b for b in bits if b))
    if dossier.truncated:
        lines.append(
            f"(Historial recortado: se muestran los {MAX_ENTRIES} hechos más recientes y el alta de cada presupuesto.)"
        )
    lines.append("")
    lines.append("Historial, del más viejo al más nuevo:")
    if not dossier.entries:
        lines.append("(sin registros)")
    for e in dossier.entries:
        head = f"[{e.ref}] {e.at.astimezone(timezone.utc).strftime('%Y-%m-%d')} · {e.title}"
        if e.opportunity_title and e.kind != "presupuesto":
            head += f" · presupuesto «{e.opportunity_title}»"
        if e.user_name:
            head += f" · {e.user_name}"
        lines.append(head)
        detail = _clip(e.detail)
        if detail:
            lines.append("    " + detail.replace("\n", "\n    "))
    return "\n".join(lines)

"""Historial comercial de empresas y contactos (caso de uso 12: consultar el historial comercial).

Reutiliza el expediente de «Ponete al día» (dossier_service): alta de presupuestos, cambios de etapa,
versiones de materiales, actividades con y sin presupuesto y mensajes del cliente.
"""

from uuid import UUID

from fastapi import APIRouter, Header, Query

from backend.controllers.permissions import authorize_company, authorize_contact
from backend.models.history import HistoryEntry, HistoryKind, HistoryPage
from backend.services import dossier_service

router = APIRouter(tags=["Historial comercial"])

_KINDS = {k.value for k in HistoryKind}


def _page(dossier: dossier_service.Dossier, kind: HistoryKind | None, limit: int, offset: int) -> HistoryPage:
    # Sin tipos que el historial no muestra (la ficha) y del más nuevo al más viejo.
    entries = [e for e in reversed(dossier.entries) if e.kind in _KINDS]
    counts: dict[str, int] = {k.value: 0 for k in HistoryKind}
    for e in entries:
        counts[e.kind] += 1
    if kind:
        entries = [e for e in entries if e.kind == kind.value]
    items = []
    for e in entries[offset : offset + limit]:
        # Sin presupuesto el hecho es del propio cliente (la página que ya se está viendo): sin link.
        cite = e.citation(None)
        items.append(
            HistoryEntry(
                id=f"{e.kind}-{e.source_id or e.ref}",
                kind=e.kind,
                kind_label=cite["kind_label"],
                at=e.at,
                title=e.title,
                detail=dossier_service._clip(e.detail),
                activity_type=e.activity_type,
                opportunity_id=e.opportunity_id,
                opportunity_title=e.opportunity_title,
                source_id=e.source_id,
                user_name=e.user_name,
                link=cite["link"],
            )
        )
    return HistoryPage(
        items=items,
        total=len(entries),
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < len(entries),
        counts=counts,
    )


@router.get(
    "/api/companies/{company_id}/history",
    response_model=HistoryPage,
    summary="Historial comercial de una empresa (del más nuevo al más viejo, paginado)",
)
def company_history(
    company_id: UUID,
    kind: HistoryKind | None = Query(None, description="Filtrar por tipo de hecho"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> HistoryPage:
    authorize_company(authorization, company_id)
    return _page(dossier_service.build_for_company(company_id, max_entries=None), kind, limit, offset)


@router.get(
    "/api/contacts/{contact_id}/history",
    response_model=HistoryPage,
    summary="Historial comercial de un contacto (del más nuevo al más viejo, paginado)",
)
def contact_history(
    contact_id: UUID,
    kind: HistoryKind | None = Query(None, description="Filtrar por tipo de hecho"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    authorization: str | None = Header(None),
) -> HistoryPage:
    authorize_contact(authorization, contact_id)
    return _page(dossier_service.build_for_contact(contact_id, max_entries=None), kind, limit, offset)

import logging
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.opportunity import (
    OpportunityCreate,
    OpportunityItemResponse,
    OpportunityResponse,
    OpportunityStatus,
    OpportunityUpdate,
    OpportunityVersionResponse,
    TimelineEvent,
)
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService
from backend.services.stage_history_service import StageHistoryService

logger = logging.getLogger("crm.services.opportunity")

_mock_opportunities: dict[str, dict] = {}
_mock_items: dict[str, list[dict]] = {}
_mock_versions: dict[str, list[dict]] = {}

# Columnas agregadas en la migración 05: si la base todavía no las tiene, se guarda sin ellas.
OPTIONAL_OPP_FIELDS = ("discount_pct", "current_version")
OPTIONAL_ITEM_FIELDS = ("list_price", "price_tier", "discount_pct")
BLOCKED_COMPANY_STATUSES = {"inactivo", "no_contactar"}


def _sentence(name: str | None) -> str:
    """«Presupuesto Enviado» → «Presupuesto enviado» (así se nombran las etapas en la interfaz)."""
    return f"{name[:1].upper()}{name[1:].lower()}" if name else ""


def _aware(dt: datetime) -> datetime:
    """Fechas sin zona se toman como UTC (mezclarlas con fechas con zona rompe comparaciones)."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _clean_item(row: dict) -> dict:
    item = dict(row)
    item["price_tier"] = item.get("price_tier") or "minorista"
    item["discount_pct"] = item.get("discount_pct") or 0
    return item


class OpportunityService:
    """Servicio de negocio para Oportunidades / Presupuestos de Materiales."""

    @classmethod
    def _enrich_opportunity(cls, opp_dict: dict) -> dict:
        data = dict(opp_dict)
        opp_id = str(data["id"])
        # Bases sin la migración 05 devuelven estas columnas vacías.
        data["discount_pct"] = data.get("discount_pct") or 0
        data["current_version"] = data.get("current_version") or 1

        # Responsable comercial
        if data.get("assigned_to"):
            try:
                from backend.services.user_service import UserService

                data["assigned_to_name"] = UserService.name_map().get(str(data["assigned_to"]))
            except Exception:
                data["assigned_to_name"] = None

        # Empresa
        if data.get("company_id"):
            try:
                comp = CompanyService.get_company_by_id(UUID(str(data["company_id"])))
                data["company_name"] = comp.name
            except Exception:
                data["company_name"] = None

        # Contacto
        if data.get("contact_id"):
            try:
                cont = ContactService.get_contact_by_id(UUID(str(data["contact_id"])))
                data["contact_name"] = f"{cont.first_name} {cont.last_name}"
            except Exception:
                data["contact_name"] = None

        # Obra / Proyecto
        if data.get("project_id"):
            try:
                from backend.services.project_service import ProjectService

                proj = ProjectService.get_project_by_id(UUID(str(data["project_id"])))
                data["project_name"] = proj.name
            except Exception:
                data["project_name"] = None
        else:
            data["project_name"] = None

        # Items
        if opp_id in _mock_items:
            data["items"] = [OpportunityItemResponse(**_clean_item(it)) for it in _mock_items[opp_id]]
        else:
            try:
                client = get_supabase_client()
                items_res = client.table("crm_opportunity_items").select("*").eq("opportunity_id", opp_id).execute()
                if items_res.data:
                    data["items"] = [OpportunityItemResponse(**_clean_item(it)) for it in items_res.data]
                else:
                    data["items"] = []
            except Exception:
                data["items"] = []

        # North Star Metric (NSM): Actividad comercial reciente y semáforo de salud
        last_act_dt = None
        try:
            client = get_supabase_client()
            act_res = (
                client.table("crm_activities")
                .select("activity_date")
                .eq("opportunity_id", opp_id)
                .order("activity_date", desc=True)
                .limit(1)
                .execute()
            )
            if act_res.data and len(act_res.data) > 0:
                dt_str = act_res.data[0]["activity_date"]
                last_act_dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except Exception:
            pass

        # Si no hay actividades en DB, verificar mock o usar fecha de creación del presupuesto
        if not last_act_dt:
            from backend.services.activity_service import _mock_activities

            opp_acts = [
                _aware(datetime.fromisoformat(str(a["activity_date"]).replace("Z", "+00:00")))
                for a in _mock_activities.values()
                if str(a.get("opportunity_id")) == opp_id
            ]
            if opp_acts:
                last_act_dt = max(opp_acts)

        if last_act_dt:
            if last_act_dt.tzinfo is None:
                last_act_dt = last_act_dt.replace(tzinfo=timezone.utc)
            data["last_activity_at"] = last_act_dt
            now = datetime.now(timezone.utc)
            delta = now - last_act_dt
            days = max(0, delta.days)
            data["days_since_last_activity"] = days
            if days <= 7:
                data["health_status"] = "healthy"
            elif days <= 14:
                data["health_status"] = "warning"
            else:
                data["health_status"] = "stale"
        else:
            # Si no tiene actividad cargada todavía, calcular días desde created_at
            created_at_raw = data.get("created_at")
            if created_at_raw:
                try:
                    if isinstance(created_at_raw, str):
                        c_dt = datetime.fromisoformat(created_at_raw.replace("Z", "+00:00"))
                    else:
                        c_dt = created_at_raw
                    now = datetime.now(timezone.utc)
                    if c_dt.tzinfo is None:
                        c_dt = c_dt.replace(tzinfo=timezone.utc)
                    days = max(0, (now - c_dt).days)
                    data["days_since_last_activity"] = days
                    if days <= 7:
                        data["health_status"] = "healthy"
                    elif days <= 14:
                        data["health_status"] = "warning"
                    else:
                        data["health_status"] = "stale"
                except Exception:
                    data["days_since_last_activity"] = None
                    data["health_status"] = "stale"
            else:
                data["days_since_last_activity"] = None
                data["health_status"] = "stale"

        return data

    @classmethod
    def get_opportunities(
        cls,
        company_id: UUID | None = None,
        contact_id: UUID | None = None,
        stage_id: UUID | None = None,
        status_filter: OpportunityStatus | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
        assigned_to: UUID | None = None,
    ) -> list[OpportunityResponse]:
        """Obtiene presupuestos activos excluyendo baja lógica. `assigned_to` limita a los de un vendedor."""
        try:
            client = get_supabase_client()
            query = client.table("crm_opportunities").select("*, crm_stages(name, slug, color)").eq("is_deleted", False)

            if company_id:
                query = query.eq("company_id", str(company_id))
            if contact_id:
                query = query.eq("contact_id", str(contact_id))
            if stage_id:
                query = query.eq("stage_id", str(stage_id))
            if status_filter:
                query = query.eq("status", status_filter.value)
            if assigned_to:
                query = query.eq("assigned_to", str(assigned_to))
            if q:
                query = query.ilike("title", f"%{q}%")

            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
            res = query.execute()

            if res.data is not None and len(res.data) > 0:
                output = []
                for item in res.data:
                    stage_info = item.pop("crm_stages", None) or {}
                    item["stage_name"] = stage_info.get("name")
                    item["stage_slug"] = stage_info.get("slug")
                    item["stage_color"] = stage_info.get("color")
                    enriched = cls._enrich_opportunity(item)
                    output.append(OpportunityResponse(**enriched))
                return output
        except Exception as e:
            logger.warning(f"Error consultando crm_opportunities en Supabase: {e}")

        # Fallback local
        results = [
            OpportunityResponse(**cls._enrich_opportunity(dict(item)))
            for item in _mock_opportunities.values()
            if not item.get("is_deleted", False)
        ]
        if company_id:
            results = [o for o in results if o.company_id == company_id]
        if contact_id:
            results = [o for o in results if o.contact_id == contact_id]
        if stage_id:
            results = [o for o in results if o.stage_id == stage_id]
        if status_filter:
            results = [o for o in results if o.status == status_filter]
        if assigned_to:
            results = [o for o in results if str(o.assigned_to) == str(assigned_to)]
        if q:
            q_lower = q.lower()
            results = [o for o in results if q_lower in o.title.lower()]

        results.sort(key=lambda o: o.created_at, reverse=True)
        return results[offset : offset + limit]

    @classmethod
    def get_opportunity_by_id(cls, opp_id: UUID) -> OpportunityResponse:
        """Obtiene una oportunidad/presupuesto por su ID."""
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_opportunities")
                .select("*, crm_stages(name, slug, color)")
                .eq("id", str(opp_id))
                .eq("is_deleted", False)
                .execute()
            )
            if res.data and len(res.data) > 0:
                item = res.data[0]
                stage_info = item.pop("crm_stages", None) or {}
                item["stage_name"] = stage_info.get("name")
                item["stage_slug"] = stage_info.get("slug")
                item["stage_color"] = stage_info.get("color")
                enriched = cls._enrich_opportunity(item)
                return OpportunityResponse(**enriched)
        except Exception as e:
            logger.warning(f"Error buscando oportunidad en Supabase: {e}")

        mock_data = _mock_opportunities.get(str(opp_id))
        if mock_data and not mock_data.get("is_deleted", False):
            enriched = cls._enrich_opportunity(mock_data)
            return OpportunityResponse(**enriched)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Presupuesto/Oportunidad con ID {opp_id} no encontrado",
        )

    # ------------------------------------------------------------------
    # Materiales, descuentos y versiones
    # ------------------------------------------------------------------

    @staticmethod
    def _money(value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def _build_items(cls, opp_id: UUID, items: list, now: datetime) -> tuple[list[dict], Decimal]:
        """Arma los renglones con su subtotal (cantidad × precio − descuento) y devuelve el subtotal general."""
        payload: list[dict] = []
        subtotal = Decimal("0")
        for it in items:
            discount = Decimal(str(it.discount_pct or 0))
            line = cls._money(it.quantity * it.unit_price * (Decimal("1") - discount / Decimal("100")))
            subtotal += line
            payload.append(
                {
                    "id": str(uuid4()),
                    "opportunity_id": str(opp_id),
                    "product_id": str(it.product_id) if it.product_id else None,
                    "product_name": it.product_name,
                    "unit": it.unit,
                    "quantity": float(it.quantity),
                    "unit_price": float(it.unit_price),
                    "subtotal": float(line),
                    "list_price": float(it.list_price) if it.list_price is not None else None,
                    "price_tier": it.price_tier.value if hasattr(it.price_tier, "value") else it.price_tier,
                    "discount_pct": float(discount),
                    "created_at": now.isoformat(),
                }
            )
        return payload, subtotal

    @classmethod
    def _total(cls, subtotal: Decimal, discount_pct: Decimal | float | None) -> Decimal:
        pct = Decimal(str(discount_pct or 0))
        return cls._money(subtotal * (Decimal("1") - pct / Decimal("100")))

    @staticmethod
    def _write(client, table: str, rows, optional: tuple[str, ...], update_id: str | None = None):
        """Inserta o actualiza tolerando columnas nuevas que la base todavía no tiene (migración pendiente)."""

        def run(data):
            if update_id is not None:
                return client.table(table).update(data).eq("id", update_id).execute()
            return client.table(table).insert(data).execute()

        try:
            return run(rows)
        except Exception as e:
            if not any(field in str(e) for field in optional):
                raise
            logger.warning(f"{table}: columnas nuevas ausentes ({e}); se guarda sin ellas. Aplicar migración 05.")
            if isinstance(rows, list):
                stripped = [{k: v for k, v in r.items() if k not in optional} for r in rows]
            else:
                stripped = {k: v for k, v in rows.items() if k not in optional}
            return run(stripped)

    @classmethod
    def _save_version(
        cls,
        opp_id: UUID,
        version: int,
        items_payload: list[dict],
        subtotal: Decimal,
        discount_pct: Decimal | float,
        total: Decimal,
        user_id: UUID | str | None,
        note: str | None,
        now: datetime,
    ) -> dict:
        entry = {
            "id": str(uuid4()),
            "opportunity_id": str(opp_id),
            "version": version,
            "items": [{k: v for k, v in it.items() if k not in ("id", "opportunity_id")} for it in items_payload],
            "subtotal": float(subtotal),
            "discount_pct": float(discount_pct or 0),
            "total": float(total),
            "note": note,
            "created_by": str(user_id) if user_id else None,
            "created_at": now.isoformat(),
        }
        try:
            client = get_supabase_client()
            res = client.table("crm_opportunity_versions").insert(entry).execute()
            if res.data:
                entry = res.data[0]
        except Exception as e:
            logger.warning(f"No se pudo guardar la versión del presupuesto en Supabase: {e}")
        _mock_versions.setdefault(str(opp_id), [])
        _mock_versions[str(opp_id)] = [v for v in _mock_versions[str(opp_id)] if v["version"] != version] + [entry]
        return entry

    @classmethod
    def get_versions(cls, opp_id: UUID) -> list[OpportunityVersionResponse]:
        """Historial de versiones de materiales, de la más nueva a la más vieja."""
        rows: list[dict] | None = None
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_opportunity_versions")
                .select("*")
                .eq("opportunity_id", str(opp_id))
                .order("version", desc=True)
                .execute()
            )
            if res.data:
                rows = res.data
        except Exception as e:
            logger.warning(f"Error consultando versiones en Supabase: {e}")
        if rows is None:
            rows = sorted(_mock_versions.get(str(opp_id), []), key=lambda v: v["version"], reverse=True)
        from backend.services.user_service import UserService

        names = UserService.name_map()
        out = []
        for r in rows:
            item = dict(r)
            item["items"] = item.get("items") or []
            item["created_by_name"] = names.get(str(item.get("created_by"))) if item.get("created_by") else None
            out.append(OpportunityVersionResponse(**item))
        return out

    @classmethod
    def get_timeline(cls, opp_id: UUID) -> list[TimelineEvent]:
        """Hitos del presupuesto (cambios de etapa y versiones de materiales), del más nuevo al más viejo."""
        events: list[TimelineEvent] = []
        for h in StageHistoryService.list_by_opportunity(opp_id):
            to_name = _sentence(h.get("to_stage_name")) or "otra etapa"
            if h.get("from_stage_id"):
                title = f"Pasó a {to_name}"
                detail = f"Desde {_sentence(h.get('from_stage_name')) or 'otra etapa'}"
            else:
                title = f"Presupuesto creado en {to_name}"
                detail = None
            if h.get("notes") and h["notes"] not in ("Actualización de etapa", "Creación inicial del presupuesto"):
                detail = f"{detail} · {h['notes']}" if detail else h["notes"]
            events.append(
                TimelineEvent(
                    id=f"etapa-{h['id']}",
                    kind="etapa",
                    at=h["created_at"],
                    user_id=h.get("changed_by"),
                    user_name=h.get("changed_by_name"),
                    title=title,
                    detail=detail,
                    from_stage_id=h.get("from_stage_id"),
                    to_stage_id=h.get("to_stage_id"),
                )
            )
        versions = sorted(cls.get_versions(opp_id), key=lambda v: v.version)
        previous: OpportunityVersionResponse | None = None
        for v in versions:
            if v.version > 1:
                events.append(
                    TimelineEvent(
                        id=f"version-{v.id}",
                        kind="version",
                        at=v.created_at,
                        user_id=v.created_by,
                        user_name=v.created_by_name,
                        title=f"Versión {v.version} de los materiales",
                        detail=v.note,
                        version=v.version,
                        total=v.total,
                        previous_total=previous.total if previous else None,
                    )
                )
            previous = v
        events.sort(key=lambda e: e.at, reverse=True)
        return events

    # ------------------------------------------------------------------
    # Alta y modificación
    # ------------------------------------------------------------------

    @staticmethod
    def _ensure_company_can_quote(company_id: UUID | None) -> None:
        """No se presupuesta a empresas inactivas ni marcadas como «no contactar»."""
        if not company_id:
            return
        company = CompanyService.get_company_by_id(company_id)
        status_value = getattr(company.status, "value", company.status)
        if status_value in BLOCKED_COMPANY_STATUSES:
            label = "inactiva" if status_value == "inactivo" else "marcada como «no contactar»"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{company.name} está {label}: no se le pueden hacer presupuestos.",
            )

    @classmethod
    def create_opportunity(
        cls,
        data: OpportunityCreate,
        created_by: UUID | None = None,
    ) -> OpportunityResponse:
        """Crea un nuevo presupuesto/oportunidad y sus materiales cotizados (versión 1)."""
        # Al menos empresa o contacto obligatorio (Invariante 6)
        if not data.company_id and not data.contact_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Toda oportunidad debe estar asociada como mínimo a una Empresa o a un Contacto.",
            )
        cls._ensure_company_can_quote(data.company_id)

        now = datetime.now(timezone.utc)
        opp_id = uuid4()
        assigned_to = data.assigned_to or created_by or UUID("00000000-0000-0000-0000-000000000001")

        items_payload, subtotal = cls._build_items(opp_id, data.items, now)
        if data.estimated_value and data.estimated_value > 0 and subtotal == 0:
            total = Decimal(str(data.estimated_value))
        else:
            total = cls._total(subtotal, data.discount_pct)

        payload = {
            "id": str(opp_id),
            "title": data.title.strip(),
            "company_id": str(data.company_id) if data.company_id else None,
            "contact_id": str(data.contact_id) if data.contact_id else None,
            "project_id": str(data.project_id) if data.project_id else None,
            "assigned_to": str(assigned_to),
            "stage_id": str(data.stage_id),
            "status": data.status.value,
            "estimated_value": float(total),
            "currency": data.currency,
            "expected_close_date": data.expected_close_date.isoformat() if data.expected_close_date else None,
            "delivery_location": data.delivery_location,
            "loss_reason": None,
            "discount_pct": float(data.discount_pct or 0),
            "current_version": 1,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        in_db = False
        try:
            client = get_supabase_client()
            res = cls._write(client, "crm_opportunities", payload, OPTIONAL_OPP_FIELDS)
            if res.data and len(res.data) > 0:
                if items_payload:
                    cls._write(client, "crm_opportunity_items", items_payload, OPTIONAL_ITEM_FIELDS)
                in_db = True
        except Exception as e:
            logger.warning(f"Error insertando oportunidad en Supabase: {e}")

        _mock_opportunities[str(opp_id)] = payload
        _mock_items[str(opp_id)] = items_payload
        # Invariante 1: historial inmutable de etapas + primera versión de los materiales
        StageHistoryService.record(
            opp_id, None, data.stage_id, created_by or assigned_to, "Creación del presupuesto", at=now
        )
        cls._save_version(
            opp_id, 1, items_payload, subtotal, data.discount_pct, total, created_by or assigned_to, None, now
        )

        if in_db:
            return cls.get_opportunity_by_id(opp_id)
        return OpportunityResponse(**cls._enrich_opportunity(payload))

    @classmethod
    def update_opportunity(
        cls,
        opp_id: UUID,
        data: OpportunityUpdate,
        user_id: UUID | None = None,
    ) -> OpportunityResponse:
        """Modifica un presupuesto. Cambiar materiales o descuento genera una nueva versión."""
        existing = cls.get_opportunity_by_id(opp_id)
        now = datetime.now(timezone.utc)

        update_payload = data.model_dump(exclude_unset=True, exclude={"items", "version_note"})
        update_payload["updated_at"] = now.isoformat()

        if "status" in update_payload and isinstance(update_payload["status"], OpportunityStatus):
            update_payload["status"] = update_payload["status"].value
        for field in ["company_id", "contact_id", "project_id", "assigned_to", "stage_id"]:
            if field in update_payload and update_payload[field] is not None:
                update_payload[field] = str(update_payload[field])
        if "expected_close_date" in update_payload and update_payload["expected_close_date"]:
            update_payload["expected_close_date"] = update_payload["expected_close_date"].isoformat()
        for field in ["estimated_value", "discount_pct"]:
            if field in update_payload and isinstance(update_payload[field], Decimal):
                update_payload[field] = float(update_payload[field])
        if data.company_id and str(data.company_id) != str(existing.company_id):
            cls._ensure_company_can_quote(data.company_id)

        # Materiales o descuento → nueva versión con la foto completa (se conserva la historia).
        new_items_payload: list[dict] | None = None
        new_version: dict | None = None
        discount_changed = data.discount_pct is not None and Decimal(str(data.discount_pct)) != Decimal(
            str(existing.discount_pct or 0)
        )
        if data.items is not None or discount_changed:
            if data.items is not None:
                new_items_payload, subtotal = cls._build_items(opp_id, data.items, now)
            else:
                new_items_payload = None
                subtotal = sum((Decimal(str(it.subtotal)) for it in existing.items), Decimal("0"))
            discount = data.discount_pct if data.discount_pct is not None else existing.discount_pct
            total = cls._total(subtotal, discount)
            version = int(existing.current_version or 1) + 1
            snapshot = new_items_payload
            if snapshot is None:
                snapshot = [
                    {k: (float(v) if isinstance(v, Decimal) else v) for k, v in it.model_dump(mode="json").items()}
                    for it in existing.items
                ]
            update_payload["estimated_value"] = float(total)
            update_payload["discount_pct"] = float(discount or 0)
            update_payload["current_version"] = version
            new_version = {
                "version": version,
                "items": snapshot,
                "subtotal": subtotal,
                "discount": discount,
                "total": total,
            }
            # La versión 1 de presupuestos anteriores a esta función se reconstruye con lo vigente.
            if not cls.get_versions(opp_id):
                base_items = [it.model_dump(mode="json") for it in existing.items]
                base_subtotal = sum((Decimal(str(it.subtotal)) for it in existing.items), Decimal("0"))
                cls._save_version(
                    opp_id,
                    int(existing.current_version or 1),
                    base_items,
                    base_subtotal,
                    existing.discount_pct or 0,
                    Decimal(str(existing.estimated_value)),
                    existing.assigned_to,
                    None,
                    existing.created_at if isinstance(existing.created_at, datetime) else now,
                )

        # Cambio de etapa -> historial inmutable (Invariante 1)
        new_stage_id = update_payload.get("stage_id")
        if new_stage_id and str(new_stage_id) != str(existing.stage_id):
            note = None
            if update_payload.get("status") == OpportunityStatus.PERDIDA.value and data.loss_reason:
                note = f"Motivo: {data.loss_reason}"
            StageHistoryService.record(
                opp_id, existing.stage_id, new_stage_id, user_id or existing.assigned_to, note, at=now
            )

        updated_in_db = False
        try:
            client = get_supabase_client()
            res = cls._write(client, "crm_opportunities", update_payload, OPTIONAL_OPP_FIELDS, update_id=str(opp_id))
            if res.data and len(res.data) > 0:
                if new_items_payload is not None:
                    client.table("crm_opportunity_items").delete().eq("opportunity_id", str(opp_id)).execute()
                    if new_items_payload:
                        cls._write(client, "crm_opportunity_items", new_items_payload, OPTIONAL_ITEM_FIELDS)
                _mock_opportunities[str(opp_id)] = res.data[0]
                updated_in_db = True
        except Exception as e:
            logger.warning(f"Error actualizando oportunidad en Supabase: {e}")

        if new_items_payload is not None:
            _mock_items[str(opp_id)] = new_items_payload
        if new_version:
            cls._save_version(
                opp_id,
                new_version["version"],
                new_version["items"],
                new_version["subtotal"],
                new_version["discount"],
                new_version["total"],
                user_id or existing.assigned_to,
                data.version_note,
                now,
            )

        if updated_in_db:
            return cls.get_opportunity_by_id(opp_id)

        current_data = _mock_opportunities.get(str(opp_id), existing.model_dump())
        current_data.update(update_payload)
        _mock_opportunities[str(opp_id)] = current_data
        enriched = cls._enrich_opportunity(current_data)
        return OpportunityResponse(**enriched)

    @classmethod
    def delete_opportunity(cls, opp_id: UUID) -> bool:
        """Baja lógica de una oportunidad comercial."""
        cls.get_opportunity_by_id(opp_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "deleted_at": now,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_opportunities").update(soft_delete_payload).eq("id", str(opp_id)).execute()
            if res.data is not None:
                if str(opp_id) in _mock_opportunities:
                    _mock_opportunities[str(opp_id)].update(soft_delete_payload)
                return True
        except Exception as e:
            logger.warning(f"Error en baja lógica de oportunidad en Supabase: {e}")

        if str(opp_id) in _mock_opportunities:
            _mock_opportunities[str(opp_id)].update(soft_delete_payload)
        return True

    @classmethod
    def get_active_pipeline_metric(cls, window_days: int = 7, assigned_to: UUID | None = None) -> dict:
        """
        Calcula la North Star Metric (NSM):
        Monto total ($) y cantidad (#) de Oportunidades Abiertas con Actividad en los últimos N días.
        """
        open_opps = cls.get_opportunities(status_filter=OpportunityStatus.ABIERTA, limit=500, assigned_to=assigned_to)
        total_open = len(open_opps)

        active_count = 0
        active_amount = 0.0
        stale_count = 0
        stale_amount = 0.0

        for opp in open_opps:
            val = float(opp.estimated_value or 0)
            days = opp.days_since_last_activity
            if days is not None and days <= window_days:
                active_count += 1
                active_amount += val
            else:
                stale_count += 1
                stale_amount += val

        health_ratio = round(active_count / total_open, 4) if total_open > 0 else 1.0

        return {
            "window_days": window_days,
            "total_open_opportunities": total_open,
            "active_opportunities_count": active_count,
            "active_opportunities_amount": active_amount,
            "pipeline_health_ratio": health_ratio,
            "stale_opportunities_count": stale_count,
            "stale_opportunities_amount": stale_amount,
        }

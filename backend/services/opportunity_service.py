import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.opportunity import (
    OpportunityCreate,
    OpportunityItemResponse,
    OpportunityResponse,
    OpportunityStatus,
    OpportunityUpdate,
)
from backend.services.company_service import CompanyService
from backend.services.contact_service import ContactService

logger = logging.getLogger("crm.services.opportunity")

_mock_opportunities: dict[str, dict] = {}
_mock_items: dict[str, list[dict]] = {}


class OpportunityService:
    """Servicio de negocio para Oportunidades / Presupuestos de Materiales."""

    @classmethod
    def _enrich_opportunity(cls, opp_dict: dict) -> dict:
        data = dict(opp_dict)
        opp_id = str(data["id"])

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
            data["items"] = [OpportunityItemResponse(**it) for it in _mock_items[opp_id]]
        else:
            try:
                client = get_supabase_client()
                items_res = client.table("crm_opportunity_items").select("*").eq("opportunity_id", opp_id).execute()
                if items_res.data:
                    data["items"] = [OpportunityItemResponse(**it) for it in items_res.data]
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
                datetime.fromisoformat(a["activity_date"].replace("Z", "+00:00"))
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
    ) -> list[OpportunityResponse]:
        """Obtiene presupuestos activos excluyendo baja lógica."""
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

    @classmethod
    def create_opportunity(
        cls,
        data: OpportunityCreate,
        created_by: UUID | None = None,
    ) -> OpportunityResponse:
        """Crea un nuevo presupuesto/oportunidad y sus materiales cotizados."""
        # Al menos empresa o contacto obligatorio (Invariante 6)
        if not data.company_id and not data.contact_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Toda oportunidad debe estar asociada como mínimo a una Empresa o a un Contacto.",
            )

        now = datetime.now(timezone.utc)
        opp_id = uuid4()

        # Calcular valor estimado a partir de los items o del valor provisto
        total_estimated = Decimal("0.00")
        items_payload = []

        for it in data.items:
            subtotal = it.quantity * it.unit_price
            total_estimated += subtotal
            items_payload.append(
                {
                    "id": str(uuid4()),
                    "opportunity_id": str(opp_id),
                    "product_id": str(it.product_id) if it.product_id else None,
                    "product_name": it.product_name,
                    "unit": it.unit,
                    "quantity": float(it.quantity),
                    "unit_price": float(it.unit_price),
                    "subtotal": float(subtotal),
                    "created_at": now.isoformat(),
                }
            )

        if data.estimated_value and data.estimated_value > 0 and total_estimated == 0:
            final_estimated_value = float(data.estimated_value)
        else:
            final_estimated_value = float(total_estimated)

        payload = {
            "id": str(opp_id),
            "title": data.title.strip(),
            "company_id": str(data.company_id) if data.company_id else None,
            "contact_id": str(data.contact_id) if data.contact_id else None,
            "project_id": str(data.project_id) if data.project_id else None,
            "assigned_to": str(data.assigned_to),
            "stage_id": str(data.stage_id),
            "status": data.status.value,
            "estimated_value": final_estimated_value,
            "currency": data.currency,
            "expected_close_date": data.expected_close_date.isoformat() if data.expected_close_date else None,
            "delivery_location": data.delivery_location,
            "loss_reason": None,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_opportunities").insert(payload).execute()
            if res.data and len(res.data) > 0:
                if items_payload:
                    client.table("crm_opportunity_items").insert(items_payload).execute()

                # Invariante 1: Registrar en historial inmutable de etapas
                history_entry = {
                    "id": str(uuid4()),
                    "opportunity_id": str(opp_id),
                    "from_stage_id": None,
                    "to_stage_id": str(data.stage_id),
                    "changed_by": str(created_by or data.assigned_to),
                    "notes": "Creación inicial del presupuesto",
                    "created_at": now.isoformat(),
                }
                client.table("crm_stage_history").insert(history_entry).execute()

                _mock_opportunities[str(opp_id)] = payload
                _mock_items[str(opp_id)] = items_payload
                return cls.get_opportunity_by_id(opp_id)
        except Exception as e:
            logger.warning(f"Error insertando oportunidad en Supabase: {e}")

        _mock_opportunities[str(opp_id)] = payload
        _mock_items[str(opp_id)] = items_payload
        enriched = cls._enrich_opportunity(payload)
        return OpportunityResponse(**enriched)

    @classmethod
    def update_opportunity(
        cls,
        opp_id: UUID,
        data: OpportunityUpdate,
        user_id: UUID | None = None,
    ) -> OpportunityResponse:
        """Modifica un presupuesto existente."""
        existing = cls.get_opportunity_by_id(opp_id)
        now = datetime.now(timezone.utc)

        update_payload = data.model_dump(exclude_unset=True, exclude={"items"})
        update_payload["updated_at"] = now.isoformat()

        if "status" in update_payload and isinstance(update_payload["status"], OpportunityStatus):
            update_payload["status"] = update_payload["status"].value
        for field in ["company_id", "contact_id", "project_id", "assigned_to", "stage_id"]:
            if field in update_payload and update_payload[field] is not None:
                update_payload[field] = str(update_payload[field])
        if "expected_close_date" in update_payload and update_payload["expected_close_date"]:
            update_payload["expected_close_date"] = update_payload["expected_close_date"].isoformat()
        if "estimated_value" in update_payload and isinstance(update_payload["estimated_value"], Decimal):
            update_payload["estimated_value"] = float(update_payload["estimated_value"])

        # Cambio de etapa -> registrar en crm_stage_history (Invariante 1)
        new_stage_id = update_payload.get("stage_id")
        if new_stage_id and str(new_stage_id) != str(existing.stage_id):
            try:
                client = get_supabase_client()
                client.table("crm_stage_history").insert(
                    {
                        "id": str(uuid4()),
                        "opportunity_id": str(opp_id),
                        "from_stage_id": str(existing.stage_id),
                        "to_stage_id": str(new_stage_id),
                        "changed_by": str(user_id or existing.assigned_to),
                        "notes": "Actualización de etapa",
                        "created_at": now.isoformat(),
                    }
                ).execute()
            except Exception as e:
                logger.warning(f"Error registrando historial de etapa en Supabase: {e}")

        try:
            client = get_supabase_client()
            res = client.table("crm_opportunities").update(update_payload).eq("id", str(opp_id)).execute()
            if res.data and len(res.data) > 0:
                _mock_opportunities[str(opp_id)] = res.data[0]
                return cls.get_opportunity_by_id(opp_id)
        except Exception as e:
            logger.warning(f"Error actualizando oportunidad en Supabase: {e}")

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
    def get_active_pipeline_metric(cls, window_days: int = 7) -> dict:
        """
        Calcula la North Star Metric (NSM):
        Monto total ($) y cantidad (#) de Oportunidades Abiertas con Actividad en los últimos N días.
        """
        open_opps = cls.get_opportunities(status_filter=OpportunityStatus.ABIERTA, limit=500)
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

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.company import CompanyCreate, CompanyResponse, CompanyStatus, CompanyUpdate

logger = logging.getLogger("crm.services.company")

# Fallback in-memory store for development/testing when Supabase is offline or mocked
_mock_companies: dict[str, dict] = {}


class CompanyService:
    """Servicio de negocio para Empresas / Contratistas corporativos."""

    @staticmethod
    def _is_mock_mode() -> bool:
        try:
            client = get_supabase_client()
            return client is None
        except Exception:
            return True

    @classmethod
    def get_companies(
        cls,
        q: str | None = None,
        status_filter: CompanyStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CompanyResponse]:
        """Obtiene el listado de empresas activas (excluye baja lógica)."""
        try:
            client = get_supabase_client()
            query = client.table("crm_companies").select("*").eq("is_deleted", False)

            if status_filter:
                query = query.eq("status", status_filter.value)

            if q:
                query = query.or_(f"name.ilike.%{q}%,cuit.ilike.%{q}%")

            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
            res = query.execute()

            if res.data is not None:
                return [CompanyResponse(**item) for item in res.data]
        except Exception as e:
            logger.warning(f"Error accediendo a Supabase para crm_companies, usando memoria local: {e}")

        # Fallback local
        results = [CompanyResponse(**item) for item in _mock_companies.values() if not item.get("is_deleted", False)]
        if status_filter:
            results = [c for c in results if c.status == status_filter]
        if q:
            q_lower = q.lower()
            results = [c for c in results if q_lower in c.name.lower() or (c.cuit and q_lower in c.cuit.lower())]
        results.sort(key=lambda c: c.created_at, reverse=True)
        return results[offset : offset + limit]

    @classmethod
    def get_company_by_id(cls, company_id: UUID) -> CompanyResponse:
        """Obtiene una empresa por su UUID si no está dada de baja."""
        try:
            client = get_supabase_client()
            res = client.table("crm_companies").select("*").eq("id", str(company_id)).eq("is_deleted", False).execute()
            if res.data and len(res.data) > 0:
                return CompanyResponse(**res.data[0])
        except Exception as e:
            logger.warning(f"Error buscando empresa por ID en Supabase: {e}")

        mock_data = _mock_companies.get(str(company_id))
        if mock_data and not mock_data.get("is_deleted", False):
            return CompanyResponse(**mock_data)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Empresa con ID {company_id} no encontrada",
        )

    @classmethod
    def create_company(
        cls,
        data: CompanyCreate,
        created_by: UUID | None = None,
    ) -> CompanyResponse:
        """Crea una nueva empresa contratista."""
        now = datetime.now(timezone.utc)
        company_id = uuid4()
        payload = {
            "id": str(company_id),
            "name": data.name,
            "cuit": data.cuit,
            "industry": data.industry,
            "email": data.email,
            "phone": data.phone,
            "address": data.address,
            "website": data.website,
            "status": data.status.value,
            "origin": data.origin,
            "notes": data.notes,
            "assigned_to": str(data.assigned_to) if data.assigned_to else None,
            "created_by": str(created_by) if created_by else None,
            "is_deleted": False,
            "deleted_at": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_companies").insert(payload).execute()
            if res.data and len(res.data) > 0:
                created_record = res.data[0]
                _mock_companies[str(company_id)] = created_record
                return CompanyResponse(**created_record)
        except Exception as e:
            logger.warning(f"Error insertando empresa en Supabase, guardando en memoria: {e}")

        _mock_companies[str(company_id)] = payload
        return CompanyResponse(**payload)

    @classmethod
    def update_company(
        cls,
        company_id: UUID,
        data: CompanyUpdate,
    ) -> CompanyResponse:
        """Modifica los atributos de una empresa existente."""
        # Verificar existencia
        existing = cls.get_company_by_id(company_id)

        update_payload = data.model_dump(exclude_unset=True)
        if not update_payload:
            return existing

        now = datetime.now(timezone.utc)
        update_payload["updated_at"] = now.isoformat()
        if "status" in update_payload and isinstance(update_payload["status"], CompanyStatus):
            update_payload["status"] = update_payload["status"].value
        if "assigned_to" in update_payload and update_payload["assigned_to"] is not None:
            update_payload["assigned_to"] = str(update_payload["assigned_to"])

        try:
            client = get_supabase_client()
            res = client.table("crm_companies").update(update_payload).eq("id", str(company_id)).execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
                _mock_companies[str(company_id)] = updated_record
                return CompanyResponse(**updated_record)
        except Exception as e:
            logger.warning(f"Error actualizando empresa en Supabase: {e}")

        # Fallback local
        current_data = _mock_companies.get(str(company_id), existing.model_dump())
        current_data.update(update_payload)
        _mock_companies[str(company_id)] = current_data
        return CompanyResponse(**current_data)

    @classmethod
    def delete_company(cls, company_id: UUID) -> bool:
        """
        Baja lógica obligatoria (Invariante 2).
        Nunca se borra físicamente el registro de la base.
        """
        cls.get_company_by_id(company_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "deleted_at": now,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_companies").update(soft_delete_payload).eq("id", str(company_id)).execute()
            if res.data is not None:
                if str(company_id) in _mock_companies:
                    _mock_companies[str(company_id)].update(soft_delete_payload)
                return True
        except Exception as e:
            logger.warning(f"Error aplicando baja lógica a empresa en Supabase: {e}")

        if str(company_id) in _mock_companies:
            _mock_companies[str(company_id)].update(soft_delete_payload)
        return True

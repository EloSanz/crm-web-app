import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.contact import ContactCreate, ContactResponse, ContactStatus, ContactUpdate
from backend.services.company_service import CompanyService

logger = logging.getLogger("crm.services.contact")

# Fallback in-memory store for development/testing
_mock_contacts: dict[str, dict] = {}


class ContactService:
    """Servicio de negocio para Contactos / Maestros Mayores de Obra."""

    @classmethod
    def _enrich_company_name(cls, contact_dict: dict) -> dict:
        """Agrega el nombre de la empresa relacionada si tiene company_id."""
        company_id = contact_dict.get("company_id")
        if company_id:
            try:
                comp = CompanyService.get_company_by_id(UUID(str(company_id)))
                contact_dict["company_name"] = comp.name
            except Exception:
                contact_dict["company_name"] = None
        else:
            contact_dict["company_name"] = None
        return contact_dict

    @classmethod
    def get_contacts(
        cls,
        company_id: UUID | None = None,
        status_filter: ContactStatus | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ContactResponse]:
        """Obtiene el listado de contactos activos (excluye baja lógica)."""
        try:
            client = get_supabase_client()
            query = client.table("crm_contacts").select("*").eq("is_deleted", False)

            if company_id:
                query = query.eq("company_id", str(company_id))

            if status_filter:
                query = query.eq("status", status_filter.value)

            if q:
                query = query.or_(f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,email.ilike.%{q}%")

            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
            res = query.execute()

            if res.data is not None:
                enriched = [cls._enrich_company_name(dict(item)) for item in res.data]
                return [ContactResponse(**item) for item in enriched]
        except Exception as e:
            logger.warning(f"Error consultando crm_contacts en Supabase, usando memoria local: {e}")

        # Fallback local
        results = [
            ContactResponse(**cls._enrich_company_name(dict(item)))
            for item in _mock_contacts.values()
            if not item.get("is_deleted", False)
        ]
        if company_id:
            results = [c for c in results if c.company_id == company_id]
        if status_filter:
            results = [c for c in results if c.status == status_filter]
        if q:
            q_lower = q.lower()
            results = [
                c
                for c in results
                if q_lower in c.first_name.lower()
                or q_lower in c.last_name.lower()
                or (c.email and q_lower in c.email.lower())
            ]
        results.sort(key=lambda c: c.created_at, reverse=True)
        return results[offset : offset + limit]

    @classmethod
    def get_contact_by_id(cls, contact_id: UUID) -> ContactResponse:
        """Obtiene un contacto por su ID si no está dado de baja."""
        try:
            client = get_supabase_client()
            res = client.table("crm_contacts").select("*").eq("id", str(contact_id)).eq("is_deleted", False).execute()
            if res.data and len(res.data) > 0:
                enriched = cls._enrich_company_name(dict(res.data[0]))
                return ContactResponse(**enriched)
        except Exception as e:
            logger.warning(f"Error buscando contacto por ID en Supabase: {e}")

        mock_data = _mock_contacts.get(str(contact_id))
        if mock_data and not mock_data.get("is_deleted", False):
            enriched = cls._enrich_company_name(dict(mock_data))
            return ContactResponse(**enriched)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contacto con ID {contact_id} no encontrado",
        )

    @classmethod
    def create_contact(
        cls,
        data: ContactCreate,
        created_by: UUID | None = None,
    ) -> ContactResponse:
        """Crea un nuevo contacto / contratista."""
        # Si tiene company_id, validar que exista
        if data.company_id:
            CompanyService.get_company_by_id(data.company_id)

        now = datetime.now(timezone.utc)
        contact_id = uuid4()
        payload = {
            "id": str(contact_id),
            "company_id": str(data.company_id) if data.company_id else None,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "document_number": data.document_number,
            "email": data.email,
            "phone": data.phone,
            "job_title": data.job_title,
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
            res = client.table("crm_contacts").insert(payload).execute()
            if res.data and len(res.data) > 0:
                created_record = res.data[0]
                _mock_contacts[str(contact_id)] = created_record
                enriched = cls._enrich_company_name(dict(created_record))
                return ContactResponse(**enriched)
        except Exception as e:
            logger.warning(f"Error insertando contacto en Supabase: {e}")

        _mock_contacts[str(contact_id)] = payload
        enriched = cls._enrich_company_name(dict(payload))
        return ContactResponse(**enriched)

    @classmethod
    def update_contact(
        cls,
        contact_id: UUID,
        data: ContactUpdate,
    ) -> ContactResponse:
        """Modifica un contacto existente."""
        existing = cls.get_contact_by_id(contact_id)

        if data.company_id:
            CompanyService.get_company_by_id(data.company_id)

        update_payload = data.model_dump(exclude_unset=True)
        if not update_payload:
            return existing

        now = datetime.now(timezone.utc)
        update_payload["updated_at"] = now.isoformat()
        if "company_id" in update_payload and update_payload["company_id"] is not None:
            update_payload["company_id"] = str(update_payload["company_id"])
        if "status" in update_payload and isinstance(update_payload["status"], ContactStatus):
            update_payload["status"] = update_payload["status"].value
        if "assigned_to" in update_payload and update_payload["assigned_to"] is not None:
            update_payload["assigned_to"] = str(update_payload["assigned_to"])

        try:
            client = get_supabase_client()
            res = client.table("crm_contacts").update(update_payload).eq("id", str(contact_id)).execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
                _mock_contacts[str(contact_id)] = updated_record
                enriched = cls._enrich_company_name(dict(updated_record))
                return ContactResponse(**enriched)
        except Exception as e:
            logger.warning(f"Error actualizando contacto en Supabase: {e}")

        current_data = _mock_contacts.get(str(contact_id), existing.model_dump())
        current_data.update(update_payload)
        _mock_contacts[str(contact_id)] = current_data
        enriched = cls._enrich_company_name(dict(current_data))
        return ContactResponse(**enriched)

    @classmethod
    def delete_contact(cls, contact_id: UUID) -> bool:
        """Baja lógica obligatoria del contacto."""
        cls.get_contact_by_id(contact_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "deleted_at": now,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_contacts").update(soft_delete_payload).eq("id", str(contact_id)).execute()
            if res.data is not None:
                if str(contact_id) in _mock_contacts:
                    _mock_contacts[str(contact_id)].update(soft_delete_payload)
                return True
        except Exception as e:
            logger.warning(f"Error en baja lógica de contacto en Supabase: {e}")

        if str(contact_id) in _mock_contacts:
            _mock_contacts[str(contact_id)].update(soft_delete_payload)
        return True

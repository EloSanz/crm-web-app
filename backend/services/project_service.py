import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatus,
    ProjectType,
    ProjectUpdate,
)

logger = logging.getLogger("crm.services.project")

_mock_projects: dict[str, dict] = {}

_DEFAULT_PROJECTS = [
    {
        "name": "Torre Residencial Belgrano 450",
        "address": "Av. Belgrano 450, Ramos Mejía, Buenos Aires",
        "project_type": "edificio_multifamiliar",
        "status": "en_curso",
        "company_name": "Gómez Construcciones SRL",
        "observations": "Descarga con hidrogrúa programada. Coordinar entregas de cemento y hierro antes de las 11:00 hs por tránsito.",
    },
    {
        "name": "Vivienda Unifamiliar Lote 42 - Barrio Las Acacias",
        "address": "Ruta 58 Km 9.5, Lote 42, Canning, Buenos Aires",
        "project_type": "vivienda_unifamiliar",
        "status": "en_curso",
        "company_name": "Desarrollos Urbanos del Oeste SA",
        "observations": "Entrada de camión con acoplado autorizada por guardia previa presentación de remito.",
    },
    {
        "name": "Ampliación Nave Logística Oeste",
        "address": "Camino de Cintura 2800, San Justo, Buenos Aires",
        "project_type": "comercial_industrial",
        "status": "en_curso",
        "company_name": "Hormigonera & Estructuras San Martín",
        "observations": "Requerimiento de entregas masivas de áridos para contrapisos industriales.",
    },
    {
        "name": "Refacción Integral Sede Social Club Alem",
        "address": "Av. San Martín 1120, Haedo, Buenos Aires",
        "project_type": "refaccion",
        "status": "frenada",
        "company_name": "Refacciones & Obras Civiles Morón",
        "observations": "Obra pausada temporalmente por aprobación de planos municipales. Retoman el mes próximo.",
    },
    {
        "name": "Edificio Alvear Park Studios",
        "address": "Marcelo T. de Alvear 890, Martínez, Buenos Aires",
        "project_type": "edificio_multifamiliar",
        "status": "planificacion",
        "company_name": "Constructora Alvear SRL",
        "observations": "Etapa de excavación de subsuelo y pilotaje. Cotizando hierros de estructura.",
    },
]


def _init_mock_projects():
    if not _mock_projects:
        now = datetime.now(timezone.utc).isoformat()
        for p in _DEFAULT_PROJECTS:
            pid = str(uuid4())
            _mock_projects[pid] = {
                "id": pid,
                "name": p["name"],
                "company_id": None,
                "contact_id": None,
                "company_name": p.get("company_name"),
                "contact_name": None,
                "address": p["address"],
                "project_type": p["project_type"],
                "status": p["status"],
                "observations": p["observations"],
                "opportunities_count": 0,
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
            }


_init_mock_projects()


class ProjectService:
    """Servicio de negocio para gestión de Obras / Proyectos y locaciones de entrega."""

    @classmethod
    def get_projects(
        cls,
        company_id: UUID | None = None,
        contact_id: UUID | None = None,
        status_filter: ProjectStatus | None = None,
        project_type: ProjectType | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ProjectResponse]:
        """Obtiene la lista de obras con soporte para filtros y búsqueda."""
        try:
            client = get_supabase_client()
            query = (
                client.table("crm_projects")
                .select("*, crm_companies(name), crm_contacts(first_name, last_name)")
                .eq("is_deleted", False)
            )

            if company_id:
                query = query.eq("company_id", str(company_id))
            if contact_id:
                query = query.eq("contact_id", str(contact_id))
            if status_filter:
                query = query.eq("status", status_filter.value)
            if project_type:
                query = query.eq("project_type", project_type.value)
            if q:
                query = query.or_(f"name.ilike.%{q}%,address.ilike.%{q}%")

            query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
            res = query.execute()

            if res.data is not None and len(res.data) > 0:
                results = []
                for item in res.data:
                    c_data = item.pop("crm_companies", None)
                    ct_data = item.pop("crm_contacts", None)
                    company_name = c_data.get("name") if isinstance(c_data, dict) else None
                    contact_name = (
                        f"{ct_data.get('first_name', '')} {ct_data.get('last_name', '')}".strip()
                        if isinstance(ct_data, dict)
                        else None
                    )
                    results.append(
                        ProjectResponse(
                            **item,
                            company_name=company_name,
                            contact_name=contact_name,
                        )
                    )
                return results
        except Exception as e:
            logger.warning(f"Error consultando crm_projects en Supabase: {e}")

        # Fallback local en memoria
        results = [ProjectResponse(**item) for item in _mock_projects.values() if not item.get("is_deleted", False)]
        if company_id:
            results = [p for p in results if p.company_id == company_id]
        if contact_id:
            results = [p for p in results if p.contact_id == contact_id]
        if status_filter:
            results = [p for p in results if p.status == status_filter]
        if project_type:
            results = [p for p in results if p.project_type == project_type]
        if q:
            q_lower = q.lower()
            results = [p for p in results if q_lower in p.name.lower() or q_lower in p.address.lower()]

        results.sort(key=lambda p: p.created_at, reverse=True)
        return results[offset : offset + limit]

    @classmethod
    def get_project_by_id(cls, project_id: UUID) -> ProjectResponse:
        """Obtiene el detalle de una obra por su ID."""
        try:
            client = get_supabase_client()
            res = (
                client.table("crm_projects")
                .select("*, crm_companies(name), crm_contacts(first_name, last_name)")
                .eq("id", str(project_id))
                .eq("is_deleted", False)
                .execute()
            )
            if res.data and len(res.data) > 0:
                item = res.data[0]
                c_data = item.pop("crm_companies", None)
                ct_data = item.pop("crm_contacts", None)
                company_name = c_data.get("name") if isinstance(c_data, dict) else None
                contact_name = (
                    f"{ct_data.get('first_name', '')} {ct_data.get('last_name', '')}".strip()
                    if isinstance(ct_data, dict)
                    else None
                )
                return ProjectResponse(
                    **item,
                    company_name=company_name,
                    contact_name=contact_name,
                )
        except Exception as e:
            logger.warning(f"Error consultando obra {project_id} en Supabase: {e}")

        mock_data = _mock_projects.get(str(project_id))
        if mock_data and not mock_data.get("is_deleted", False):
            return ProjectResponse(**mock_data)

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Obra con ID {project_id} no encontrada",
        )

    @classmethod
    def create_project(cls, data: ProjectCreate) -> ProjectResponse:
        """Registra una nueva obra / proyecto."""
        now = datetime.now(timezone.utc)
        project_id = uuid4()
        payload = {
            "id": str(project_id),
            "name": data.name.strip(),
            "company_id": str(data.company_id) if data.company_id else None,
            "contact_id": str(data.contact_id) if data.contact_id else None,
            "address": data.address.strip(),
            "project_type": data.project_type.value,
            "status": data.status.value,
            "observations": data.observations,
            "is_deleted": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_projects").insert(payload).execute()
            if res.data and len(res.data) > 0:
                created_record = res.data[0]
                _mock_projects[str(project_id)] = created_record
                return ProjectResponse(**created_record)
        except Exception as e:
            logger.warning(f"Error insertando obra en Supabase: {e}")

        _mock_projects[str(project_id)] = payload
        return ProjectResponse(**payload)

    @classmethod
    def update_project(cls, project_id: UUID, data: ProjectUpdate) -> ProjectResponse:
        """Actualiza los datos de una obra."""
        existing = cls.get_project_by_id(project_id)

        update_payload = data.model_dump(exclude_unset=True)
        if not update_payload:
            return existing

        now = datetime.now(timezone.utc)
        update_payload["updated_at"] = now.isoformat()
        if "project_type" in update_payload and isinstance(update_payload["project_type"], ProjectType):
            update_payload["project_type"] = update_payload["project_type"].value
        if "status" in update_payload and isinstance(update_payload["status"], ProjectStatus):
            update_payload["status"] = update_payload["status"].value
        if "company_id" in update_payload:
            update_payload["company_id"] = str(update_payload["company_id"]) if update_payload["company_id"] else None
        if "contact_id" in update_payload:
            update_payload["contact_id"] = str(update_payload["contact_id"]) if update_payload["contact_id"] else None

        try:
            client = get_supabase_client()
            res = client.table("crm_projects").update(update_payload).eq("id", str(project_id)).execute()
            if res.data and len(res.data) > 0:
                updated_record = res.data[0]
                _mock_projects[str(project_id)] = updated_record
                return ProjectResponse(**updated_record)
        except Exception as e:
            logger.warning(f"Error actualizando obra en Supabase: {e}")

        current_data = _mock_projects.get(str(project_id), existing.model_dump())
        current_data.update(update_payload)
        _mock_projects[str(project_id)] = current_data
        return ProjectResponse(**current_data)

    @classmethod
    def delete_project(cls, project_id: UUID) -> bool:
        """Baja lógica de una obra."""
        cls.get_project_by_id(project_id)
        now = datetime.now(timezone.utc).isoformat()
        soft_delete_payload = {
            "is_deleted": True,
            "deleted_at": now,
            "updated_at": now,
        }

        try:
            client = get_supabase_client()
            res = client.table("crm_projects").update(soft_delete_payload).eq("id", str(project_id)).execute()
            if res.data is not None:
                if str(project_id) in _mock_projects:
                    _mock_projects[str(project_id)].update(soft_delete_payload)
                return True
        except Exception as e:
            logger.warning(f"Error en baja lógica de obra en Supabase: {e}")

        if str(project_id) in _mock_projects:
            _mock_projects[str(project_id)].update(soft_delete_payload)
        return True

"""Embudo comercial configurable: etapas con orden, tipo (abierta/ganada/perdida) y baja lógica.

Fuente de verdad: crm_stages. Sin base (modo local o tests) se usan las 6 etapas del corralón en memoria.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from backend.database import get_supabase_client
from backend.models.catalog import StageCreate, StageKind, StageUpdate
from backend.services.catalog_service import slugify

logger = logging.getLogger("crm.services.stage")

TABLE = "crm_stages"

DEFAULT_STAGES: list[dict] = [
    {
        "id": "11111111-0000-0000-0000-000000000001",
        "name": "Consulta Recibida",
        "slug": "consulta-recibida",
        "position": 1,
        "is_closed_won": False,
        "is_closed_lost": False,
        "color": "#38bdf8",
    },
    {
        "id": "11111111-0000-0000-0000-000000000002",
        "name": "Presupuesto en Preparación",
        "slug": "presupuesto-preparacion",
        "position": 2,
        "is_closed_won": False,
        "is_closed_lost": False,
        "color": "#818cf8",
    },
    {
        "id": "11111111-0000-0000-0000-000000000003",
        "name": "Presupuesto Enviado",
        "slug": "presupuesto-enviado",
        "position": 3,
        "is_closed_won": False,
        "is_closed_lost": False,
        "color": "#fbbf24",
    },
    {
        "id": "11111111-0000-0000-0000-000000000004",
        "name": "Negociación",
        "slug": "negociacion",
        "position": 4,
        "is_closed_won": False,
        "is_closed_lost": False,
        "color": "#f97316",
    },
    {
        "id": "11111111-0000-0000-0000-000000000005",
        "name": "Venta Concretada",
        "slug": "venta-concretada",
        "position": 5,
        "is_closed_won": True,
        "is_closed_lost": False,
        "color": "#22c55e",
    },
    {
        "id": "11111111-0000-0000-0000-000000000006",
        "name": "Perdida",
        "slug": "perdida",
        "position": 6,
        "is_closed_won": False,
        "is_closed_lost": True,
        "color": "#ef4444",
    },
]

_mock_stages: dict[str, dict] = {s["id"]: {**s, "is_active": True} for s in DEFAULT_STAGES}

KIND_LABEL = {StageKind.OPEN: "abierta", StageKind.WON: "de venta concretada (ganada)", StageKind.LOST: "de perdida"}


def stage_kind(stage: dict) -> StageKind:
    if stage.get("is_closed_won"):
        return StageKind.WON
    if stage.get("is_closed_lost"):
        return StageKind.LOST
    return StageKind.OPEN


def _kind_flags(kind: StageKind) -> dict:
    return {"is_closed_won": kind == StageKind.WON, "is_closed_lost": kind == StageKind.LOST}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _invalidate_caches() -> None:
    """Los nombres y el orden de las etapas se cachean en otros servicios: se limpian al editar."""
    try:
        from backend.services.dossier_service import _stage_names

        _stage_names.cache_clear()
    except Exception:
        pass
    try:
        from backend.services.metrics_service import MetricsService

        MetricsService.clear_cache()
    except Exception:
        pass


class StageService:
    @staticmethod
    def list_stages(include_inactive: bool = False) -> list[dict]:
        """Etapas ordenadas por posición. Por defecto sólo las activas."""
        rows: list[dict] = []
        try:
            res = get_supabase_client().table(TABLE).select("*").order("position").execute()
            rows = [dict(r) for r in (res.data or [])]
        except Exception:
            pass
        if not rows:
            rows = [dict(s) for s in _mock_stages.values()]
        for r in rows:
            # Base sin la migración 11: todas las etapas cuentan como activas.
            if r.get("is_active") is None:
                r["is_active"] = True
        rows.sort(key=lambda s: (s.get("position") or 0, s.get("name") or ""))
        return rows if include_inactive else [r for r in rows if r["is_active"]]

    @classmethod
    def _find(cls, stage_id: UUID) -> dict:
        stage = next((s for s in cls.list_stages(include_inactive=True) if str(s["id"]) == str(stage_id)), None)
        if not stage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos esa etapa")
        return stage

    @staticmethod
    def _save(stage_id: str, changes: dict) -> None:
        try:
            res = get_supabase_client().table(TABLE).update(changes).eq("id", stage_id).execute()
            if res.data:
                return
        except Exception as e:
            logger.warning(f"Error actualizando {TABLE} en Supabase: {e}")
        if stage_id in _mock_stages:
            _mock_stages[stage_id].update(changes)

    @staticmethod
    def _count_opportunities(stage_id: str, only_open: bool) -> int:
        from backend.models.opportunity import OpportunityStatus
        from backend.services.opportunity_service import OpportunityService

        opps = OpportunityService.get_opportunities(
            stage_id=UUID(stage_id),
            status_filter=OpportunityStatus.ABIERTA if only_open else None,
            limit=500,
        )
        return len(opps)

    @staticmethod
    def _ensure_minimum(stages: list[dict]) -> None:
        """Siempre tiene que quedar al menos una etapa activa abierta, una ganada y una perdida."""
        active = [s for s in stages if s.get("is_active", True)]
        for kind in StageKind:
            if not any(stage_kind(s) == kind for s in active):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Tiene que quedar al menos una etapa activa {KIND_LABEL[kind]}.",
                )

    @classmethod
    def _write_positions(cls, ordered: list[dict]) -> None:
        now = _now()
        for pos, stage in enumerate(ordered, start=1):
            if stage.get("position") != pos:
                cls._save(str(stage["id"]), {"position": pos, "updated_at": now})

    @classmethod
    def create_stage(cls, data: StageCreate) -> dict:
        stages = cls.list_stages(include_inactive=True)
        if any(s["name"].strip().lower() == data.name.lower() for s in stages):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Ya existe una etapa llamada «{data.name}»"
            )
        taken = {s.get("slug") for s in stages}
        slug = base = slugify(data.name)[:45]
        n = 2
        while slug in taken:
            slug = f"{base}-{n}"
            n += 1

        # Una etapa abierta nueva va antes de los cierres; una de cierre, al final.
        ordered = list(stages)
        insert_at = len(ordered)
        if data.kind == StageKind.OPEN:
            insert_at = next((i for i, s in enumerate(ordered) if stage_kind(s) != StageKind.OPEN), len(ordered))
        now = _now()
        row = {
            "id": str(uuid4()),
            "name": data.name,
            "slug": slug,
            "position": insert_at + 1,
            "color": data.color,
            "is_active": True,
            **_kind_flags(data.kind),
            "created_at": now,
            "updated_at": now,
        }
        # Primero se corren las posiciones de las etapas que quedan después.
        cls._write_positions(ordered[:insert_at] + [row] + ordered[insert_at:])
        created = None
        try:
            res = get_supabase_client().table(TABLE).insert(row).execute()
            if res.data:
                created = dict(res.data[0])
        except Exception as e:
            logger.warning(f"Error insertando en {TABLE}: {e}")
        if created is None:
            _mock_stages[row["id"]] = row
            created = dict(row)
        _invalidate_caches()
        return created

    @classmethod
    def update_stage(cls, stage_id: UUID, data: StageUpdate) -> dict:
        stages = cls.list_stages(include_inactive=True)
        current = cls._find(stage_id)
        sid = str(current["id"])
        changes: dict = {}

        if data.name is not None and data.name != current["name"]:
            if any(str(s["id"]) != sid and s["name"].strip().lower() == data.name.lower() for s in stages):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail=f"Ya existe una etapa llamada «{data.name}»"
                )
            changes["name"] = data.name
        if data.color is not None:
            changes["color"] = data.color
        if data.kind is not None and data.kind != stage_kind(current):
            if cls._count_opportunities(sid, only_open=False):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"No podés cambiar el tipo de «{current['name']}» porque ya tiene presupuestos. "
                        "Creá una etapa nueva con el tipo que necesitás."
                    ),
                )
            changes.update(_kind_flags(data.kind))
        if data.is_active is not None and data.is_active != current.get("is_active", True):
            if not data.is_active:
                open_count = cls._count_opportunities(sid, only_open=True)
                if open_count:
                    plural = "presupuesto abierto" if open_count == 1 else "presupuestos abiertos"
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            f"No podés desactivar «{current['name']}»: tiene {open_count} {plural}. "
                            "Movelos a otra etapa y volvé a intentar."
                        ),
                    )
            changes["is_active"] = data.is_active

        if not changes:
            return current
        after = [{**s, **changes} if str(s["id"]) == sid else s for s in stages]
        cls._ensure_minimum(after)
        changes["updated_at"] = _now()
        cls._save(sid, changes)
        _invalidate_caches()
        return cls._find(stage_id)

    @classmethod
    def reorder(cls, ids: list[UUID]) -> list[dict]:
        stages = cls.list_stages(include_inactive=True)
        by_id = {str(s["id"]): s for s in stages}
        wanted = [str(i) for i in dict.fromkeys(ids)]
        if any(i not in by_id for i in wanted):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Hay etapas que no existen en el embudo"
            )
        ordered = [by_id[i] for i in wanted] + [s for s in stages if str(s["id"]) not in wanted]
        cls._write_positions(ordered)
        _invalidate_caches()
        return cls.list_stages(include_inactive=True)

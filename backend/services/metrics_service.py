"""Indicadores operativos del corralón (sólo lectura).

Junta presupuestos, historial de etapas, actividades, usuarios, clientes, obras y catálogo, y devuelve
series ya calculadas para cada pestaña de Indicadores. Nunca escribe: sólo lee de los otros servicios.

Convenciones de todas las respuestas:
- «Período»: los últimos `days` días hasta ahora; «período anterior»: los `days` días previos.
- «Cotizado»: presupuestos creados en el período (cualquier estado).
- «Vendido» / «perdido»: presupuestos cerrados (ganados / perdidos) dentro del período.
- «Abierto»: foto actual de los presupuestos abiertos.
- Tiempos por etapa: salen de filas consecutivas del historial de etapas. La etapa actual de un presupuesto
  abierto corre hasta ahora y va marcada como «en curso».
- Los promedios sin datos vuelven como `None` (nunca se divide por cero).
"""

from __future__ import annotations

import logging
import re
import statistics
import time
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status

logger = logging.getLogger("crm.services.metrics")

ALLOWED_DAYS = (30, 90, 180, 365)
DAY = 86400.0

# Canales de contacto: la nota interna no es un contacto con el cliente y queda afuera.
CONTACT_TYPES = ("llamada", "whatsapp", "email", "visita_obra", "mostrador", "reunion", "presupuesto")
CHANNEL_GROUP = {
    "llamada": "llamada",
    "whatsapp": "whatsapp",
    "email": "email",
    "visita_obra": "presencial",
    "mostrador": "presencial",
    "reunion": "presencial",
    "presupuesto": "presupuesto",
}
CHANNEL_GROUPS = ("llamada", "whatsapp", "email", "presencial", "presupuesto")

HEALTHS = ("healthy", "warning", "stale")

# Rangos de monto (ARS) y de antigüedad (días) para las distribuciones de presupuestos.
AMOUNT_RANGES = (
    ("r1", 0, 250_000),
    ("r2", 250_000, 1_000_000),
    ("r3", 1_000_000, 3_000_000),
    ("r4", 3_000_000, 10_000_000),
    ("r5", 10_000_000, None),
)
AGE_RANGES = (("a1", 0, 7), ("a2", 8, 14), ("a3", 15, 30), ("a4", 31, 60), ("a5", 61, None))

PROJECT_TYPES = ("vivienda_unifamiliar", "edificio_multifamiliar", "comercial_industrial", "refaccion", "obra_publica")
PROJECT_STATUSES = ("en_curso", "planificacion", "frenada", "finalizada")
COMPANY_STATUSES = ("cliente", "potencial", "inactivo", "no_contactar")
CATEGORIES = ("Aglomerantes", "Áridos", "Hierros y Aceros", "Mampostería", "Techos e Hidráulica", "Servicios")
OTHER_CATEGORY = "Otros"
NO_REASON = "Sin motivo registrado"
NO_ORIGIN = "Sin origen"

_CACHE_TTL = 20.0
_FRACTION = re.compile(r"\.(\d+)")


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def _dt(value) -> datetime | None:
    """Fecha con zona horaria (UTC si viene sin zona) a partir de datetime, date o texto ISO."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        result = value
    elif isinstance(value, date):
        result = datetime(value.year, value.month, value.day)
    else:
        text = str(value).strip().replace("Z", "+00:00")
        text = _FRACTION.sub(lambda m: "." + (m.group(1) + "000000")[:6], text, count=1)
        try:
            result = datetime.fromisoformat(text)
        except ValueError:
            return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _days(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / DAY)


def _mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 2) if values else None


def _median(values: list[float]) -> float | None:
    return round(statistics.median(values), 2) if values else None


def _ratio(part: float, total: float) -> float | None:
    return round(part / total, 4) if total else None


def _money(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _amount(opp) -> float:
    return _money(getattr(opp, "estimated_value", 0))


def _discount(opp) -> float:
    try:
        return float(getattr(opp, "discount_pct", 0) or 0)
    except (TypeError, ValueError):
        return 0.0


def _version(opp) -> int:
    try:
        return int(getattr(opp, "current_version", 1) or 1)
    except (TypeError, ValueError):
        return 1


def _client_name(opp) -> str:
    return getattr(opp, "company_name", None) or getattr(opp, "contact_name", None) or "Sin cliente"


def _range_key(value: float, ranges) -> str:
    for key, low, high in ranges:
        if value >= low and (high is None or value < high):
            return key
    return ranges[-1][0]


def _age_key(days: int) -> str:
    for key, low, high in AGE_RANGES:
        if days >= low and (high is None or days <= high):
            return key
    return AGE_RANGES[-1][0]


@dataclass
class Segment:
    """Un paso de un presupuesto por una etapa abierta."""

    stage_id: str
    start: datetime
    end: datetime
    en_curso: bool
    next_stage_id: str | None = None

    @property
    def days(self) -> float:
        return _days(self.start, self.end)


@dataclass
class Journey:
    segments: list[Segment] = field(default_factory=list)
    closed_at: datetime | None = None


@dataclass
class Dataset:
    now: datetime
    opps: list
    stages: list[dict]
    history: list[dict]
    activities: list
    users: list


# ---------------------------------------------------------------------------
# Contexto de cálculo por consulta
# ---------------------------------------------------------------------------


class _Ctx:
    """Índices y ventanas de tiempo para un período. Se arma una vez por consulta."""

    def __init__(self, data: Dataset, days: int):
        self.data = data
        self.days = days
        self.now = data.now
        self.since = self.now - timedelta(days=days)
        self.prev_since = self.since - timedelta(days=days)
        self.opps = data.opps
        self.opp_by_id = {str(o.id): o for o in data.opps}

        self.stages = sorted(data.stages, key=lambda s: s.get("position") or 0)
        self.stage_by_id = {str(s["id"]): s for s in self.stages}
        self.open_stages = [s for s in self.stages if not s.get("is_closed_won") and not s.get("is_closed_lost")]
        self.won_stage_ids = {str(s["id"]) for s in self.stages if s.get("is_closed_won")}
        self.lost_stage_ids = {str(s["id"]) for s in self.stages if s.get("is_closed_lost")}

        self.user_names: dict[str, str] = {str(u.id): u.full_name for u in data.users}
        for o in data.opps:
            if o.assigned_to and getattr(o, "assigned_to_name", None):
                self.user_names.setdefault(str(o.assigned_to), o.assigned_to_name)

        self.history_by_opp: dict[str, list[dict]] = defaultdict(list)
        for row in data.history:
            self.history_by_opp[str(row.get("opportunity_id"))].append(row)
        for rows in self.history_by_opp.values():
            rows.sort(key=lambda r: _dt(r.get("created_at")) or self.now)

        # Contactos (sin notas internas), del más viejo al más nuevo.
        self.contacts = sorted(
            (a for a in data.activities if self._type(a) in CONTACT_TYPES and _dt(a.activity_date)),
            key=lambda a: _dt(a.activity_date),
        )
        self.contacts_by_opp: dict[str, list] = defaultdict(list)
        for a in self.contacts:
            if a.opportunity_id:
                self.contacts_by_opp[str(a.opportunity_id)].append(a)

        self.journeys = {str(o.id): self._journey(o) for o in data.opps}

        self.granularity = "week" if days <= 90 else "month"
        self.bucket_starts = self._bucket_starts()

    # --- tiempo -----------------------------------------------------------
    @staticmethod
    def _type(activity) -> str:
        value = getattr(activity, "activity_type", "")
        return getattr(value, "value", value) or ""

    def in_period(self, when: datetime | None) -> bool:
        return when is not None and self.since <= when <= self.now

    def in_previous(self, when: datetime | None) -> bool:
        return when is not None and self.prev_since <= when < self.since

    def _bucket_starts(self) -> list[datetime]:
        base = self.since.replace(hour=0, minute=0, second=0, microsecond=0)
        if self.granularity == "week":
            current = base - timedelta(days=base.weekday())
        else:
            current = base.replace(day=1)
        starts = []
        while current <= self.now:
            starts.append(current)
            if self.granularity == "week":
                current = current + timedelta(days=7)
            else:
                current = (current.replace(day=28) + timedelta(days=4)).replace(day=1)
        return starts

    def bucket_of(self, when: datetime | None) -> int | None:
        if not self.in_period(when):
            return None
        index = bisect_right(self.bucket_starts, when) - 1
        return index if index >= 0 else None

    def empty_buckets(self, **fields) -> list[dict]:
        return [
            {"start": s.date().isoformat(), **{k: (v() if callable(v) else v) for k, v in fields.items()}}
            for s in self.bucket_starts
        ]

    # --- recorrido por etapas ------------------------------------------------
    def _journey(self, opp) -> Journey:
        created = _dt(opp.created_at) or self.now
        rows = self.history_by_opp.get(str(opp.id), [])
        points: list[tuple[datetime, str]] = []
        if rows:
            first_at = _dt(rows[0].get("created_at")) or created
            if rows[0].get("from_stage_id") and created < first_at:
                points.append((created, str(rows[0]["from_stage_id"])))
            for r in rows:
                points.append((_dt(r.get("created_at")) or created, str(r.get("to_stage_id"))))
        else:
            # Sin historial registrado: se asume que está en su etapa actual desde que se creó.
            points.append((created, str(opp.stage_id)))

        journey = Journey()
        is_open = opp.status == "abierta"
        closed_entry: datetime | None = None
        for index, (at, stage_id) in enumerate(points):
            nxt = points[index + 1] if index + 1 < len(points) else None
            if stage_id in self.won_stage_ids or stage_id in self.lost_stage_ids:
                closed_entry = at
                continue
            en_curso = False
            if nxt:
                end = nxt[0]
            elif is_open:
                end, en_curso = self.now, True
            else:
                end = _dt(opp.updated_at) or self.now
            journey.segments.append(
                Segment(stage_id, at, max(end, at), en_curso, next_stage_id=nxt[1] if nxt else None)
            )
        # Filas repetidas de la misma etapa (p. ej. una reasignación) no cortan el tramo.
        journey.segments = self._merge_repeats(journey.segments)
        if not is_open:
            journey.closed_at = closed_entry or _dt(opp.updated_at) or created
        return journey

    @staticmethod
    def _merge_repeats(segments: list[Segment]) -> list[Segment]:
        merged: list[Segment] = []
        for seg in segments:
            if merged and merged[-1].stage_id == seg.stage_id and merged[-1].end >= seg.start:
                merged[-1].end = seg.end
                merged[-1].en_curso = seg.en_curso
                merged[-1].next_stage_id = seg.next_stage_id
            else:
                merged.append(seg)
        return merged

    def closed_at(self, opp) -> datetime | None:
        return self.journeys[str(opp.id)].closed_at

    def cycle_days(self, opp) -> float | None:
        closed = self.closed_at(opp)
        created = _dt(opp.created_at)
        return round(_days(created, closed), 2) if closed and created else None

    def current_segment(self, opp) -> Segment | None:
        segs = self.journeys[str(opp.id)].segments
        return segs[-1] if segs and segs[-1].en_curso else None

    def days_in_stage(self, opp) -> int | None:
        seg = self.current_segment(opp)
        return int(seg.days) if seg else None

    def stage_name(self, stage_id) -> str:
        stage = self.stage_by_id.get(str(stage_id))
        return stage["name"] if stage else "Sin etapa"

    def position(self, stage_id) -> int:
        stage = self.stage_by_id.get(str(stage_id))
        return int(stage.get("position") or 0) if stage else 0

    # --- selecciones frecuentes ----------------------------------------------
    def won(self, period: str = "current", owner: str | None = None) -> list:
        return self._closed("ganada", period, owner)

    def lost(self, period: str = "current", owner: str | None = None) -> list:
        return self._closed("perdida", period, owner)

    def _closed(self, status_value: str, period: str, owner: str | None) -> list:
        check = self.in_period if period == "current" else self.in_previous
        return [
            o
            for o in self.opps
            if o.status == status_value and check(self.closed_at(o)) and (owner is None or str(o.assigned_to) == owner)
        ]

    def open(self, owner: str | None = None) -> list:
        return [o for o in self.opps if o.status == "abierta" and (owner is None or str(o.assigned_to) == owner)]

    def created_in_period(self) -> list:
        return [o for o in self.opps if self.in_period(_dt(o.created_at))]

    def contacts_in_period(self, user_id: str | None = None) -> list:
        return [
            a
            for a in self.contacts
            if self.in_period(_dt(a.activity_date)) and (user_id is None or str(a.user_id) == user_id)
        ]

    def gaps_between_contacts(self, opps: list) -> list[float]:
        """Días entre contactos consecutivos de cada presupuesto, cuando el segundo cae en el período."""
        gaps = []
        for o in opps:
            dates = [_dt(a.activity_date) for a in self.contacts_by_opp.get(str(o.id), [])]
            for prev, cur in zip(dates, dates[1:]):
                if self.in_period(cur):
                    gaps.append(_days(prev, cur))
        return gaps

    def first_response_hours(self, opp) -> float | None:
        acts = self.contacts_by_opp.get(str(opp.id), [])
        created = _dt(opp.created_at)
        if not acts or not created:
            return None
        return round(max(0.0, (_dt(acts[0].activity_date) - created).total_seconds() / 3600), 2)

    def outcome_summary(self, won: list, lost: list) -> dict:
        won_amount = sum(_amount(o) for o in won)
        closes = len(won) + len(lost)
        cycles = [c for c in (self.cycle_days(o) for o in won) if c is not None]
        return {
            "won_amount": round(won_amount, 2),
            "won_count": len(won),
            "lost_amount": round(sum(_amount(o) for o in lost), 2),
            "lost_count": len(lost),
            "close_rate": _ratio(len(won), closes),
            "avg_ticket": round(won_amount / len(won), 2) if won else None,
            "avg_cycle_days": _mean(cycles),
        }

    def outcome_buckets(self, owner: str | None = None, opps: list | None = None) -> list[dict]:
        buckets = self.empty_buckets(won_amount=0.0, won_count=0, lost_amount=0.0, lost_count=0)
        pool = opps if opps is not None else self.opps
        for o in pool:
            if o.status not in ("ganada", "perdida") or (owner and str(o.assigned_to) != owner):
                continue
            index = self.bucket_of(self.closed_at(o))
            if index is None:
                continue
            prefix = "won" if o.status == "ganada" else "lost"
            buckets[index][f"{prefix}_amount"] = round(buckets[index][f"{prefix}_amount"] + _amount(o), 2)
            buckets[index][f"{prefix}_count"] += 1
        for b in buckets:
            b["close_rate"] = _ratio(b["won_count"], b["won_count"] + b["lost_count"])
        return buckets

    def health_split(self, opps: list) -> dict:
        split = {h: {"count": 0, "amount": 0.0} for h in HEALTHS}
        for o in opps:
            h = o.health_status if o.health_status in split else "stale"
            split[h]["count"] += 1
            split[h]["amount"] = round(split[h]["amount"] + _amount(o), 2)
        return split

    def channel_counts(self, acts: list, grouped: bool = True) -> dict:
        keys = CHANNEL_GROUPS if grouped else CONTACT_TYPES
        counts = dict.fromkeys(keys, 0)
        for a in acts:
            t = self._type(a)
            key = CHANNEL_GROUP.get(t) if grouped else t
            if key in counts:
                counts[key] += 1
        return counts

    def open_row(self, o) -> dict:
        seg = self.current_segment(o)
        created = _dt(o.created_at)
        return {
            "id": str(o.id),
            "title": o.title,
            "client": _client_name(o),
            "seller_id": str(o.assigned_to) if o.assigned_to else None,
            "seller": self.user_names.get(str(o.assigned_to)) or "Sin responsable",
            "stage_id": str(o.stage_id),
            "stage_name": self.stage_name(o.stage_id),
            "amount": _amount(o),
            "health": o.health_status if o.health_status in HEALTHS else "stale",
            "days_since_last_activity": o.days_since_last_activity,
            "days_in_stage": int(seg.days) if seg else None,
            "age_days": int(_days(created, self.now)) if created else None,
            "version": _version(o),
            "discount_pct": _discount(o),
        }

    def top_materials(self, opps: list, limit: int = 8) -> list[dict]:
        acc: dict[str, dict] = {}
        for o in opps:
            for it in getattr(o, "items", None) or []:
                key = str(it.product_id) if it.product_id else it.product_name.strip().lower()
                row = acc.setdefault(
                    key,
                    {
                        "product_id": str(it.product_id) if it.product_id else None,
                        "name": it.product_name,
                        "unit": it.unit,
                        "quotes": set(),
                        "quantity": 0.0,
                        "amount": 0.0,
                    },
                )
                row["quotes"].add(str(o.id))
                row["quantity"] = round(row["quantity"] + float(it.quantity or 0), 3)
                row["amount"] = round(row["amount"] + _money(it.subtotal), 2)
        rows = [{**r, "quotes": len(r["quotes"])} for r in acc.values()]
        rows.sort(key=lambda r: (-r["amount"], -r["quotes"], r["name"]))
        return rows[:limit]


# ---------------------------------------------------------------------------
# Servicio
# ---------------------------------------------------------------------------


class MetricsService:
    """Indicadores por pestaña. Cada método devuelve un dict listo para JSON."""

    _cache: tuple[float, Dataset] | None = None

    @classmethod
    def clear_cache(cls) -> None:
        cls._cache = None

    @classmethod
    def _dataset(cls) -> Dataset:
        """Carga todo una sola vez cada 20 s: cambiar de pestaña no repite las consultas."""
        now_mono = time.monotonic()
        if cls._cache and now_mono - cls._cache[0] < _CACHE_TTL:
            cached = cls._cache[1]
            return Dataset(
                datetime.now(timezone.utc), cached.opps, cached.stages, cached.history, cached.activities, cached.users
            )

        from backend.controllers.opportunity_controller import list_stages
        from backend.services.opportunity_service import OpportunityService
        from backend.services.stage_history_service import StageHistoryService
        from backend.services.user_service import UserService

        data = Dataset(
            now=datetime.now(timezone.utc),
            opps=OpportunityService.get_opportunities(limit=500),
            stages=list(list_stages() or []),
            history=StageHistoryService.list_all(),
            activities=cls._activities(),
            users=UserService.list_users(),
        )
        cls._cache = (now_mono, data)
        return data

    @staticmethod
    def _activities() -> list:
        from backend.models.activity import ActivityResponse
        from backend.services.activity_service import ActivityService, _mock_activities

        try:
            return ActivityService.list_all()
        except TypeError as e:
            # Modo local con fechas con y sin zona horaria mezcladas: el orden lo resuelve _Ctx.
            logger.warning(f"Actividades con fechas mixtas, se leen sin ordenar: {e}")
            return [ActivityResponse(**a) for a in _mock_activities.values()]

    @classmethod
    def _ctx(cls, days: int) -> _Ctx:
        if days not in ALLOWED_DAYS:
            raise HTTPException(
                status_code=422,
                detail=f"El período debe ser uno de {', '.join(str(d) for d in ALLOWED_DAYS)} días",
            )
        return _Ctx(cls._dataset(), days)

    @staticmethod
    def _base(ctx: _Ctx) -> dict:
        return {
            "days": ctx.days,
            "granularity": ctx.granularity,
            "since": ctx.since.isoformat(),
            "until": ctx.now.isoformat(),
        }

    # --- Ventas ----------------------------------------------------------------
    @classmethod
    def sales(cls, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        won, lost = ctx.won(), ctx.lost()
        reasons: dict[str, dict] = {}
        for o in lost:
            reason = (o.loss_reason or "").strip() or NO_REASON
            row = reasons.setdefault(reason, {"reason": reason, "count": 0, "amount": 0.0})
            row["count"] += 1
            row["amount"] = round(row["amount"] + _amount(o), 2)
        sales = sorted(won, key=lambda o: -_amount(o))
        return {
            **cls._base(ctx),
            "summary": ctx.outcome_summary(won, lost),
            "previous": ctx.outcome_summary(ctx.won("previous"), ctx.lost("previous")),
            "buckets": ctx.outcome_buckets(),
            "loss_reasons": sorted(reasons.values(), key=lambda r: (-r["count"], -r["amount"], r["reason"])),
            "sales": [
                {
                    "id": str(o.id),
                    "title": o.title,
                    "client": _client_name(o),
                    "company_id": str(o.company_id) if o.company_id else None,
                    "seller_id": str(o.assigned_to) if o.assigned_to else None,
                    "seller": ctx.user_names.get(str(o.assigned_to)) or "Sin responsable",
                    "amount": _amount(o),
                    "closed_at": _iso(ctx.closed_at(o)),
                    "cycle_days": ctx.cycle_days(o),
                }
                for o in sales[:50]
            ],
        }

    # --- Vendedores -------------------------------------------------------------
    @classmethod
    def _seller_row(cls, ctx: _Ctx, user_id: str, role: str | None, is_active: bool) -> dict:
        mine = [o for o in ctx.opps if str(o.assigned_to) == user_id]
        open_ = [o for o in mine if o.status == "abierta"]
        won, lost = ctx.won(owner=user_id), ctx.lost(owner=user_id)
        acts = ctx.contacts_in_period(user_id)
        outcome = ctx.outcome_summary(won, lost)
        health = ctx.health_split(open_)
        return {
            "user_id": user_id,
            "name": ctx.user_names.get(user_id) or "Sin nombre",
            "role": role,
            "is_active": is_active,
            "open_count": len(open_),
            "pipeline_amount": round(sum(_amount(o) for o in open_), 2),
            "health": health,
            "stale_count": health["stale"]["count"],
            "won_count": outcome["won_count"],
            "won_amount": outcome["won_amount"],
            "lost_count": outcome["lost_count"],
            "close_rate": outcome["close_rate"],
            "avg_ticket": outcome["avg_ticket"],
            "contacts_total": len(acts),
            "contacts_by_channel": ctx.channel_counts(acts),
            "avg_days_between_contacts": _mean(ctx.gaps_between_contacts(mine)),
        }

    @classmethod
    def _team_summary(cls, ctx: _Ctx) -> dict:
        open_ = ctx.open()
        won, lost = ctx.won(), ctx.lost()
        prev = ctx.outcome_summary(ctx.won("previous"), ctx.lost("previous"))
        current = ctx.outcome_summary(won, lost)
        healthy = sum(1 for o in open_ if o.health_status == "healthy")
        return {
            "open_count": len(open_),
            "pipeline_amount": round(sum(_amount(o) for o in open_), 2),
            "healthy_pct": _ratio(healthy, len(open_)),
            **{k: current[k] for k in ("won_amount", "won_count", "lost_count", "close_rate", "avg_ticket")},
            "previous": {k: prev[k] for k in ("won_amount", "won_count", "lost_count", "close_rate", "avg_ticket")},
            "avg_days_between_contacts": _mean(ctx.gaps_between_contacts(ctx.opps)),
        }

    @classmethod
    def sellers(cls, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        owners = {str(o.assigned_to) for o in ctx.opps if o.assigned_to}
        actors = {str(a.user_id) for a in ctx.contacts_in_period()}
        rows = []
        seen = set()
        for u in ctx.data.users:
            uid = str(u.id)
            role = getattr(u.role, "value", u.role)
            # Vendedores activos siempre; admin y responsable comercial sólo si tienen presupuestos o contactos.
            if (u.is_active and role == "ejecutivo_ventas") or uid in owners or uid in actors:
                rows.append(cls._seller_row(ctx, uid, getattr(u.role, "value", u.role), u.is_active))
                seen.add(uid)
        for uid in sorted(owners - seen):
            rows.append(cls._seller_row(ctx, uid, None, False))
        rows.sort(key=lambda r: (-r["pipeline_amount"], -r["won_amount"], r["name"]))
        return {**cls._base(ctx), "summary": cls._team_summary(ctx), "sellers": rows}

    @classmethod
    def seller_detail(cls, user_id: UUID | str, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        uid = str(user_id)
        user = next((u for u in ctx.data.users if str(u.id) == uid), None)
        if not user and not any(str(o.assigned_to) == uid for o in ctx.opps):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos ese vendedor")
        role = getattr(user.role, "value", user.role) if user else None
        row = cls._seller_row(ctx, uid, role, bool(user and user.is_active))

        mine = {str(o.id) for o in ctx.opps if str(o.assigned_to) == uid}
        mine_days: dict[str, list[float]] = defaultdict(list)
        team_days: dict[str, list[float]] = defaultdict(list)
        for opp_id, journey in ctx.journeys.items():
            for seg in journey.segments:
                if seg.end < ctx.since:
                    continue
                team_days[seg.stage_id].append(seg.days)
                if opp_id in mine:
                    mine_days[seg.stage_id].append(seg.days)
        team = cls._team_summary(ctx)
        return {
            **cls._base(ctx),
            "seller": row,
            "team": {
                "close_rate": team["close_rate"],
                "avg_ticket": team["avg_ticket"],
                "avg_days_between_contacts": team["avg_days_between_contacts"],
            },
            "buckets": ctx.outcome_buckets(owner=uid),
            "stage_times": [
                {
                    "stage_id": str(s["id"]),
                    "name": s["name"],
                    "position": s.get("position"),
                    "avg_days": _mean(mine_days.get(str(s["id"]), [])),
                    "team_avg_days": _mean(team_days.get(str(s["id"]), [])),
                    "count": len(mine_days.get(str(s["id"]), [])),
                }
                for s in ctx.open_stages
            ],
            "activity_mix": [{"channel": k, "count": v} for k, v in row["contacts_by_channel"].items()],
            "open": sorted(
                (ctx.open_row(o) for o in ctx.open(owner=uid)),
                key=lambda r: (-(r["days_since_last_activity"] or 0), -r["amount"]),
            ),
        }

    # --- Etapas -----------------------------------------------------------------
    @classmethod
    def stages(cls, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        per_stage: dict[str, list[tuple[object, Segment]]] = defaultdict(list)
        per_cell: dict[tuple[str, str], list[float]] = defaultdict(list)
        for opp_id, journey in ctx.journeys.items():
            opp = ctx.opp_by_id[opp_id]
            for seg in journey.segments:
                if seg.end < ctx.since:
                    continue
                per_stage[seg.stage_id].append((opp, seg))
                per_cell[(str(opp.assigned_to), seg.stage_id)].append(seg.days)

        macro = []
        conversion = []
        for s in ctx.open_stages:
            sid = str(s["id"])
            pairs = per_stage.get(sid, [])
            segs = [seg for _, seg in pairs]
            durations = [seg.days for seg in segs]
            macro.append(
                {
                    "stage_id": sid,
                    "name": s["name"],
                    "position": s.get("position"),
                    "avg_days": _mean(durations),
                    "median_days": _median(durations),
                    "max_days": round(max(durations), 2) if durations else None,
                    "count": len(segs),
                    "en_curso": sum(1 for seg in segs if seg.en_curso),
                }
            )
            advanced = lost = back = en_curso = 0
            for opp, seg in pairs:
                if seg.en_curso:
                    en_curso += 1
                    continue
                nxt = seg.next_stage_id
                if nxt in ctx.lost_stage_ids or (nxt is None and opp.status == "perdida"):
                    lost += 1
                elif nxt in ctx.won_stage_ids or (nxt is None and opp.status == "ganada"):
                    advanced += 1
                elif nxt is not None and ctx.position(nxt) < ctx.position(sid):
                    back += 1
                else:
                    advanced += 1
            exited = advanced + lost + back
            conversion.append(
                {
                    "stage_id": sid,
                    "name": s["name"],
                    "entered": len(segs),
                    "advanced": advanced,
                    "lost": lost,
                    "back": back,
                    "en_curso": en_curso,
                    "advance_rate": _ratio(advanced, exited),
                    "loss_rate": _ratio(lost, exited),
                }
            )

        seller_ids = sorted({owner for owner, _ in per_cell}, key=lambda uid: ctx.user_names.get(uid, "~"))
        matrix = {
            "sellers": [{"user_id": uid, "name": ctx.user_names.get(uid) or "Sin responsable"} for uid in seller_ids],
            "stages": [{"stage_id": str(s["id"]), "name": s["name"]} for s in ctx.open_stages],
            "cells": [
                {"user_id": uid, "stage_id": sid, "avg_days": _mean(values), "count": len(values)}
                for (uid, sid), values in sorted(per_cell.items())
            ],
        }

        open_rows = [ctx.open_row(o) for o in ctx.open()]
        by_stage = []
        for s in ctx.open_stages:
            sid = str(s["id"])
            rows = [r for r in open_rows if r["stage_id"] == sid]
            ages = [r["days_in_stage"] for r in rows if r["days_in_stage"] is not None]
            by_stage.append(
                {
                    "stage_id": sid,
                    "name": s["name"],
                    "count": len(rows),
                    "amount": round(sum(r["amount"] for r in rows), 2),
                    "avg_days_in_stage": _mean([float(a) for a in ages]),
                    "max_days_in_stage": max(ages) if ages else None,
                }
            )

        slow = max((m for m in macro if m["avg_days"] is not None), key=lambda m: m["avg_days"], default=None)
        in_stage = [float(r["days_in_stage"]) for r in open_rows if r["days_in_stage"] is not None]
        won = ctx.won()
        cycles = [c for c in (ctx.cycle_days(o) for o in won) if c is not None]
        return {
            **cls._base(ctx),
            "summary": {
                "avg_cycle_days": _mean(cycles),
                "slowest_stage": {"stage_id": slow["stage_id"], "name": slow["name"], "avg_days": slow["avg_days"]}
                if slow
                else None,
                "open_count": len(open_rows),
                "avg_days_in_current_stage": _mean(in_stage),
                "stuck_count": sum(1 for d in in_stage if d > 14),
            },
            "macro": macro,
            "matrix": matrix,
            "conversion": conversion,
            "won_count": len(won),
            "open_by_stage": by_stage,
            "open": sorted(open_rows, key=lambda r: (-(r["days_in_stage"] or 0), -r["amount"])),
        }

    # --- Presupuestos ------------------------------------------------------------
    @classmethod
    def quotes(cls, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        open_ = ctx.open()
        considered_ids = {str(o.id) for o in open_}
        considered_ids |= {str(o.id) for o in ctx.won() + ctx.lost() + ctx.created_in_period()}
        considered = [ctx.opp_by_id[i] for i in considered_ids]

        ranges = {k: {"key": k, "min": lo, "max": hi, "count": 0, "amount": 0.0} for k, lo, hi in AMOUNT_RANGES}
        for o in considered:
            r = ranges[_range_key(_amount(o), AMOUNT_RANGES)]
            r["count"] += 1
            r["amount"] = round(r["amount"] + _amount(o), 2)

        ages = {k: {"key": k, "min": lo, "max": hi, "count": 0, "amount": 0.0} for k, lo, hi in AGE_RANGES}
        age_values = []
        for o in open_:
            created = _dt(o.created_at)
            age = int(_days(created, ctx.now)) if created else 0
            age_values.append(float(age))
            a = ages[_age_key(age)]
            a["count"] += 1
            a["amount"] = round(a["amount"] + _amount(o), 2)

        renegotiated = [o for o in considered if _version(o) > 1]
        discounted = [_discount(o) for o in considered if _discount(o) > 0]
        health = ctx.health_split(open_)
        return {
            **cls._base(ctx),
            "summary": {
                "open_count": len(open_),
                "open_amount": round(sum(_amount(o) for o in open_), 2),
                "considered_count": len(considered),
                "renegotiated_count": len(renegotiated),
                "renegotiated_pct": _ratio(len(renegotiated), len(considered)),
                "discounted_count": len(discounted),
                "avg_discount_pct": _mean(discounted),
                "avg_age_days": _mean(age_values),
            },
            "amount_ranges": list(ranges.values()),
            "age_ranges": list(ages.values()),
            "health": [{"health": h, **health[h]} for h in HEALTHS],
            "top_materials": ctx.top_materials(considered),
            "open": sorted((ctx.open_row(o) for o in open_), key=lambda r: -r["amount"]),
        }

    @classmethod
    def quote_detail(cls, opportunity_id: UUID | str, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        opp = ctx.opp_by_id.get(str(opportunity_id))
        if not opp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontramos ese presupuesto")
        journey = ctx.journeys[str(opp.id)]
        per_stage: dict[str, dict] = {}
        for seg in journey.segments:
            row = per_stage.setdefault(seg.stage_id, {"days": 0.0, "visits": 0, "en_curso": False})
            row["days"] = round(row["days"] + seg.days, 2)
            row["visits"] += 1
            row["en_curso"] = row["en_curso"] or seg.en_curso
        contacts = ctx.contacts_by_opp.get(str(opp.id), [])
        items = sorted(getattr(opp, "items", None) or [], key=lambda it: -_money(it.subtotal))
        created = _dt(opp.created_at)
        closed = journey.closed_at
        return {
            **cls._base(ctx),
            "quote": {
                **ctx.open_row(opp),
                "status": opp.status,
                "company_id": str(opp.company_id) if opp.company_id else None,
                "project_id": str(opp.project_id) if opp.project_id else None,
                "project_name": getattr(opp, "project_name", None),
                "loss_reason": opp.loss_reason,
                "created_at": _iso(created),
                "closed_at": _iso(closed),
                "cycle_days": ctx.cycle_days(opp),
            },
            "stage_times": [
                {
                    "stage_id": str(s["id"]),
                    "name": s["name"],
                    "position": s.get("position"),
                    **per_stage.get(str(s["id"]), {"days": 0.0, "visits": 0, "en_curso": False}),
                }
                for s in ctx.open_stages
            ],
            "segments": [
                {
                    "stage_id": seg.stage_id,
                    "name": ctx.stage_name(seg.stage_id),
                    "start": _iso(seg.start),
                    "end": _iso(seg.end),
                    "days": round(seg.days, 2),
                    "en_curso": seg.en_curso,
                }
                for seg in journey.segments
            ],
            "contacts_total": len(contacts),
            "contacts_by_channel": [{"channel": k, "count": v} for k, v in ctx.channel_counts(contacts, False).items()],
            "first_response_hours": ctx.first_response_hours(opp),
            "avg_days_between_contacts": _mean(
                [_days(_dt(a.activity_date), _dt(b.activity_date)) for a, b in zip(contacts, contacts[1:])]
            ),
            "versions": cls._versions(opp),
            "items": [
                {
                    "name": it.product_name,
                    "unit": it.unit,
                    "quantity": float(it.quantity or 0),
                    "amount": _money(it.subtotal),
                }
                for it in items[:8]
            ],
        }

    @staticmethod
    def _versions(opp) -> list[dict]:
        """Versiones de materiales, si el servicio de presupuestos ya las expone."""
        from backend.services.opportunity_service import OpportunityService

        getter = getattr(OpportunityService, "list_versions", None) or getattr(OpportunityService, "get_versions", None)
        if not getter:
            return []
        try:
            rows = getter(opp.id) or []
        except Exception as e:
            logger.warning(f"No se pudieron leer las versiones del presupuesto {opp.id}: {e}")
            return []

        def read(row, key: str, default=None):
            return row.get(key, default) if isinstance(row, dict) else getattr(row, key, default)

        out = [
            {
                "version": int(read(v, "version", 1) or 1),
                "total": _money(read(v, "total", 0)),
                "discount_pct": float(read(v, "discount_pct", 0) or 0),
                "note": read(v, "note"),
                "created_at": _iso(_dt(read(v, "created_at"))),
            }
            for v in rows
        ]
        out.sort(key=lambda r: r["version"])
        return out

    # --- Clientes ----------------------------------------------------------------
    @classmethod
    def clients(cls, days: int = 90) -> dict:
        from backend.services.company_service import CompanyService

        ctx = cls._ctx(days)
        companies = CompanyService.get_companies(limit=500)
        by_company: dict[str, list] = defaultdict(list)
        for o in ctx.opps:
            if o.company_id:
                by_company[str(o.company_id)].append(o)
        won_period_ids = {str(o.id) for o in ctx.won()}

        rows = []
        for c in companies:
            cid = str(c.id)
            mine = by_company.get(cid, [])
            won_all = [o for o in mine if o.status == "ganada"]
            won_period = [o for o in won_all if str(o.id) in won_period_ids]
            last_won = max((ctx.closed_at(o) for o in won_all if ctx.closed_at(o)), default=None)
            rows.append(
                {
                    "company_id": cid,
                    "name": c.name,
                    "status": getattr(c.status, "value", c.status),
                    "origin": c.origin or NO_ORIGIN,
                    "created_at": _iso(_dt(c.created_at)),
                    "quotes": len(mine),
                    "open_amount": round(sum(_amount(o) for o in mine if o.status == "abierta"), 2),
                    "quoted_amount": round(sum(_amount(o) for o in mine if ctx.in_period(_dt(o.created_at))), 2),
                    "won_amount": round(sum(_amount(o) for o in won_period), 2),
                    "won_count_period": len(won_period),
                    "won_count": len(won_all),
                    "last_won_at": _iso(last_won),
                }
            )

        buyers_all = [r for r in rows if r["won_count"] >= 1]
        buyers_period = [r for r in rows if r["won_count_period"] >= 1]
        repeat = [r for r in rows if r["won_count"] >= 2]
        new_current = [c for c in companies if ctx.in_period(_dt(c.created_at))]
        new_previous = [c for c in companies if ctx.in_previous(_dt(c.created_at))]
        won_period_total = sum(r["won_amount"] for r in buyers_period)

        new_buckets = ctx.empty_buckets(count=0)
        for c in new_current:
            index = ctx.bucket_of(_dt(c.created_at))
            if index is not None:
                new_buckets[index]["count"] += 1

        def group(key: str, order: tuple) -> list[dict]:
            acc: dict[str, dict] = {}
            for r in rows:
                g = acc.setdefault(r[key], {key: r[key], "count": 0, "won_amount": 0.0, "open_amount": 0.0})
                g["count"] += 1
                g["won_amount"] = round(g["won_amount"] + r["won_amount"], 2)
                g["open_amount"] = round(g["open_amount"] + r["open_amount"], 2)
            ordered = [acc.pop(k) for k in order if k in acc]
            return ordered + sorted(acc.values(), key=lambda g: (-g["count"], str(g[key])))

        active_rows = [r for r in rows if r["quotes"] or ctx.in_period(_dt(r["created_at"]))]
        return {
            **cls._base(ctx),
            "summary": {
                "clients": len(rows),
                "buyers": len(buyers_period),
                "repeat_buyers": len(repeat),
                "repeat_pct": _ratio(len(repeat), len(buyers_all)),
                "new_clients": len(new_current),
                "new_clients_previous": len(new_previous),
                "avg_won_per_buyer": round(won_period_total / len(buyers_period), 2) if buyers_period else None,
            },
            "top": sorted(
                (r for r in rows if r["won_amount"] or r["quoted_amount"]),
                key=lambda r: (-r["won_amount"], -r["quoted_amount"], r["name"]),
            )[:10],
            "new_buckets": new_buckets,
            "by_status": group("status", COMPANY_STATUSES),
            "by_origin": group("origin", ()),
            "clients": sorted(active_rows, key=lambda r: (-r["won_amount"], -r["open_amount"], r["name"])),
        }

    @classmethod
    def client_detail(cls, company_id: UUID | str, days: int = 90) -> dict:
        from backend.services.company_service import CompanyService

        ctx = cls._ctx(days)
        company = CompanyService.get_company_by_id(UUID(str(company_id)))
        cid = str(company.id)
        mine = [o for o in ctx.opps if str(o.company_id) == cid]
        won_all = [o for o in mine if o.status == "ganada"]
        lost_all = [o for o in mine if o.status == "perdida"]
        won_period = [o for o in won_all if ctx.in_period(ctx.closed_at(o))]
        closes = [ctx.closed_at(o) for o in won_all if ctx.closed_at(o)]
        projects: dict[str, dict] = {}
        for o in mine:
            if o.project_id:
                p = projects.setdefault(
                    str(o.project_id),
                    {"project_id": str(o.project_id), "name": o.project_name or "Obra", "quotes": 0, "amount": 0.0},
                )
                p["quotes"] += 1
                p["amount"] = round(p["amount"] + _amount(o), 2)
        return {
            **cls._base(ctx),
            "client": {
                "company_id": cid,
                "name": company.name,
                "status": getattr(company.status, "value", company.status),
                "origin": company.origin or NO_ORIGIN,
                "created_at": _iso(_dt(company.created_at)),
            },
            "summary": {
                "won_amount_period": round(sum(_amount(o) for o in won_period), 2),
                "won_count_period": len(won_period),
                "won_amount_total": round(sum(_amount(o) for o in won_all), 2),
                "won_count_total": len(won_all),
                "lost_count_total": len(lost_all),
                "close_rate_total": _ratio(len(won_all), len(won_all) + len(lost_all)),
                "open_amount": round(sum(_amount(o) for o in mine if o.status == "abierta"), 2),
                "open_count": sum(1 for o in mine if o.status == "abierta"),
                "first_won_at": _iso(min(closes)) if closes else None,
                "last_won_at": _iso(max(closes)) if closes else None,
            },
            "buckets": ctx.outcome_buckets(opps=mine),
            "top_materials": ctx.top_materials(won_all or mine),
            "projects": sorted(projects.values(), key=lambda p: -p["amount"]),
            "quotes": [
                {
                    **ctx.open_row(o),
                    "status": o.status,
                    "created_at": _iso(_dt(o.created_at)),
                    "closed_at": _iso(ctx.closed_at(o)),
                }
                for o in sorted(mine, key=lambda o: _dt(o.created_at) or ctx.now, reverse=True)
            ],
        }

    # --- Obras ---------------------------------------------------------------------
    @classmethod
    def _project_row(cls, ctx: _Ctx, project, mine: list, won_period_ids: set[str]) -> dict:
        return {
            "project_id": str(project.id),
            "name": project.name,
            "company_name": getattr(project, "company_name", None),
            "project_type": getattr(project.project_type, "value", project.project_type),
            "status": getattr(project.status, "value", project.status),
            "quotes": len(mine),
            "open_count": sum(1 for o in mine if o.status == "abierta"),
            "open_amount": round(sum(_amount(o) for o in mine if o.status == "abierta"), 2),
            "quoted_amount": round(sum(_amount(o) for o in mine if ctx.in_period(_dt(o.created_at))), 2),
            "won_amount": round(sum(_amount(o) for o in mine if str(o.id) in won_period_ids), 2),
            "won_count": sum(1 for o in mine if o.status == "ganada"),
            "lost_count": sum(1 for o in mine if o.status == "perdida"),
        }

    @classmethod
    def projects(cls, days: int = 90) -> dict:
        from backend.services.project_service import ProjectService

        ctx = cls._ctx(days)
        projects = ProjectService.get_projects(limit=500)
        by_project: dict[str, list] = defaultdict(list)
        for o in ctx.opps:
            if o.project_id:
                by_project[str(o.project_id)].append(o)
        won_period_ids = {str(o.id) for o in ctx.won()}
        rows = [cls._project_row(ctx, p, by_project.get(str(p.id), []), won_period_ids) for p in projects]

        def group(key: str, order: tuple) -> list[dict]:
            acc = {
                k: {key: k, "projects": 0, "quotes": 0, "open_amount": 0.0, "quoted_amount": 0.0, "won_amount": 0.0}
                for k in order
            }
            for r in rows:
                g = acc.setdefault(
                    r[key],
                    {
                        key: r[key],
                        "projects": 0,
                        "quotes": 0,
                        "open_amount": 0.0,
                        "quoted_amount": 0.0,
                        "won_amount": 0.0,
                    },
                )
                g["projects"] += 1
                g["quotes"] += r["quotes"]
                for m in ("open_amount", "quoted_amount", "won_amount"):
                    g[m] = round(g[m] + r[m], 2)
            return list(acc.values())

        created = ctx.created_in_period()
        without = [o for o in created if not o.project_id]
        with_quotes = [r for r in rows if r["quotes"]]
        return {
            **cls._base(ctx),
            "summary": {
                "projects": len(rows),
                "projects_with_quotes": len(with_quotes),
                "open_amount": round(sum(r["open_amount"] for r in rows), 2),
                "quoted_amount": round(sum(r["quoted_amount"] for r in rows), 2),
                "won_amount": round(sum(r["won_amount"] for r in rows), 2),
                "without_project_pct": _ratio(len(without), len(created)),
            },
            "by_type": group("project_type", PROJECT_TYPES),
            "by_status": group("status", PROJECT_STATUSES),
            "projects": sorted(rows, key=lambda r: (-(r["open_amount"] + r["won_amount"]), -r["quotes"], r["name"])),
        }

    @classmethod
    def project_detail(cls, project_id: UUID | str, days: int = 90) -> dict:
        from backend.services.project_service import ProjectService

        ctx = cls._ctx(days)
        project = ProjectService.get_project_by_id(UUID(str(project_id)))
        mine = [o for o in ctx.opps if str(o.project_id) == str(project.id)]
        won_period_ids = {str(o.id) for o in ctx.won()}
        row = cls._project_row(ctx, project, mine, won_period_ids)
        by_stage = []
        for s in ctx.stages:
            sid = str(s["id"])
            in_stage = [o for o in mine if str(o.stage_id) == sid]
            by_stage.append(
                {
                    "stage_id": sid,
                    "name": s["name"],
                    "count": len(in_stage),
                    "amount": round(sum(_amount(o) for o in in_stage), 2),
                    "is_closed_won": bool(s.get("is_closed_won")),
                    "is_closed_lost": bool(s.get("is_closed_lost")),
                }
            )
        return {
            **cls._base(ctx),
            "project": {**row, "address": getattr(project, "address", None)},
            "by_stage": by_stage,
            "top_materials": ctx.top_materials(mine),
            "quotes": [
                {
                    **ctx.open_row(o),
                    "status": o.status,
                    "created_at": _iso(_dt(o.created_at)),
                    "closed_at": _iso(ctx.closed_at(o)),
                }
                for o in sorted(mine, key=lambda o: _dt(o.created_at) or ctx.now, reverse=True)
            ],
        }

    # --- Contacto --------------------------------------------------------------------
    @classmethod
    def contact(cls, days: int = 90) -> dict:
        ctx = cls._ctx(days)
        acts = ctx.contacts_in_period()
        previous = [a for a in ctx.contacts if ctx.in_previous(_dt(a.activity_date))]
        buckets = ctx.empty_buckets(**{g: 0 for g in CHANNEL_GROUPS}, total=0)
        for a in acts:
            index = ctx.bucket_of(_dt(a.activity_date))
            group = CHANNEL_GROUP.get(ctx._type(a))
            if index is not None and group:
                buckets[index][group] += 1
                buckets[index]["total"] += 1

        created = ctx.created_in_period()
        responses = [(o, ctx.first_response_hours(o)) for o in created]
        hours = [h for _, h in responses if h is not None]

        users = {str(u.id): u for u in ctx.data.users}
        seller_ids = {str(a.user_id) for a in acts} | {str(o.assigned_to) for o in created if o.assigned_to}
        by_seller = []
        for uid in seller_ids:
            mine_acts = [a for a in acts if str(a.user_id) == uid]
            mine_opps = [o for o in ctx.opps if str(o.assigned_to) == uid]
            mine_hours = [h for o, h in responses if str(o.assigned_to) == uid and h is not None]
            user = users.get(uid)
            by_seller.append(
                {
                    "user_id": uid,
                    "name": ctx.user_names.get(uid) or "Sin nombre",
                    "is_active": bool(user and user.is_active),
                    "total": len(mine_acts),
                    "by_channel": ctx.channel_counts(mine_acts),
                    "first_response_avg_hours": _mean(mine_hours),
                    "avg_days_between_contacts": _mean(ctx.gaps_between_contacts(mine_opps)),
                }
            )
        by_seller.sort(key=lambda r: (-r["total"], r["name"]))

        types = ctx.channel_counts(acts, grouped=False)
        pending = [o for o in ctx.open() if not ctx.contacts_by_opp.get(str(o.id))]
        return {
            **cls._base(ctx),
            "summary": {
                "contacts": len(acts),
                "contacts_previous": len(previous),
                "calls": types["llamada"],
                "whatsapp": types["whatsapp"],
                "emails": types["email"],
                "in_person": types["visita_obra"] + types["mostrador"] + types["reunion"],
                "first_response_avg_hours": _mean(hours),
                "first_response_median_hours": _median(hours),
                "responded": len(hours),
                "awaiting_first_contact": len(pending),
                "avg_days_between_contacts": _mean(ctx.gaps_between_contacts(ctx.opps)),
            },
            "buckets": buckets,
            "by_type": [{"type": k, "count": v} for k, v in types.items()],
            "by_seller": by_seller,
        }

    # --- Catálogo ----------------------------------------------------------------------
    @classmethod
    def catalog(cls, days: int = 90) -> dict:
        from backend.services.product_service import ProductService

        ctx = cls._ctx(days)
        try:
            products = ProductService.get_products(is_active=None, limit=500)
        except Exception as e:
            logger.warning(f"No se pudo leer el catálogo para indicadores: {e}")
            products = []
        by_id = {str(p.id): p for p in products}
        by_name = {p.name.strip().lower(): p for p in products}

        acc: dict[str, dict] = {}

        def add(opp, kind: str) -> None:
            for it in getattr(opp, "items", None) or []:
                product = by_id.get(str(it.product_id)) if it.product_id else None
                product = product or by_name.get(it.product_name.strip().lower())
                key = str(product.id) if product else it.product_name.strip().lower()
                category = getattr(product.category, "value", product.category) if product else OTHER_CATEGORY
                row = acc.setdefault(
                    key,
                    {
                        "product_id": str(product.id) if product else None,
                        "code": product.code if product else None,
                        "name": product.name if product else it.product_name,
                        "category": category,
                        "unit": (product.unit if product else it.unit) or "unidad",
                        "quoted_quotes": set(),
                        "quoted_qty": 0.0,
                        "quoted_amount": 0.0,
                        "sold_quotes": set(),
                        "sold_qty": 0.0,
                        "sold_amount": 0.0,
                    },
                )
                row[f"{kind}_quotes"].add(str(opp.id))
                row[f"{kind}_qty"] = round(row[f"{kind}_qty"] + float(it.quantity or 0), 3)
                row[f"{kind}_amount"] = round(row[f"{kind}_amount"] + _money(it.subtotal), 2)

        for o in ctx.created_in_period():
            add(o, "quoted")
        for o in ctx.won():
            add(o, "sold")

        materials = [
            {**r, "quoted_quotes": len(r["quoted_quotes"]), "sold_quotes": len(r["sold_quotes"])} for r in acc.values()
        ]
        materials.sort(key=lambda r: (-r["quoted_amount"], -r["sold_amount"], r["name"]))

        cats = {c: {"category": c, "quoted_amount": 0.0, "sold_amount": 0.0, "materials": 0} for c in CATEGORIES}
        for m in materials:
            c = cats.setdefault(
                m["category"], {"category": m["category"], "quoted_amount": 0.0, "sold_amount": 0.0, "materials": 0}
            )
            c["quoted_amount"] = round(c["quoted_amount"] + m["quoted_amount"], 2)
            c["sold_amount"] = round(c["sold_amount"] + m["sold_amount"], 2)
            c["materials"] += 1
        categories = list(cats.values())
        quoted_total = round(sum(m["quoted_amount"] for m in materials), 2)
        sold_total = round(sum(m["sold_amount"] for m in materials), 2)
        leader = max(
            (c for c in categories if c["sold_amount"] or c["quoted_amount"]),
            key=lambda c: (c["sold_amount"], c["quoted_amount"]),
            default=None,
        )
        return {
            **cls._base(ctx),
            "summary": {
                "materials_quoted": sum(1 for m in materials if m["quoted_quotes"]),
                "materials_sold": sum(1 for m in materials if m["sold_quotes"]),
                "quoted_amount": quoted_total,
                "sold_amount": sold_total,
                "top_category": leader["category"] if leader else None,
            },
            "materials": materials,
            "top_quoted": sorted(
                (m for m in materials if m["quoted_amount"]), key=lambda m: (-m["quoted_amount"], m["name"])
            )[:8],
            "top_sold": sorted(
                (m for m in materials if m["sold_amount"]), key=lambda m: (-m["sold_amount"], m["name"])
            )[:8],
            "by_category": categories,
        }


__all__ = ["ALLOWED_DAYS", "CHANNEL_GROUPS", "MetricsService"]

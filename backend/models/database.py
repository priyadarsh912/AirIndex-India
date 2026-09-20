import os
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, Index, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
try:
    from sqlalchemy.dialects.postgresql import insert as pg_upsert
except ImportError:
    pg_upsert = None

_DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "airscope.db"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH}")

# For SQLite, ensure foreign keys and proper thread access
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class FareObservation(Base):
    __tablename__ = "fare_observation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    source = Column(String(32), nullable=False)  # 'LIVE_API', 'LIVE_SCRAPE', 'FIXTURE'
    provider = Column(String(64), nullable=False)
    origin = Column(String(8), nullable=False)
    destination = Column(String(8), nullable=False)
    carrier = Column(String(32), nullable=False)
    flight_no = Column(String(32), nullable=False)
    departure_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    lead_days = Column(Integer, nullable=False)  # 1, 7, 15, 30, 45, etc.
    cabin = Column(String(32), default="ECONOMY", nullable=False)
    fare_class = Column(String(16), nullable=True)
    base_fare = Column(Float, nullable=True)
    taxes_fees = Column(Float, nullable=True)
    fee_basis = Column(String(16), default="derived", nullable=False)  # 'reported', 'derived'
    total_fare = Column(Float, nullable=False)
    currency = Column(String(8), default="INR", nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    stops = Column(Integer, default=0, nullable=False)
    quality_score = Column(Float, default=100.0, nullable=False)
    is_outlier = Column(Boolean, default=False, nullable=False)
    dedup_key = Column(String(64), unique=True, nullable=False, index=True)

    __table_args__ = (
        Index("idx_route_collected", "origin", "destination", "collected_at"),
        Index("idx_route_window", "origin", "destination", "lead_days"),
        Index("idx_departure_date", "departure_date"),
        Index("idx_source", "source"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "collected_at": self.collected_at.isoformat() if self.collected_at else None,
            "source": self.source,
            "provider": self.provider,
            "origin": self.origin,
            "destination": self.destination,
            "carrier": self.carrier,
            "flight_no": self.flight_no,
            "departure_date": self.departure_date,
            "lead_days": self.lead_days,
            "cabin": self.cabin,
            "fare_class": self.fare_class,
            "base_fare": self.base_fare,
            "taxes_fees": self.taxes_fees,
            "fee_basis": self.fee_basis,
            "total_fare": self.total_fare,
            "currency": self.currency,
            "is_available": self.is_available,
            "stops": self.stops,
            "quality_score": self.quality_score,
            "is_outlier": self.is_outlier,
            "dedup_key": self.dedup_key,
        }


class CollectionRun(Base):
    __tablename__ = "collection_run"

    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    provider = Column(String(64), nullable=False)
    searches_used = Column(Integer, default=0, nullable=False)
    rows_written = Column(Integer, default=0, nullable=False)
    errors = Column(Text, nullable=True)
    status = Column(String(32), default="SUCCESS", nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "provider": self.provider,
            "searches_used": self.searches_used,
            "rows_written": self.rows_written,
            "errors": self.errors,
            "status": self.status,
        }


def compute_dedup_key(
    collection_date: str,
    provider: str,
    carrier: str,
    flight_no: str,
    origin: str,
    destination: str,
    departure_date: str,
    cabin: str,
) -> str:
    """
    Generate SHA256 dedup_key to ensure idempotency.
    latest quote per day wins.
    """
    raw_str = (
        f"{collection_date}_{provider.upper()}_{carrier.upper()}_{flight_no.upper()}_"
        f"{origin.upper()}_{destination.upper()}_{departure_date}_{cabin.upper()}"
    )
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def upsert_fare_observations(session: Session, records: List[Dict[str, Any]]) -> int:
    """
    Idempotently batch upsert fare observations.
    If dedup_key exists, update with latest values (latest quote per day wins).
    Returns number of rows upserted.
    """
    if not records:
        return 0

    now_utc = datetime.now(timezone.utc)
    for r in records:
        if "collected_at" not in r or r["collected_at"] is None:
            r["collected_at"] = now_utc
        # Calculate collection_date for dedup_key if not provided
        coll_date = r.get("collection_date")
        if not coll_date:
            c_at = r["collected_at"]
            coll_date = c_at.strftime("%Y-%m-%d") if isinstance(c_at, datetime) else str(c_at)[:10]

        if "dedup_key" not in r or not r["dedup_key"]:
            r["dedup_key"] = compute_dedup_key(
                collection_date=coll_date,
                provider=r.get("provider", "UNKNOWN"),
                carrier=r.get("carrier", "UNKNOWN"),
                flight_no=r.get("flight_no", "UNKNOWN"),
                origin=r.get("origin", "UNKNOWN"),
                destination=r.get("destination", "UNKNOWN"),
                departure_date=r.get("departure_date", ""),
                cabin=r.get("cabin", "ECONOMY"),
            )
        # Remove collection_date before writing to table if present
        r.pop("collection_date", None)

    is_sqlite = session.bind.dialect.name == "sqlite"

    update_cols = {
        "collected_at": None,
        "source": None,
        "provider": None,
        "origin": None,
        "destination": None,
        "carrier": None,
        "flight_no": None,
        "departure_date": None,
        "lead_days": None,
        "cabin": None,
        "fare_class": None,
        "base_fare": None,
        "taxes_fees": None,
        "fee_basis": None,
        "total_fare": None,
        "currency": None,
        "is_available": None,
        "stops": None,
        "quality_score": None,
        "is_outlier": None,
    }

    BATCH_SIZE = 500
    total_written = 0

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        if is_sqlite:
            stmt = sqlite_upsert(FareObservation).values(batch)
            set_dict = {col: getattr(stmt.excluded, col) for col in update_cols}
            stmt = stmt.on_conflict_do_update(
                index_elements=["dedup_key"],
                set_=set_dict,
            )
            session.execute(stmt)
        elif pg_upsert is not None:
            stmt = pg_upsert(FareObservation).values(batch)
            set_dict = {col: getattr(stmt.excluded, col) for col in update_cols}
            stmt = stmt.on_conflict_do_update(
                index_elements=["dedup_key"],
                set_=set_dict,
            )
            session.execute(stmt)
        else:
            # Generic fallback
            for r in batch:
                existing = session.query(FareObservation).filter_by(dedup_key=r["dedup_key"]).first()
                if existing:
                    for k, v in r.items():
                        setattr(existing, k, v)
                else:
                    session.add(FareObservation(**r))

        total_written += len(batch)

    session.commit()
    return total_written

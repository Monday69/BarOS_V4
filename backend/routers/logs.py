"""
BarOS V4 - Router Logs
Chemin : backend/routers/logs.py

Corrections v2 :
  - `from datetime import timezone` déplacé en haut — import dans le corps
    d'une fonction est un antipattern (exécuté à chaque appel).
  - db.query().filter().first() sur PK → db.get() (SQLAlchemy 2.0).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session
from typing import Optional
from datetime import timezone

from backend.database import get_db
from backend.models import SequenceLog, PourSequence

router = APIRouter()


# ── Sérialisation d'un log (DRY) ─────────────────────────────────────────────
def _log_dict(log: SequenceLog, with_sequence_id: bool = False) -> dict:
    d = {
        "id":        log.id,
        "timestamp": log.timestamp,
        "level":     log.level,
        "phase":     log.phase,
        "message":   log.message,
        "data":      log.data,
    }
    if with_sequence_id:
        d["sequence_id"] = log.sequence_id
    return d


# ── Logs d'une séquence ───────────────────────────────────────────────────────
@router.get("/sequences/{sequence_id}")
def get_sequence_logs(sequence_id: int, db: Session = Depends(get_db)):
    """
    Tous les logs d'une séquence spécifique, dans l'ordre chronologique.
    """
    logs = (
        db.query(SequenceLog)
        .filter(SequenceLog.sequence_id == sequence_id)
        .order_by(SequenceLog.timestamp.asc())
        .all()
    )

    # ✅ Fix : db.get() — lookup par PK (SQLAlchemy 2.0)
    seq = db.get(PourSequence, sequence_id)

    duration_s = None
    if seq and seq.start_time and seq.end_time:
        st = seq.start_time
        et = seq.end_time
        # ✅ Fix : timezone importé en haut, pas inline dans la fonction
        if st.tzinfo is None:
            st = st.replace(tzinfo=timezone.utc)
            et = et.replace(tzinfo=timezone.utc)
        duration_s = round((et - st).total_seconds(), 2)

    return {
        "sequence_id": sequence_id,
        "status":      seq.status    if seq else "UNKNOWN",
        "recipe_id":   seq.recipe_id if seq else None,
        "duration_s":  duration_s,
        "logs_count":  len(logs),
        "logs":        [_log_dict(log) for log in logs],
    }


# ── Logs récents (toutes séquences) ──────────────────────────────────────────
@router.get("/recent")
def get_recent_logs(
    limit: int           = Query(50,   ge=1, le=200),
    level: Optional[str] = Query(None, description="INFO | WARNING | ERROR | SUCCESS"),
    phase: Optional[str] = Query(None, description="INIT | STOCK_RESERVATION | HARDWARE | VALIDATION | REFUND"),
    db: Session = Depends(get_db),
):
    """Logs récents filtrables par niveau et/ou phase. Utile pour le monitoring temps réel."""
    query = db.query(SequenceLog)
    if level:
        query = query.filter(SequenceLog.level == level.upper())
    if phase:
        query = query.filter(SequenceLog.phase == phase.upper())

    logs = query.order_by(desc(SequenceLog.timestamp)).limit(limit).all()

    return {
        "count":   len(logs),
        "filters": {"level": level, "phase": phase},
        "logs":    [_log_dict(log, with_sequence_id=True) for log in logs],
    }


# ── Logs erreurs uniquement ───────────────────────────────────────────────────
@router.get("/errors")
def get_error_logs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Raccourci : ERROR et WARNING récents. Premier endroit à regarder quand une séquence plante."""
    logs = (
        db.query(SequenceLog)
        .filter(SequenceLog.level.in_(["ERROR", "WARNING"]))
        .order_by(desc(SequenceLog.timestamp))
        .limit(limit)
        .all()
    )
    return {
        "count": len(logs),
        "logs":  [_log_dict(log, with_sequence_id=True) for log in logs],
    }


# ── Résumé global ─────────────────────────────────────────────────────────────
@router.get("/summary")
def get_logs_summary(db: Session = Depends(get_db)):
    """Vue d'ensemble : compteurs par niveau et par phase."""
    by_level = db.query(
        SequenceLog.level,
        func.count(SequenceLog.id).label("count")
    ).group_by(SequenceLog.level).all()

    by_phase = db.query(
        SequenceLog.phase,
        func.count(SequenceLog.id).label("count")
    ).group_by(SequenceLog.phase).all()

    total  = db.query(PourSequence).count()
    failed = db.query(PourSequence).filter(
        PourSequence.status.in_(["FAILED_CONFIG", "FAILED_STOCK", "FAILED_HARDWARE"])
    ).count()

    return {
        "total_sequences":  total,
        "failed_sequences": failed,
        "success_rate":     round((total - failed) / total * 100, 1) if total > 0 else 100.0,
        "by_level":         {row.level: row.count for row in by_level},
        "by_phase":         {row.phase: row.count for row in by_phase},
    }
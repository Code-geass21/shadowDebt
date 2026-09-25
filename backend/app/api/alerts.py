from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List
from uuid import UUID
from datetime import datetime
from app.database import get_db
from app.schemas.alert import AlertResponse
from app.models.alert import Alert

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def list_alerts(db: Session = Depends(get_db)):
    # Send ALL alerts to the frontend and let React handle the filtering toggle!
    return db.query(Alert).order_by(Alert.trigger_date.desc()).all()

@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(Alert).filter(
        Alert.is_dismissed == False,
        Alert.is_sent == False
    ).count()
    return {"count": count}

@router.post("/{alert_id}/dismiss", response_model=AlertResponse)
def dismiss_alert(alert_id: UUID, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_dismissed  = True
    alert.dismissed_at  = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert

@router.post("/dismiss-all", status_code=204)
def dismiss_all(db: Session = Depends(get_db)):
    db.query(Alert).filter(Alert.is_dismissed == False).update({
        "is_dismissed": True,
        "dismissed_at": datetime.utcnow()
    })
    db.commit()

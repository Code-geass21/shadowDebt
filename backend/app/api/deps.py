from fastapi import Request, HTTPException, Depends
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings

def get_current_user(request: Request, db: Session = Depends(get_db)):
    # 1. Check for standard Bearer token in headers
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    # 2. Fallback to query parameter (Crucial so downloading statement PDFs/attachments still works!)
    if not token:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    user = db.execute(text("SELECT id, username, profile_picture FROM users WHERE username = :u"), {"u": username}).mappings().first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return dict(user)

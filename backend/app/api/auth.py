import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.utils.security import verify_password, get_password_hash, create_access_token
from app.api.deps import get_current_user
from app.config import settings
from pydantic import BaseModel

router = APIRouter()

class LoginData(BaseModel):
    username: str
    password: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

@router.post("/login")
def login(data: LoginData, db: Session = Depends(get_db)):
    user = db.execute(text("SELECT * FROM users WHERE username = :u"), {"u": data.username}).mappings().first()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = create_access_token(data={"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"username": user["username"], "profile_picture": user["profile_picture"]}

@router.post("/change-password")
def change_password(data: PasswordChange, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    db_user = db.execute(text("SELECT password_hash FROM users WHERE username = :u"), {"u": user["username"]}).mappings().first()
    if not verify_password(data.old_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    db.execute(text("UPDATE users SET password_hash = :hash WHERE username = :u"),
               {"hash": get_password_hash(data.new_password), "u": user["username"]})
    db.commit()
    return {"status": "success"}

@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1]
    filename = f"avatar_{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(await file.read())

    db.execute(text("UPDATE users SET profile_picture = :path WHERE username = :u"),
               {"path": filename, "u": user["username"]})
    db.commit()
    return {"profile_picture": filename}

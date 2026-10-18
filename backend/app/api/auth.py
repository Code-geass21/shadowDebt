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

# 👇 NEW: Schema for username updates
class UsernameChange(BaseModel):
    new_username: str

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

# 👇 NEW: The Username Update Endpoint
@router.post("/update-username")
def update_username(data: UsernameChange, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    new_name = data.new_username.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    # Prevent crashing the database by checking for duplicates first
    existing = db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": new_name}).mappings().first()
    if existing:
        raise HTTPException(status_code=400, detail="Username is already taken")

    # Update the row
    db.execute(text("UPDATE users SET username = :new WHERE username = :old"),
               {"new": new_name, "old": user["username"]})
    db.commit()

    # Generate a brand new token containing the new username to prevent immediate logout
    new_token = create_access_token(data={"sub": new_name})
    return {"access_token": new_token, "username": new_name}

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

# 👇 NEW: Public endpoint to fetch an avatar for the login screen
@router.get("/avatar/{username}")
def get_public_avatar(username: str, db: Session = Depends(get_db)):
    user = db.execute(text("SELECT profile_picture FROM users WHERE username = :u"), {"u": username}).mappings().first()
    if user and user["profile_picture"]:
        return {"profile_picture": user["profile_picture"]}
    return {"profile_picture": None}

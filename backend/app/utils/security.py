import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from app.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt strictly requires bytes, so we encode the strings first
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    # Generate the salt and hash, then decode back to a string for PostgreSQL
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    # Tokens last for 7 days so you aren't constantly logged out
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

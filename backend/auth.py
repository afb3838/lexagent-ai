import os

import jwt
from fastapi import Header, HTTPException

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

_jwks_client = None
if not SUPABASE_JWT_SECRET and SUPABASE_URL:
    _jwks_client = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def _decode(token: str) -> dict:
    if SUPABASE_JWT_SECRET:
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    if _jwks_client is None:
        raise HTTPException(500, "Sunucuda SUPABASE_URL tanimli degil. Render Environment ayarlarindan ekleyin.")
    signing_key = _jwks_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Giris yapmaniz gerekiyor.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = _decode(token)
    except jwt.PyJWTError as e:
        raise HTTPException(401, f"Gecersiz oturum: {e}")
    return {"id": claims["sub"], "email": claims.get("email")}

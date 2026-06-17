from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_all_tab_keys
from app.core.settings import settings
from app.db.session import get_db
from app.models.auth import User
from app.schemas.auth import AuthResponse, LoginRequest, UserResponse
from app.services.auth import authenticate_user, create_session_token, get_user_from_token, get_user_tab_keys


router = APIRouter(prefix="/auth", tags=["auth"])


async def serialize_user(db: AsyncSession, user: User) -> UserResponse:
    tab_permissions = get_all_tab_keys() if user.is_superuser else sorted(await get_user_tab_keys(db, user.id))
    return UserResponse(
        id=user.id,
        username=user.username,
        role="admin" if user.is_superuser else "user",
        is_superuser=user.is_superuser,
        tab_permissions=tab_permissions,
    )


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.auth_cookie_name,
        token,
        max_age=settings.auth_session_ttl_seconds,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    user = await authenticate_user(db, payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    set_auth_cookie(response, create_session_token(user))
    return AuthResponse(user=await serialize_user(db, user))


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(settings.auth_cookie_name, path="/", samesite="lax", secure=settings.auth_cookie_secure)


@router.get("/me", response_model=AuthResponse)
async def me(request: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await get_user_from_token(db, request.cookies.get(settings.auth_cookie_name))
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return AuthResponse(user=await serialize_user(db, user))

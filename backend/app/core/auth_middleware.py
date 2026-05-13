from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.settings import settings
from app.db.session import SessionLocal
from app.services.auth import get_user_from_token


PUBLIC_PATH_PREFIXES = (
    "/auth/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS" or request.url.path in {"/", ""}:
            return await call_next(request)

        if any(request.url.path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES):
            return await call_next(request)

        async with SessionLocal() as db:
            user = await get_user_from_token(db, request.cookies.get(settings.auth_cookie_name))

        if user is None:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        request.state.user = user
        return await call_next(request)

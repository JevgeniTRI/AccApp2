from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.permissions import can_access_required_tabs, get_required_tab_keys
from app.core.settings import settings
from app.db.session import SessionLocal
from app.services.auth import get_user_from_token, get_user_tab_keys


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
            user_tab_keys = await get_user_tab_keys(db, user.id) if user is not None and not user.is_superuser else set()

        if user is None:
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)

        required_tab_keys = get_required_tab_keys(request.url.path, request.method)
        if not can_access_required_tabs(
            is_superuser=user.is_superuser,
            granted_tab_keys=user_tab_keys,
            required_tab_keys=required_tab_keys,
        ):
            return JSONResponse({"detail": "Forbidden"}, status_code=403)

        request.state.user = user
        request.state.tab_permissions = user_tab_keys
        return await call_next(request)

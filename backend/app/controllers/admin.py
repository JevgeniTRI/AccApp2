from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ASSIGNABLE_TAB_KEYS, TAB_DEFINITIONS, get_all_tab_keys, normalize_tab_keys
from app.db.session import get_db
from app.models.auth import User
from app.schemas.admin import AdminUserCreateRequest, AdminUsersResponse, UserAccessUpdateRequest
from app.schemas.auth import TabPermissionResponse, UserResponse
from app.services.auth import get_user_tab_keys, hash_password, replace_user_tab_keys


router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(request: Request) -> User:
    user = getattr(request.state, "user", None)
    if user is None or not user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def serialize_tabs(*, include_admin: bool = True) -> list[TabPermissionResponse]:
    return [
        TabPermissionResponse(
            key=tab.key,
            label=tab.label,
            path=tab.path,
            is_admin_only=tab.is_admin_only,
        )
        for tab in TAB_DEFINITIONS
        if include_admin or not tab.is_admin_only
    ]


async def serialize_admin_user(db: AsyncSession, user: User) -> UserResponse:
    tab_permissions = get_all_tab_keys() if user.is_superuser else sorted(await get_user_tab_keys(db, user.id))
    return UserResponse(
        id=user.id,
        username=user.username,
        role="admin" if user.is_superuser else "user",
        is_superuser=user.is_superuser,
        tab_permissions=tab_permissions,
    )


def validate_assignable_tabs(tab_permissions: list[str]) -> list[str]:
    invalid_tabs = sorted(set(tab_permissions) - ASSIGNABLE_TAB_KEYS)
    if invalid_tabs:
        raise HTTPException(status_code=400, detail=f"Unknown tab permissions: {', '.join(invalid_tabs)}")
    return sorted(normalize_tab_keys(tab_permissions))


@router.get("/tabs", response_model=list[TabPermissionResponse])
async def get_admin_tabs(_: User = Depends(require_admin)) -> list[TabPermissionResponse]:
    return serialize_tabs()


@router.get("/users", response_model=AdminUsersResponse)
async def get_admin_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersResponse:
    result = await db.execute(select(User).order_by(User.username.asc(), User.id.asc()))
    users = list(result.scalars().all())
    return AdminUsersResponse(
        tabs=serialize_tabs(include_admin=False),
        users=[await serialize_admin_user(db, user) for user in users],
    )


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_admin_user(
    payload: AdminUserCreateRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    existing_user = await db.scalar(select(User).where(User.username == username))
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="User already exists")

    tab_permissions = validate_assignable_tabs(payload.tab_permissions)
    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_superuser=payload.is_superuser,
    )
    db.add(user)

    try:
        await db.flush()
        if not user.is_superuser:
            await replace_user_tab_keys(db, user, tab_permissions)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="User already exists") from exc

    return await serialize_admin_user(db, user)


@router.put("/users/{user_id}", response_model=UserResponse)
@router.put("/users/{user_id}/tabs", response_model=UserResponse)
async def put_user_access(
    user_id: int,
    payload: UserAccessUpdateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and not payload.is_superuser:
        raise HTTPException(status_code=400, detail="Cannot remove admin role from yourself")

    tab_permissions = validate_assignable_tabs(payload.tab_permissions)
    user.is_superuser = payload.is_superuser
    await replace_user_tab_keys(db, user, [] if user.is_superuser else tab_permissions)
    await db.commit()
    return await serialize_admin_user(db, user)

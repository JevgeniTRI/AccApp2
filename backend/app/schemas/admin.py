from pydantic import BaseModel, Field

from app.schemas.auth import TabPermissionResponse, UserResponse


class AdminUserCreateRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=6, max_length=255)
    is_superuser: bool = False
    tab_permissions: list[str] = Field(default_factory=list)


class AdminUsersResponse(BaseModel):
    tabs: list[TabPermissionResponse]
    users: list[UserResponse]


class UserAccessUpdateRequest(BaseModel):
    is_superuser: bool = False
    tab_permissions: list[str] = Field(default_factory=list)

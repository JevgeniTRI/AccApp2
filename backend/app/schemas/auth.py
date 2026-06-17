from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=255)


class TabPermissionResponse(BaseModel):
    key: str
    label: str
    path: str
    is_admin_only: bool = False


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_superuser: bool
    tab_permissions: list[str] = Field(default_factory=list)


class AuthResponse(BaseModel):
    user: UserResponse

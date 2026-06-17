from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import BigIntPrimaryKeyMixin, TimestampMixin


class User(BigIntPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)



class UserTabPermission(BigIntPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_tab_permissions"
    __table_args__ = (
        UniqueConstraint("user_id", "tab_key", name="uq_user_tab_permissions_user_tab"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tab_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

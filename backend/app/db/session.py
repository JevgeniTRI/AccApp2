from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.settings import settings


async_engine = create_async_engine(settings.async_database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(bind=async_engine, autoflush=False, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()

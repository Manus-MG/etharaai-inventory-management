from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from backend.app.config import settings

# Establish the base class for declarative models (SQLAlchemy 2.0 standard)
class Base(DeclarativeBase):
    pass

# Create the asynchronous database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENV == "dev",
    future=True
)

# Configure the sessionmaker for async database operations
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False
)

# Async dependency for route handlers to acquire db session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

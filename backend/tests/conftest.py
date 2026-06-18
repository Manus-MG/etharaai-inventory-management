import asyncio
from typing import AsyncGenerator, Generator
import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.app.database import Base, get_db
from backend.app.models import Product, Customer, Order, OrderItem

import os

# Use a temporary file-based SQLite database for tests to persist connection schema across tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///test.db"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)

# Enable foreign key constraints in SQLite (must be configured per connection)
from sqlalchemy import event
@event.listens_for(test_engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    expire_on_commit=False,
    autoflush=False
)

# Custom event loop fixture to run async tests cleanly
@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Auto-runs database setup and teardown once for the whole test session
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db() -> AsyncGenerator[None, None]:
    # Clean up any leftover test database file from previous interrupted runs
    if os.path.exists("test.db"):
        try:
            os.remove("test.db")
        except OSError:
            pass

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    # Dispose engine and delete the test database file
    await test_engine.dispose()
    if os.path.exists("test.db"):
        try:
            os.remove("test.db")
        except OSError:
            pass

# Session fixture that runs each test case inside a transaction and rolls back at the end
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        # Start transaction block
        await session.begin()
        yield session
        # Roll back changes to ensure database is perfectly fresh for the next test
        await session.rollback()

# Configures the Async HttpClient wrapping the FastAPI application and overrides the db dependency
@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    from backend.app.main import app
    
    # Register dependency override
    app.dependency_overrides[get_db] = _get_test_db
    
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
        
    # Clear overrides after the test finishes
    app.dependency_overrides.clear()

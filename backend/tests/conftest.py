import asyncio
from typing import AsyncGenerator, Generator
import pytest
import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.app.database import Base, get_db
from backend.app.models import Product, Customer, Order, OrderItem, User

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

@pytest_asyncio.fixture(autouse=True)
async def clean_database(db_session: AsyncSession):
    from backend.app.models import User, Customer, Product, Order, OrderItem
    from sqlalchemy import delete
    await db_session.execute(delete(OrderItem))
    await db_session.execute(delete(Order))
    await db_session.execute(delete(Customer))
    await db_session.execute(delete(User))
    await db_session.execute(delete(Product))
    await db_session.flush()

@pytest_asyncio.fixture
async def db_admin(db_session: AsyncSession) -> User:
    from backend.app.auth import get_password_hash
    admin = User(
        email="admin_test@example.com",
        hashed_password=get_password_hash("testpassword"),
        role="admin"
    )
    db_session.add(admin)
    await db_session.flush()
    return admin

@pytest_asyncio.fixture
async def db_customer(db_session: AsyncSession) -> Customer:
    from backend.app.auth import get_password_hash
    customer_user = User(
        email="customer_test@example.com",
        hashed_password=get_password_hash("testpassword"),
        role="customer"
    )
    db_session.add(customer_user)
    await db_session.flush()
    
    customer = Customer(
        full_name="Test Customer",
        email="customer_test@example.com",
        phone_number="1234567890",
        user_id=customer_user.id
    )
    db_session.add(customer)
    await db_session.flush()
    return customer

@pytest_asyncio.fixture
async def admin_client(db_session: AsyncSession, db_admin: User) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    from backend.app.main import app
    app.dependency_overrides[get_db] = _get_test_db
    
    from backend.app.auth import create_access_token
    token = create_access_token(data={"sub": db_admin.email})
    
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"}
    ) as ac:
        yield ac
        
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def customer_client(db_session: AsyncSession, db_customer: Customer) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    from backend.app.main import app
    app.dependency_overrides[get_db] = _get_test_db
    
    from backend.app.auth import create_access_token
    from backend.app.models import User
    res = await db_session.get(User, db_customer.user_id)
    token = create_access_token(data={"sub": res.email})
    
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"}
    ) as ac:
        yield ac
        
    app.dependency_overrides.clear()

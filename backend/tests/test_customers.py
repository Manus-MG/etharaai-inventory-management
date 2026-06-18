import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_customer(client: AsyncClient):
    response = await client.post(
        "/customers",
        json={"full_name": "Alice Smith", "email": "alice@example.com", "phone_number": "123-456-7890"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Alice Smith"
    assert data["email"] == "alice@example.com"
    assert data["phone_number"] == "123-456-7890"
    assert "id" in data

async def test_create_customer_duplicate_email(client: AsyncClient):
    # First creation
    await client.post(
        "/customers",
        json={"full_name": "First Alice", "email": "dup@example.com", "phone_number": "111-111-1111"}
    )
    # Duplicate creation
    response = await client.post(
        "/customers",
        json={"full_name": "Second Alice", "email": "dup@example.com", "phone_number": "222-222-2222"}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

async def test_create_customer_invalid_email(client: AsyncClient):
    response = await client.post(
        "/customers",
        json={"full_name": "Bob Jones", "email": "not-an-email", "phone_number": "333-333-3333"}
    )
    assert response.status_code == 422

async def test_get_customer_by_id(client: AsyncClient):
    create_resp = await client.post(
        "/customers",
        json={"full_name": "Customer A", "email": "a@example.com", "phone_number": "123"}
    )
    customer_id = create_resp.json()["id"]

    response = await client.get(f"/customers/{customer_id}")
    assert response.status_code == 200
    assert response.json()["full_name"] == "Customer A"

async def test_get_customer_not_found(client: AsyncClient):
    response = await client.get("/customers/99999")
    assert response.status_code == 404

async def test_list_customers(client: AsyncClient):
    await client.post(
        "/customers",
        json={"full_name": "Customer B", "email": "b@example.com", "phone_number": "234"}
    )
    await client.post(
        "/customers",
        json={"full_name": "Customer C", "email": "c@example.com", "phone_number": "345"}
    )

    response = await client.get("/customers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

async def test_delete_customer(client: AsyncClient):
    create_resp = await client.post(
        "/customers",
        json={"full_name": "Delete Customer", "email": "delete@example.com", "phone_number": "000"}
    )
    customer_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/customers/{customer_id}")
    assert delete_resp.status_code == 204

    # Verify 404 on fetch
    get_resp = await client.get(f"/customers/{customer_id}")
    assert get_resp.status_code == 404

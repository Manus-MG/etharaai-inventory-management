import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_customer(admin_client: AsyncClient):
    response = await admin_client.post(
        "/customers",
        json={"full_name": "Alice Smith", "email": "alice@example.com", "phone_number": "123-456-7890"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Alice Smith"
    assert data["email"] == "alice@example.com"
    assert data["phone_number"] == "123-456-7890"
    assert "id" in data

async def test_create_customer_duplicate_email(admin_client: AsyncClient):
    # First creation
    await admin_client.post(
        "/customers",
        json={"full_name": "First Alice", "email": "dup@example.com", "phone_number": "111-111-1111"}
    )
    # Duplicate creation
    response = await admin_client.post(
        "/customers",
        json={"full_name": "Second Alice", "email": "dup@example.com", "phone_number": "222-222-2222"}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

async def test_create_customer_invalid_email(admin_client: AsyncClient):
    response = await admin_client.post(
        "/customers",
        json={"full_name": "Bob Jones", "email": "not-an-email", "phone_number": "333-333-3333"}
    )
    assert response.status_code == 422

async def test_get_customer_by_id(admin_client: AsyncClient):
    create_resp = await admin_client.post(
        "/customers",
        json={"full_name": "Customer A", "email": "a@example.com", "phone_number": "123"}
    )
    customer_id = create_resp.json()["id"]

    response = await admin_client.get(f"/customers/{customer_id}")
    assert response.status_code == 200
    assert response.json()["full_name"] == "Customer A"

async def test_get_customer_not_found(admin_client: AsyncClient):
    response = await admin_client.get("/customers/99999")
    assert response.status_code == 404

async def test_list_customers(admin_client: AsyncClient):
    await admin_client.post(
        "/customers",
        json={"full_name": "Customer B", "email": "b@example.com", "phone_number": "234"}
    )
    await admin_client.post(
        "/customers",
        json={"full_name": "Customer C", "email": "c@example.com", "phone_number": "345"}
    )

    response = await admin_client.get("/customers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

async def test_delete_customer(admin_client: AsyncClient):
    create_resp = await admin_client.post(
        "/customers",
        json={"full_name": "Delete Customer", "email": "delete@example.com", "phone_number": "000"}
    )
    customer_id = create_resp.json()["id"]

    delete_resp = await admin_client.delete(f"/customers/{customer_id}")
    assert delete_resp.status_code == 204

    # Verify 404 on fetch
    get_resp = await admin_client.get(f"/customers/{customer_id}")
    assert get_resp.status_code == 404

# --- Authentication & Registration Security Tests ---

async def test_public_registration_and_login(client: AsyncClient):
    # Register a new customer user
    reg_resp = await client.post(
        "/auth/register",
        json={
            "email": "new_cust@example.com",
            "password": "custpassword",
            "full_name": "New Customer",
            "phone_number": "999-888-7777"
        }
    )
    assert reg_resp.status_code == 201
    assert "customer_id" in reg_resp.json()
    
    # Try duplicate registration
    reg_resp_dup = await client.post(
        "/auth/register",
        json={
            "email": "new_cust@example.com",
            "password": "custpassword",
            "full_name": "Duplicate Customer",
            "phone_number": "999-888-7777"
        }
    )
    assert reg_resp_dup.status_code == 409
    
    # Login with the newly registered customer credentials
    login_resp = await client.post(
        "/auth/login",
        data={
            "username": "new_cust@example.com",
            "password": "custpassword"
        }
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

async def test_customer_role_restrictions(customer_client: AsyncClient):
    # Customer trying to get customer list -> 403 Forbidden
    list_resp = await customer_client.get("/customers")
    assert list_resp.status_code == 403

    # Customer trying to get customer detail -> 403 Forbidden
    detail_resp = await customer_client.get("/customers/1")
    assert detail_resp.status_code == 403

    # Customer trying to create customer profile manually -> 403 Forbidden
    create_resp = await customer_client.post(
        "/customers",
        json={"full_name": "Hacker", "email": "hacker@example.com", "phone_number": "000"}
    )
    assert create_resp.status_code == 403

    # Customer trying to delete customer profile -> 403 Forbidden
    delete_resp = await customer_client.delete("/customers/1")
    assert delete_resp.status_code == 403

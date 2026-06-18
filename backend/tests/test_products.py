import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_product(admin_client: AsyncClient):
    response = await admin_client.post(
        "/products",
        json={"name": "Test Product", "sku": "SKU-123", "price": "19.99", "quantity_in_stock": 100}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Product"
    assert data["sku"] == "SKU-123"
    assert data["price"] == "19.99"
    assert data["quantity_in_stock"] == 100
    assert "id" in data

async def test_create_product_duplicate_sku(admin_client: AsyncClient):
    # First creation
    await admin_client.post(
        "/products",
        json={"name": "First Product", "sku": "SKU-DUP", "price": "10.00", "quantity_in_stock": 10}
    )
    # Duplicate creation
    response = await admin_client.post(
        "/products",
        json={"name": "Second Product", "sku": "SKU-DUP", "price": "12.00", "quantity_in_stock": 5}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

async def test_create_product_negative_values(admin_client: AsyncClient):
    # Test negative price
    response = await admin_client.post(
        "/products",
        json={"name": "Negative Price", "sku": "SKU-NEG-P", "price": "-5.00", "quantity_in_stock": 10}
    )
    assert response.status_code == 422

    # Test negative quantity
    response = await admin_client.post(
        "/products",
        json={"name": "Negative Stock", "sku": "SKU-NEG-Q", "price": "5.00", "quantity_in_stock": -10}
    )
    assert response.status_code == 422

async def test_get_product_by_id(client: AsyncClient, admin_client: AsyncClient):
    create_resp = await admin_client.post(
        "/products",
        json={"name": "Product A", "sku": "SKU-A", "price": "5.00", "quantity_in_stock": 10}
    )
    product_id = create_resp.json()["id"]

    # Retrieve publicly (unauthenticated client)
    response = await client.get(f"/products/{product_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Product A"

async def test_get_product_not_found(client: AsyncClient):
    response = await client.get("/products/99999")
    assert response.status_code == 404

async def test_list_products(client: AsyncClient, admin_client: AsyncClient):
    await admin_client.post(
        "/products",
        json={"name": "List Item A", "sku": "SKU-LIST-A", "price": "5.00", "quantity_in_stock": 10}
    )
    await admin_client.post(
        "/products",
        json={"name": "List Item B", "sku": "SKU-LIST-B", "price": "7.00", "quantity_in_stock": 20}
    )

    response = await client.get("/products")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

async def test_update_product(admin_client: AsyncClient):
    create_resp = await admin_client.post(
        "/products",
        json={"name": "Old Product", "sku": "SKU-OLD", "price": "100.00", "quantity_in_stock": 5}
    )
    product_id = create_resp.json()["id"]

    response = await admin_client.put(
        f"/products/{product_id}",
        json={"name": "Updated Product", "price": "110.00"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Product"
    assert data["price"] == "110.00"
    assert data["sku"] == "SKU-OLD" # remains unchanged

async def test_delete_product(client: AsyncClient, admin_client: AsyncClient):
    create_resp = await admin_client.post(
        "/products",
        json={"name": "Delete Me", "sku": "SKU-DEL", "price": "10.00", "quantity_in_stock": 5}
    )
    product_id = create_resp.json()["id"]

    delete_resp = await admin_client.delete(f"/products/{product_id}")
    assert delete_resp.status_code == 204

    # Verify 404 on fetch
    get_resp = await client.get(f"/products/{product_id}")
    assert get_resp.status_code == 404

async def test_product_modification_restricted(customer_client: AsyncClient, client: AsyncClient):
    # Verify anonymous (unauthenticated) client is blocked
    resp_create_anon = await client.post(
        "/products",
        json={"name": "Block Anon", "sku": "SKU-ANON", "price": "10.00", "quantity_in_stock": 5}
    )
    assert resp_create_anon.status_code == 401

    # Verify customer client is blocked from creating
    resp_create_cust = await customer_client.post(
        "/products",
        json={"name": "Block Cust", "sku": "SKU-CUST", "price": "10.00", "quantity_in_stock": 5}
    )
    assert resp_create_cust.status_code == 403

    # Verify customer client is blocked from updating
    resp_update_cust = await customer_client.put(
        "/products/1",
        json={"name": "Block Update"}
    )
    assert resp_update_cust.status_code == 403

    # Verify customer client is blocked from deleting
    resp_delete_cust = await customer_client.delete("/products/1")
    assert resp_delete_cust.status_code == 403

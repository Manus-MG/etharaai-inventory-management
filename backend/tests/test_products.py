import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_product(client: AsyncClient):
    response = await client.post(
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

async def test_create_product_duplicate_sku(client: AsyncClient):
    # First creation
    await client.post(
        "/products",
        json={"name": "First Product", "sku": "SKU-DUP", "price": "10.00", "quantity_in_stock": 10}
    )
    # Duplicate creation
    response = await client.post(
        "/products",
        json={"name": "Second Product", "sku": "SKU-DUP", "price": "12.00", "quantity_in_stock": 5}
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]

async def test_create_product_negative_values(client: AsyncClient):
    # Test negative price
    response = await client.post(
        "/products",
        json={"name": "Negative Price", "sku": "SKU-NEG-P", "price": "-5.00", "quantity_in_stock": 10}
    )
    assert response.status_code == 422

    # Test negative quantity
    response = await client.post(
        "/products",
        json={"name": "Negative Stock", "sku": "SKU-NEG-Q", "price": "5.00", "quantity_in_stock": -10}
    )
    assert response.status_code == 422

async def test_get_product_by_id(client: AsyncClient):
    create_resp = await client.post(
        "/products",
        json={"name": "Product A", "sku": "SKU-A", "price": "5.00", "quantity_in_stock": 10}
    )
    product_id = create_resp.json()["id"]

    response = await client.get(f"/products/{product_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Product A"

async def test_get_product_not_found(client: AsyncClient):
    response = await client.get("/products/99999")
    assert response.status_code == 404

async def test_list_products(client: AsyncClient):
    await client.post(
        "/products",
        json={"name": "List Item A", "sku": "SKU-LIST-A", "price": "5.00", "quantity_in_stock": 10}
    )
    await client.post(
        "/products",
        json={"name": "List Item B", "sku": "SKU-LIST-B", "price": "7.00", "quantity_in_stock": 20}
    )

    response = await client.get("/products")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

async def test_update_product(client: AsyncClient):
    create_resp = await client.post(
        "/products",
        json={"name": "Old Product", "sku": "SKU-OLD", "price": "100.00", "quantity_in_stock": 5}
    )
    product_id = create_resp.json()["id"]

    response = await client.put(
        f"/products/{product_id}",
        json={"name": "Updated Product", "price": "110.00"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Product"
    assert data["price"] == "110.00"
    assert data["sku"] == "SKU-OLD" # remains unchanged

async def test_delete_product(client: AsyncClient):
    create_resp = await client.post(
        "/products",
        json={"name": "Delete Me", "sku": "SKU-DEL", "price": "10.00", "quantity_in_stock": 5}
    )
    product_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/products/{product_id}")
    assert delete_resp.status_code == 204

    # Verify 404 on fetch
    get_resp = await client.get(f"/products/{product_id}")
    assert get_resp.status_code == 404

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_create_order_success(client: AsyncClient):
    # 1. Create a customer
    cust_resp = await client.post(
        "/customers",
        json={"full_name": "John Doe", "email": "john@example.com", "phone_number": "123"}
    )
    customer_id = cust_resp.json()["id"]

    # 2. Create products
    p1_resp = await client.post(
        "/products",
        json={"name": "Product 1", "sku": "SKU-P1", "price": "10.00", "quantity_in_stock": 50}
    )
    p2_resp = await client.post(
        "/products",
        json={"name": "Product 2", "sku": "SKU-P2", "price": "15.50", "quantity_in_stock": 20}
    )
    p1_id = p1_resp.json()["id"]
    p2_id = p2_resp.json()["id"]

    # 3. Create order
    order_resp = await client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [
                {"product_id": p1_id, "quantity": 5},
                {"product_id": p2_id, "quantity": 2}
            ]
        }
    )
    assert order_resp.status_code == 201
    order_data = order_resp.json()
    assert order_data["customer_id"] == customer_id
    # Price check: 5 * 10.00 + 2 * 15.50 = 50.00 + 31.00 = 81.00
    assert order_data["total_amount"] == "81.00"
    assert len(order_data["items"]) == 2

    # 4. Check stock decremented
    p1_get = await client.get(f"/products/{p1_id}")
    assert p1_get.json()["quantity_in_stock"] == 45 # 50 - 5
    p2_get = await client.get(f"/products/{p2_id}")
    assert p2_get.json()["quantity_in_stock"] == 18 # 20 - 2

async def test_create_order_insufficient_stock_rollback(client: AsyncClient):
    # 1. Create customer
    cust_resp = await client.post(
        "/customers",
        json={"full_name": "John Rollback", "email": "john_r@example.com", "phone_number": "123"}
    )
    customer_id = cust_resp.json()["id"]

    # 2. Create product with limited stock
    p_resp = await client.post(
        "/products",
        json={"name": "Limited Product", "sku": "SKU-LIM", "price": "100.00", "quantity_in_stock": 5}
    )
    product_id = p_resp.json()["id"]

    # 3. Request more than available stock
    order_resp = await client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 6}]
        }
    )
    assert order_resp.status_code == 400
    assert "Insufficient stock" in order_resp.json()["detail"]

    # 4. Verify stock remained unchanged at 5 (rollback check)
    p_get = await client.get(f"/products/{product_id}")
    assert p_get.json()["quantity_in_stock"] == 5

async def test_cancel_order_restores_stock(client: AsyncClient):
    # 1. Create customer and product
    cust_resp = await client.post(
        "/customers",
        json={"full_name": "John Cancel", "email": "john_c@example.com", "phone_number": "123"}
    )
    customer_id = cust_resp.json()["id"]

    p_resp = await client.post(
        "/products",
        json={"name": "Restorable Product", "sku": "SKU-REST", "price": "10.00", "quantity_in_stock": 10}
    )
    product_id = p_resp.json()["id"]

    # 2. Place order
    order_resp = await client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 4}]
        }
    )
    order_id = order_resp.json()["id"]

    # Verify stock decremented to 6
    p_get_1 = await client.get(f"/products/{product_id}")
    assert p_get_1.json()["quantity_in_stock"] == 6

    # 3. Delete/Cancel order
    del_resp = await client.delete(f"/orders/{order_id}")
    assert del_resp.status_code == 204

    # 4. Verify stock restored back to 10
    p_get_2 = await client.get(f"/products/{product_id}")
    assert p_get_2.json()["quantity_in_stock"] == 10

    # Verify order search returns 404
    get_order_resp = await client.get(f"/orders/{order_id}")
    assert get_order_resp.status_code == 404

async def test_restrict_delete_referenced_entities(client: AsyncClient):
    # 1. Setup entities
    cust_resp = await client.post(
        "/customers",
        json={"full_name": "Locked Cust", "email": "locked@example.com", "phone_number": "123"}
    )
    customer_id = cust_resp.json()["id"]

    p_resp = await client.post(
        "/products",
        json={"name": "Locked Prod", "sku": "SKU-LOCK", "price": "1.00", "quantity_in_stock": 10}
    )
    product_id = p_resp.json()["id"]

    # 2. Create order
    order_resp = await client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 1}]
        }
    )
    assert order_resp.status_code == 201

    # 3. Attempt to delete product: should fail with 409
    p_del = await client.delete(f"/products/{product_id}")
    assert p_del.status_code == 409
    assert "referenced" in p_del.json()["detail"]

    # 4. Attempt to delete customer: should fail with 409
    c_del = await client.delete(f"/customers/{customer_id}")
    assert c_del.status_code == 409
    assert "referenced" in c_del.json()["detail"]

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models import Customer, Product, Order

pytestmark = pytest.mark.asyncio

async def test_create_order_success(admin_client: AsyncClient, customer_client: AsyncClient, db_customer: Customer):
    customer_id = db_customer.id
    
    # 1. Create products (using admin_client)
    p1_resp = await admin_client.post(
        "/products",
        json={"name": "Product 1", "sku": "SKU-P1", "price": "10.00", "quantity_in_stock": 50}
    )
    p2_resp = await admin_client.post(
        "/products",
        json={"name": "Product 2", "sku": "SKU-P2", "price": "15.50", "quantity_in_stock": 20}
    )
    p1_id = p1_resp.json()["id"]
    p2_id = p2_resp.json()["id"]

    # 2. Create order (using customer_client)
    order_resp = await customer_client.post(
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

    # 3. Check stock decremented
    p1_get = await customer_client.get(f"/products/{p1_id}")
    assert p1_get.json()["quantity_in_stock"] == 45  # 50 - 5
    p2_get = await customer_client.get(f"/products/{p2_id}")
    assert p2_get.json()["quantity_in_stock"] == 18  # 20 - 2

async def test_create_order_insufficient_stock_rollback(admin_client: AsyncClient, customer_client: AsyncClient, db_customer: Customer):
    customer_id = db_customer.id
    
    # 1. Create product with limited stock (using admin_client)
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Limited Product", "sku": "SKU-LIM", "price": "100.00", "quantity_in_stock": 5}
    )
    product_id = p_resp.json()["id"]

    # 2. Request more than available stock
    order_resp = await customer_client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 6}]
        }
    )
    assert order_resp.status_code == 400
    assert "Insufficient stock" in order_resp.json()["detail"]

    # 3. Verify stock remained unchanged at 5 (rollback check)
    p_get = await customer_client.get(f"/products/{product_id}")
    assert p_get.json()["quantity_in_stock"] == 5

async def test_cancel_order_restores_stock(admin_client: AsyncClient, customer_client: AsyncClient, db_customer: Customer):
    customer_id = db_customer.id
    
    # 1. Create product (using admin_client)
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Restorable Product", "sku": "SKU-REST", "price": "10.00", "quantity_in_stock": 10}
    )
    product_id = p_resp.json()["id"]

    # 2. Place order (using customer_client)
    order_resp = await customer_client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 4}]
        }
    )
    order_id = order_resp.json()["id"]

    # Verify stock decremented to 6
    p_get_1 = await customer_client.get(f"/products/{product_id}")
    assert p_get_1.json()["quantity_in_stock"] == 6

    # 3. Delete/Cancel order
    del_resp = await customer_client.delete(f"/orders/{order_id}")
    assert del_resp.status_code == 204

    # 4. Verify stock restored back to 10
    p_get_2 = await customer_client.get(f"/products/{product_id}")
    assert p_get_2.json()["quantity_in_stock"] == 10

    # Verify order search returns 404 (for the customer)
    get_order_resp = await customer_client.get(f"/orders/{order_id}")
    assert get_order_resp.status_code == 404

async def test_restrict_delete_referenced_entities(admin_client: AsyncClient, customer_client: AsyncClient, db_customer: Customer):
    customer_id = db_customer.id
    
    # 1. Setup entities (using admin_client)
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Locked Prod", "sku": "SKU-LOCK", "price": "1.00", "quantity_in_stock": 10}
    )
    product_id = p_resp.json()["id"]

    # 2. Create order (using customer_client)
    order_resp = await customer_client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 1}]
        }
    )
    assert order_resp.status_code == 201

    # 3. Attempt to delete product: should fail with 409
    p_del = await admin_client.delete(f"/products/{product_id}")
    assert p_del.status_code == 409
    assert "referenced" in p_del.json()["detail"]

    # 4. Attempt to delete customer: should fail with 409
    c_del = await admin_client.delete(f"/customers/{customer_id}")
    assert c_del.status_code == 409
    assert "referenced" in c_del.json()["detail"]

async def test_order_security_boundaries(
    admin_client: AsyncClient,
    customer_client: AsyncClient,
    db_customer: Customer,
    db_session: AsyncSession
):
    from backend.app.models import User, Customer as ModelCustomer
    from backend.app.auth import get_password_hash, create_access_token
    import httpx
    
    customer_id = db_customer.id
    
    # 1. Create a second customer user in DB
    user2 = User(
        email="customer2@example.com",
        hashed_password=get_password_hash("testpassword"),
        role="customer"
    )
    db_session.add(user2)
    await db_session.flush()
    
    cust2 = ModelCustomer(
        full_name="Second Customer",
        email="customer2@example.com",
        phone_number="0987654321",
        user_id=user2.id
    )
    db_session.add(cust2)
    await db_session.flush()
    cust2_id = cust2.id
    
    # Pre-authorized client for customer2
    from backend.app.main import app
    from backend.app.database import get_db
    async def _get_test_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_test_db
    
    token2 = create_access_token(data={"sub": user2.email})
    client2 = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token2}"}
    )
    
    # 2. Admin creates a product
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Boundary Product", "sku": "SKU-BND", "price": "20.00", "quantity_in_stock": 100}
    )
    product_id = p_resp.json()["id"]
    
    # 3. Customer 1 places an order
    order1_resp = await customer_client.post(
        "/orders",
        json={
            "customer_id": customer_id,
            "items": [{"product_id": product_id, "quantity": 2}]
        }
    )
    order1_id = order1_resp.json()["id"]
    
    # 4. Customer 2 places an order
    order2_resp = await client2.post(
        "/orders",
        json={
            "customer_id": cust2_id,
            "items": [{"product_id": product_id, "quantity": 3}]
        }
    )
    order2_id = order2_resp.json()["id"]
    
    # 5. Customer 1 lists orders: should only see their own (order1)
    list1 = await customer_client.get("/orders")
    assert list1.status_code == 200
    ids1 = [o["id"] for o in list1.json()]
    assert order1_id in ids1
    assert order2_id not in ids1
    
    # 6. Customer 1 tries to view Customer 2's order: should fail with 403 Forbidden
    get2 = await customer_client.get(f"/orders/{order2_id}")
    assert get2.status_code == 403
    
    # 7. Customer 1 tries to delete Customer 2's order: should fail with 403 Forbidden
    del2 = await customer_client.delete(f"/orders/{order2_id}")
    assert del2.status_code == 403
    
    # 8. Admin can list all orders (both order1 and order2)
    admin_list = await admin_client.get("/orders")
    assert admin_list.status_code == 200
    admin_ids = [o["id"] for o in admin_list.json()]
    assert order1_id in admin_ids
    assert order2_id in admin_ids
    
    # 9. Admin can view details of any order
    admin_get2 = await admin_client.get(f"/orders/{order2_id}")
    assert admin_get2.status_code == 200
    
    # 10. Admin can cancel any order
    admin_del2 = await admin_client.delete(f"/orders/{order2_id}")
    assert admin_del2.status_code == 204
    
    # Cleanup app dependency overrides manually
    app.dependency_overrides.clear()


async def test_admin_create_order_existing_customer(admin_client: AsyncClient, db_customer: Customer):
    # 1. Create a product
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Admin Product 1", "sku": "SKU-ADM1", "price": "100.00", "quantity_in_stock": 10}
    )
    assert p_resp.status_code == 201
    product_id = p_resp.json()["id"]

    # 2. Admin places order using existing customer id
    order_resp = await admin_client.post(
        "/orders",
        json={
            "customer_id": db_customer.id,
            "items": [{"product_id": product_id, "quantity": 2}]
        }
    )
    assert order_resp.status_code == 201
    order_data = order_resp.json()
    assert order_data["customer_id"] == db_customer.id
    assert order_data["total_amount"] == "200.00"


async def test_admin_create_order_new_customer_registration(admin_client: AsyncClient, db_session: AsyncSession):
    # 1. Create a product
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Admin Product 2", "sku": "SKU-ADM2", "price": "50.00", "quantity_in_stock": 5}
    )
    assert p_resp.status_code == 201
    product_id = p_resp.json()["id"]

    # 2. Admin places order and registers new customer dynamically
    customer_email = "dynamic_cust@example.com"
    order_resp = await admin_client.post(
        "/orders",
        json={
            "customer_details": {
                "full_name": "Dynamic Customer",
                "email": customer_email,
                "phone_number": "123-456-7890"
            },
            "items": [{"product_id": product_id, "quantity": 1}]
        }
    )
    assert order_resp.status_code == 201
    order_data = order_resp.json()
    assert order_data["total_amount"] == "50.00"

    # 3. Verify customer was registered in DB
    from backend.app.models import Customer as ModelCustomer
    from sqlalchemy.future import select
    res = await db_session.execute(select(ModelCustomer).where(ModelCustomer.email == customer_email))
    customer = res.scalar_one_or_none()
    assert customer is not None
    assert customer.full_name == "Dynamic Customer"
    assert order_data["customer_id"] == customer.id


async def test_admin_create_order_invalid_payload(admin_client: AsyncClient):
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Admin Product 3", "sku": "SKU-ADM3", "price": "10.00", "quantity_in_stock": 5}
    )
    product_id = p_resp.json()["id"]

    order_resp = await admin_client.post(
        "/orders",
        json={
            "items": [{"product_id": product_id, "quantity": 1}]
        }
    )
    assert order_resp.status_code == 400
    assert "Either customer_id or customer_details must be provided" in order_resp.json()["detail"]


async def test_admin_create_order_duplicate_customer_email(admin_client: AsyncClient, db_customer: Customer):
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Admin Product 4", "sku": "SKU-ADM4", "price": "10.00", "quantity_in_stock": 5}
    )
    product_id = p_resp.json()["id"]

    order_resp = await admin_client.post(
        "/orders",
        json={
            "customer_details": {
                "full_name": "Duplicate User",
                "email": db_customer.email,
                "phone_number": "000-000-0000"
            },
            "items": [{"product_id": product_id, "quantity": 1}]
        }
    )
    assert order_resp.status_code == 409
    assert "already exists" in order_resp.json()["detail"]


async def test_admin_create_order_with_gst_slab(admin_client: AsyncClient, db_customer: Customer):
    # 1. Create a product
    p_resp = await admin_client.post(
        "/products",
        json={"name": "Taxable Product", "sku": "SKU-TAX", "price": "100.00", "quantity_in_stock": 10}
    )
    assert p_resp.status_code == 201
    product_id = p_resp.json()["id"]

    # 2. Place order with 18% GST slab
    order_resp = await admin_client.post(
        "/orders",
        json={
            "customer_id": db_customer.id,
            "gst_rate": "18.00",
            "items": [{"product_id": product_id, "quantity": 2}]
        }
    )
    assert order_resp.status_code == 201
    order_data = order_resp.json()
    # Subtotal is 200.00. GST (18%) is 36.00. Total amount should be 236.00
    assert float(order_data["gst_rate"]) == 18.00
    assert float(order_data["gst_amount"]) == 36.00
    assert float(order_data["total_amount"]) == 236.00

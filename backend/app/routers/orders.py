from collections import defaultdict
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from backend.app.database import get_db
from backend.app.models import Order, OrderItem, Product, Customer, User
from backend.app.schemas import OrderCreate, OrderResponse
from backend.app.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new order. Validates customer and stock levels atomically,
    deducts product inventory levels, and calculates pricing totals.
    """
    # Verify that user role is customer
    if current_user.role != "customer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only customers can place orders."
        )

    # 1. Verify that the Customer exists and belongs to current user
    customer_query = await db.execute(select(Customer).where(Customer.user_id == current_user.id))
    customer = customer_query.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found for the authenticated user."
        )

    # 2. Group order items by product_id to validate aggregate stock requirements
    grouped_items = defaultdict(int)
    for item in order_in.items:
        grouped_items[item.product_id] += item.quantity

    total_amount = Decimal("0.00")
    db_order_items = []

    try:
        # 3. Process each product under a write-lock (SELECT ... FOR UPDATE)
        for product_id, requested_qty in grouped_items.items():
            product_query = await db.execute(
                select(Product)
                .where(Product.id == product_id)
                .with_for_update()
            )
            product = product_query.scalar_one_or_none()

            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with ID {product_id} does not exist."
                )

            # Enforce stock limits
            if product.quantity_in_stock < requested_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for product '{product.name}' (SKU: {product.sku}). "
                        f"Requested: {requested_qty}, Available: {product.quantity_in_stock}."
                    )
                )

            # Deduct stock level
            product.quantity_in_stock -= requested_qty

            # Auto-calculate totals using current product price snapshot
            subtotal = product.price * Decimal(requested_qty)
            total_amount += subtotal

            db_order_item = OrderItem(
                product_id=product_id,
                quantity=requested_qty,
                unit_price=product.price
            )
            db_order_items.append(db_order_item)

        # 4. Construct Order record
        db_order = Order(
            customer_id=customer.id,
            total_amount=total_amount,
            items=db_order_items
        )

        db.add(db_order)
        await db.commit()

        # 5. Fetch the saved order with items eager loaded to construct response schema safely
        saved_order_query = await db.execute(
            select(Order)
            .where(Order.id == db_order.id)
            .options(selectinload(Order.items))
        )
        return saved_order_query.scalar_one()

    except HTTPException:
        # Re-raise validation exceptions and allow get_db middleware to handle rollback
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while placing the order: {str(e)}"
        )

@router.get("", response_model=List[OrderResponse])
async def list_orders(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves a list of all orders. Customers can only view their own orders.
    """
    if current_user.role == "customer":
        customer_query = await db.execute(select(Customer).where(Customer.user_id == current_user.id))
        customer = customer_query.scalar_one_or_none()
        if not customer:
            return []
        result = await db.execute(
            select(Order)
            .where(Order.customer_id == customer.id)
            .options(selectinload(Order.items))
            .offset(skip)
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .offset(skip)
            .limit(limit)
        )
    return result.scalars().all()

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves details of a specific order by ID.
    """
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )
        
    if current_user.role == "customer":
        customer_query = await db.execute(select(Customer).where(Customer.user_id == current_user.id))
        customer = customer_query.scalar_one_or_none()
        if not customer or order.customer_id != customer.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this order."
            )
    return order

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancels/Deletes an order. Restores product inventory stocks atomically.
    """
    try:
        # 1. Fetch Order with write lock and eager load items
        result = await db.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.items))
            .with_for_update()
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with ID {order_id} not found."
            )
            
        if current_user.role == "customer":
            customer_query = await db.execute(select(Customer).where(Customer.user_id == current_user.id))
            customer = customer_query.scalar_one_or_none()
            if not customer or order.customer_id != customer.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to cancel this order."
                )
            
        # 2. Iterate through items and restore product quantities
        for item in order.items:
            product_query = await db.execute(
                select(Product)
                .where(Product.id == item.product_id)
                .with_for_update()
            )
            product = product_query.scalar_one_or_none()
            if product:
                # Add ordered quantity back to stock
                product.quantity_in_stock += item.quantity
                
        # 3. Delete order (OrderItem cascade delete is automatic)
        await db.delete(order)
        await db.commit()
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while cancelling the order: {str(e)}"
        )
    return None

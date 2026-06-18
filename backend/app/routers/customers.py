from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from backend.app.database import get_db
from backend.app.models import Customer, User
from backend.app.schemas import CustomerCreate, CustomerResponse, CustomerUpdate
from backend.app.auth import get_current_active_admin

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Creates a new customer. Validates email uniqueness.
    """
    # Check if Email already exists
    email_check = await db.execute(select(Customer).where(Customer.email == customer_in.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Customer with email '{customer_in.email}' already exists."
        )
        
    db_customer = Customer(
        full_name=customer_in.full_name,
        email=customer_in.email,
        phone_number=customer_in.phone_number
    )
    
    db.add(db_customer)
    try:
        await db.commit()
        await db.refresh(db_customer)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity check failed."
        )
    return db_customer

@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Retrieves a list of all customers.
    """
    result = await db.execute(select(Customer).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Retrieves details of a specific customer by ID.
    """
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
    return customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Deletes a customer by ID. Blocks deletion if customer is referenced by existing orders.
    """
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
        
    try:
        await db.delete(customer)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete customer because they are referenced in existing orders."
        )
    return None

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
):
    """
    Updates details of an existing customer by ID. Validates email uniqueness.
    """
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID {customer_id} not found."
        )
        
    if customer_in.email is not None and customer_in.email != customer.email:
        email_check = await db.execute(
            select(Customer).where(Customer.email == customer_in.email, Customer.id != customer_id)
        )
        if email_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Customer with email '{customer_in.email}' already exists."
            )
        customer.email = customer_in.email

    if customer_in.full_name is not None:
        customer.full_name = customer_in.full_name
    if customer_in.phone_number is not None:
        customer.phone_number = customer_in.phone_number

    try:
        await db.commit()
        await db.refresh(customer)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity check failed."
        )
    return customer

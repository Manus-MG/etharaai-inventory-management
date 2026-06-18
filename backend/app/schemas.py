from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, EmailStr

# ==========================================
# Product Schemas
# ==========================================

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="The name of the product")
    sku: str = Field(..., min_length=1, max_length=100, description="Unique SKU code")
    price: Decimal = Field(..., gt=0, decimal_places=2, description="Price of the product (must be greater than 0)")
    quantity_in_stock: int = Field(..., ge=0, description="Available inventory stock (must be 0 or greater)")

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    quantity_in_stock: Optional[int] = Field(None, ge=0)

class ProductResponse(ProductBase):
    id: int
    
    # Pydantic v2 ORM configuration
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Customer Schemas
# ==========================================

class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name of the customer")
    email: EmailStr = Field(..., description="Valid email address of the customer")
    phone_number: str = Field(..., min_length=1, max_length=100, description="Phone number")

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = Field(None)
    phone_number: Optional[str] = Field(None, min_length=1, max_length=100)

class CustomerResponse(CustomerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Order Schemas
# ==========================================

class OrderItemCreate(BaseModel):
    product_id: int = Field(..., description="ID of the product being ordered")
    quantity: int = Field(..., gt=0, description="Quantity ordered (must be greater than 0)")

class OrderCreate(BaseModel):
    customer_id: int = Field(..., description="ID of the customer placing the order")
    items: List[OrderItemCreate] = Field(..., min_length=1, description="List of ordered items (must contain at least 1 item)")

class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    product_id: int
    quantity: int
    unit_price: Decimal

    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    customer_id: int
    total_amount: Decimal
    created_at: datetime
    items: List[OrderItemResponse]

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Auth/Security Schemas
# ==========================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=1, max_length=255)
    phone_number: str = Field(..., min_length=1, max_length=100)

class Token(BaseModel):
    access_token: str
    token_type: str



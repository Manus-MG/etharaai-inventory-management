from decimal import Decimal
from typing import Optional
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


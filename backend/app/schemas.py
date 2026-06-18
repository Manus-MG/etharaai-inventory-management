from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

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

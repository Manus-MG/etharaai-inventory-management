from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from backend.app.database import get_db
from backend.app.models import User, Customer
from backend.app.schemas import UserRegister, Token
from backend.app.auth import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if User already exists
    user_check = await db.execute(select(User).where(User.email == user_in.email))
    if user_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists."
        )
        
    # Check if Customer already exists with same email
    customer_check = await db.execute(select(Customer).where(Customer.email == user_in.email))
    if customer_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer with this email already exists."
        )

    # Create User
    hashed_pwd = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        role="customer"
    )
    db.add(db_user)
    
    try:
        await db.commit()
        await db.refresh(db_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity failure while creating user."
        )
        
    # Create associated Customer profile
    db_customer = Customer(
        full_name=user_in.full_name,
        email=user_in.email,
        phone_number=user_in.phone_number,
        user_id=db_user.id
    )
    db.add(db_customer)
    
    try:
        await db.commit()
        await db.refresh(db_customer)
    except IntegrityError:
        await db.rollback()
        # Clean up created user on failure
        await db.delete(db_user)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity failure while creating customer profile."
        )
        
    return {"message": "User registered successfully", "customer_id": db_customer.id}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

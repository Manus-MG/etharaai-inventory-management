from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.routers import products, customers

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade backend for the Inventory & Order Management System",
    version="1.0.0",
)

app.include_router(products.router)
app.include_router(customers.router)

# CORS middleware configuration to allow seamless integration with frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to specific domains in production settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Verifies API readiness and checks database connectivity by executing a quick query.
    """
    try:
        # Execute a lightweight query to verify the connection is active
        await db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "app_name": settings.APP_NAME,
            "environment": settings.ENV
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connectivity check failed: {str(e)}"
        )

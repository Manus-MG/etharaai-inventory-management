# Inventory & Order Management System

A production-grade, full-stack inventory and order management system built with a **Python (FastAPI)** backend, an asynchronous **PostgreSQL** database (via SQLAlchemy and Alembic), and a **React (TypeScript + Vite)** frontend.

---

## 🌟 Key Features

*   **Secure Authentication & Authorization**: Roles-based access control (`admin` vs. `customer`) using JWT access tokens and hashed passwords (via `bcrypt`).
*   **Atomic Order Processing**: Full database transaction-level safety for order creation (using `SELECT ... FOR UPDATE` write-locks) to prevent double-selling/race-conditions.
*   **Automatic Price Snapshots**: Captures and persists the product's unit price at the time of order creation, protecting order history from future price changes.
*   **Dynamic GST & Total Calculations**: Auto-calculates subtotal, applies dynamic GST rates, calculates GST amount, and updates grand totals.
*   **Auto-Restore Inventory**: Canceling/deleting an order atomically restores the deducted item quantities back to the product inventory.
*   **Interactive Modern UI**: Beautiful responsive dashboard featuring data grids for managing products, customers, and order placements.

---

## 🏗️ Folder Structure

*   📁 [`backend/`](file:///Users/manasgupta/fullstackprojects/Etharaai/backend): FastAPI service, Alembic database migrations, configuration files, and unit tests.
*   📁 [`frontend/`](file:///Users/manasgupta/fullstackprojects/Etharaai/frontend): React web client configured with Vite, Tailwind CSS (v4), Zustand, and React Router.
*   📁 [`docs/`](file:///Users/manasgupta/fullstackprojects/Etharaai/docs): Setup and operational guides, including system runbooks and optimization playbooks.
*   📁 [`adapters/`](file:///Users/manasgupta/fullstackprojects/Etharaai/adapters): Model-specific guidelines and helper readmes.

---

## ⚙️ Environment Variables Config

### 1. Backend Service (`backend/.env`)
Create a file at `backend/.env` (referencing `backend/.env.example`):
*   `APP_NAME`: Title of the application (e.g., `"Inventory & Order Management System"`).
*   `ENV`: Development mode identifier (`dev` or `prod`).
*   `PORT`: Port to bind the FastAPI app (default: `8000`).
*   `HOST`: Host to bind the FastAPI app (default: `0.0.0.0`).
*   `POSTGRES_USER`: The username for the local PostgreSQL database (default: `postgres`).
*   `POSTGRES_PASSWORD`: The password for the local PostgreSQL database (default: `postgres`).
*   `POSTGRES_DB`: Name of the PostgreSQL database (default: `inventory_db`).
*   `DATABASE_URL`: Connection URI for the database.
    *   *Docker Network Connection*: `postgresql+asyncpg://postgres:postgres@db:5432/inventory_db`
    *   *Local Host Connection*: `postgresql+asyncpg://postgres:postgres@localhost:5432/inventory_db`
*   `SECRET_KEY`: Secret string used to sign JWT tokens (default: `supersecretkeychangeinproduction`).
*   `ALGORITHM`: Signature hashing algorithm (default: `HS256`).
*   `ACCESS_TOKEN_EXPIRE_MINUTES`: Expiration time duration for generated tokens (default: `60`).

### 2. Frontend Client (`frontend/.env`)
Create a file at `frontend/.env` (referencing `frontend/.env.example`):
*   `VITE_API_URL`: Base HTTP address of the running FastAPI server (default: `http://localhost:8000`).

---

## 🔄 Core Application Flows

### 🔑 Authentication Flow
*   **Registration (`POST /auth/register`)**:
    *   Creates a generic `User` credential record with `role="customer"`.
    *   Atomically seeds an associated `Customer` profile linked via `user_id`.
*   **Login (`POST /auth/login`)**:
    *   Authenticates credentials against bcrypt hashed passwords.
    *   Returns a JWT access token containing the email and user role.
*   **Seed Admin**:
    *   On start-up, the system automatically checks and seeds a default admin user if none exists:
        *   **Email**: `admin@inventory.com`
        *   **Password**: `adminpassword`

### 📦 Product & Customer Flow
*   **Products**:
    *   Admins manage products (Create, Read, Update, Delete).
    *   Product deletions are rejected with a `409 Conflict` if they are linked to any existing orders.
    *   Database-level check constraint prevents stock from dropping below `0`.
*   **Customers**:
    *   Admins manage customer profiles.
    *   Customer profile deletions are blocked if the customer has existing orders in the system.

### 🛒 Order Placement & Transaction Flow
1.  **Authorization & Identity**: User calls `POST /orders` with JWT token. Customers are locked to their own profiles; Admins can link any customer.
2.  **Concurrency Locking**: The database lock is acquired on products using `SELECT ... FOR UPDATE`.
3.  **Inventory Stock Check**: Verifies that the aggregate requested quantity does not exceed the available stock.
4.  **Deduction**: Decrements product stock atomically.
5.  **Pricing Capture**: Locks down the current product price inside `OrderItem` to keep order details historically accurate.
6.  **GST & Total Math**: Adds items subtotals, applies GST percent, adds tax amount, and saves the final invoice.
7.  **Transaction Commit**: Commits changes to the database. If any step fails, the entire transaction rolls back.

### ❌ Order Cancellation / Deletion Flow
*   **Stock Restoration**: Canceling an order locks the product inventory via `SELECT ... FOR UPDATE` and adds the ordered quantities back to their respective product stocks.
*   **Cascade Clean**: Once stock is returned, the order record is deleted (automatic cascade deletion cleans up child order items).

---

## 🗄️ Database Schema Summary

The database uses **PostgreSQL** with 5 primary tables:
*   👤 **`users`**: Manages auth credentials (`id`, `email`, `hashed_password`, `role`, `created_at`).
*   💼 **`customers`**: Holds customer records (`id`, `full_name`, `email`, `phone_number`, `user_id` [FK users]).
*   🏷️ **`products`**: Maintains inventory item details (`id`, `name`, `sku`, `price`, `quantity_in_stock`).
*   📝 **`orders`**: Stores order totals (`id`, `customer_id` [FK customers], `total_amount`, `gst_rate`, `gst_amount`, `created_at`).
*   ⛓️ **`order_items`**: Intersection table representing items purchased (`id`, `order_id` [FK orders], `product_id` [FK products], `quantity`, `unit_price`).

---

## 🚀 Getting Started

### Method A: Quick Start via Docker Compose (Recommended)
This approach builds and starts all services (PostgreSQL, FastAPI Backend, and React Frontend) with standard configurations.

1.  **Clone the Repository** and navigate to the project root directory.
2.  **Spin up containers**:
    ```bash
    docker-compose -f backend/docker-compose.yml up --build
    ```
3.  **Verify Services**:
    *   FastAPI backend running at `http://localhost:8000` (API Docs: `http://localhost:8000/docs`).
    *   React Client running at `http://localhost:3000`.
    *   PostgreSQL running at `localhost:5432`.

---

### Method B: Manual Step-by-Step Local Setup

#### Prerequisites
*   Python 3.12+ installed
*   Node.js v20+ / npm installed
*   A running PostgreSQL instance

#### 1. Setup the Database
1.  Create a database named `inventory_db` in your PostgreSQL instance.
2.  Initialize the configuration:
    ```bash
    cp backend/.env.example backend/.env
    ```
3.  Edit `backend/.env` and adjust `DATABASE_URL` to point to your local PostgreSQL server:
    ```env
    DATABASE_URL=postgresql+asyncpg://<username>:<password>@localhost:5432/inventory_db
    ```

#### 2. Setup and Start Backend
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run database migrations:
    ```bash
    alembic -c alembic.ini upgrade head
    ```
5.  Launch the FastAPI server:
    ```bash
    uvicorn backend.app.main:app --reload --port 8000
    ```

#### 3. Setup and Start Frontend
1.  Open a new terminal session and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Configure environment variables:
    ```bash
    cp .env.example .env
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the Vite local development server:
    ```bash
    npm run dev
    ```
5.  Open your browser and navigate to the server URL (usually `http://localhost:5173` or similar).

---

## 🧪 Running Automated Tests

A comprehensive suite of async unit tests verifies database integrity constraints, authorization logic, and transactional safety.

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```
2.  **Execute the test runner**:
    ```bash
    pytest -v
    ```

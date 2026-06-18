"""add_user_and_auth

Revision ID: 6e853d13a2e3
Revises: 03ae53b11d85
Create Date: 2026-06-18 14:27:35.646962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e853d13a2e3'
down_revision: Union[str, None] = '03ae53b11d85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Alter customers table to add user_id column and FK constraint
    op.add_column('customers', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_customers_user_id_users',
        'customers', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Drop FK and column from customers
    op.drop_constraint('fk_customers_user_id_users', 'customers', type_='foreignkey')
    op.drop_column('customers', 'user_id')
    
    # Drop users table
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')

from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.loan_fee import FeeStatus

class LoanFeeBase(BaseModel):
    loan_id: UUID
    fee_name: str
    amount: float
    status: FeeStatus = FeeStatus.pending
    # <--- NEW PHASE 3: TAX FIELDS --->
    tax_rate: Optional[float] = 0.0
    tax_amount: Optional[float] = 0.0
    created_at: Optional[datetime] = None  # <--- THE FIX: Allow historical timestamps

class LoanFeeCreate(LoanFeeBase):
    pass

class LoanFeeUpdate(BaseModel):
    fee_name: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[FeeStatus] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None

class LoanFeeResponse(LoanFeeBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

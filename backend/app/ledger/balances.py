# In-memory mock for ledger. In production, this uses SQLAlchemy/PostgreSQL.
BALANCES = {}

def create_balance(user_id: str):
    if user_id not in BALANCES:
        BALANCES[user_id] = {
            "ETH": 0.0,
            "USDC": 0.0,
            "POL": 0.0
        }

def credit(user_id: str, asset: str, amount: float):
    if user_id not in BALANCES:
        create_balance(user_id)
    BALANCES[user_id][asset] += amount

def debit(user_id: str, asset: str, amount: float):
    if user_id not in BALANCES or BALANCES[user_id].get(asset, 0) < amount:
        raise Exception(f"Insufficient {asset} balance")
    BALANCES[user_id][asset] -= amount

def get_balance(user_id: str):
    return BALANCES.get(user_id, {"ETH": 0.0, "USDC": 0.0, "POL": 0.0})
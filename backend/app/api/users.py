from app.wallets.hd import derive_eth_wallet
from app.ledger.balances import create_balance

def signup_user(user_id: str):
    wallet = derive_eth_wallet(user_id)
    create_balance(user_id)
    
    return {
        "user_id": user_id,
        "custodial_address": wallet["address"],
        "status": "active"
    }
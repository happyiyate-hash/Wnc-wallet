from eth_account import Account
from app.config import MASTER_SEED

Account.enable_unaudited_hdwallet_features()

def derive_eth_wallet(user_id: str):
    """
    Deterministically derive a wallet per user using an HD path.
    We convert the user_id (e.g. Firebase UID) into a deterministic index.
    """
    import hashlib
    # Generate a deterministic index from the user's unique ID
    index = int(hashlib.sha256(user_id.encode()).hexdigest(), 16) % 2147483647
    
    path = f"m/44'/60'/0'/0/{index}"
    acct = Account.from_mnemonic(
        MASTER_SEED,
        account_path=path
    )
    return {
        "address": acct.address,
        "private_key": acct.key.hex(),
        "path": path
    }
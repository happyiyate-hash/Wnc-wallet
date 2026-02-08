
from fastapi import FastAPI, HTTPException, Depends
from app.api.users import signup_user
from app.ledger.balances import get_balance
from app.ledger.swaps import execute_internal_swap
from app.blockchain.eth import send_eth

app = FastAPI(title="Wevina Programmable Custody")

@app.post("/users/signup")
async def signup(user_id: str):
    """
    Provision a new custodial account.
    """
    return signup_user(user_id)

@app.get("/users/{user_id}/balances")
async def balances(user_id: str):
    """
    Read the internal ledger for all assets.
    """
    return get_balance(user_id)

@app.post("/users/{user_id}/swap")
async def swap(user_id: str, from_asset: str, to_asset: str, amount: float, rate: float):
    """
    Off-chain internal swap.
    """
    try:
        return execute_internal_swap(user_id, from_asset, to_asset, amount, rate)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/users/{user_id}/withdraw")
async def withdraw(user_id: str, to_address: str, amount: float, chain_id: int):
    """
    Signs and broadcasts a withdrawal from the custodial wallet.
    """
    try:
        # Currently supports EVM. Can be extended to BTC/SOL.
        tx_hash = send_eth(user_id, to_address, amount)
        return {"status": "broadcasted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

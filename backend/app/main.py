from fastapi import FastAPI, HTTPException, Depends
from app.api.users import signup_user
from app.ledger.balances import get_balance
from app.ledger.swaps import execute_internal_swap
from app.blockchain.eth import send_eth

app = FastAPI(title="Wevina Custodial Backend")

@app.post("/users/signup")
async def signup(user_id: str):
    return signup_user(user_id)

@app.get("/users/{user_id}/balance")
async def balance(user_id: str):
    return get_balance(user_id)

@app.post("/users/{user_id}/swap")
async def swap(user_id: str, from_asset: str, to_asset: str, amount: float, rate: float):
    try:
        return execute_internal_swap(user_id, from_asset, to_asset, amount, rate)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/users/{user_id}/withdraw")
async def withdraw(user_id: str, to_address: str, amount: float):
    try:
        tx_hash = send_eth(user_id, to_address, amount)
        return {"status": "broadcasted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
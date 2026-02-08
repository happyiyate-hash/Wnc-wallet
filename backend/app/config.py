import os
from dotenv import load_dotenv

load_dotenv()

MASTER_SEED = os.getenv("MASTER_WALLET_SEED")
ETH_RPC_URL = os.getenv("ETH_RPC_URL")
DATABASE_URL = os.getenv("DATABASE_URL")
PORT = int(os.getenv("PORT", 8000))
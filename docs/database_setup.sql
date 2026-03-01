
-- ===================================================================================
-- WEVINA TERMINAL: INSTITUTIONAL REGISTRY SETUP
-- Version: 3.1.0
-- Purpose: Establishes omni-chain identity tables and atomic RPC functions.
-- ===================================================================================

-- 1. EXTEND PROFILES WITH MULTI-CHAIN SLOTS
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS vault_phrase TEXT,
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS vault_infura_key TEXT,
ADD COLUMN IF NOT EXISTS infura_iv TEXT,
ADD COLUMN IF NOT EXISTS evm_address TEXT,
ADD COLUMN IF NOT EXISTS xrp_address TEXT,
ADD COLUMN IF NOT EXISTS polkadot_address TEXT,
ADD COLUMN IF NOT EXISTS kusama_address TEXT,
ADD COLUMN IF NOT EXISTS near_address TEXT,
ADD COLUMN IF NOT EXISTS btc_address TEXT,
ADD COLUMN IF NOT EXISTS ltc_address TEXT,
ADD COLUMN IF NOT EXISTS doge_address TEXT,
ADD COLUMN IF NOT EXISTS solana_address TEXT,
ADD COLUMN IF NOT EXISTS cosmos_address TEXT,
ADD COLUMN IF NOT EXISTS osmosis_address TEXT,
ADD COLUMN IF NOT EXISTS secret_address TEXT,
ADD COLUMN IF NOT EXISTS injective_address TEXT,
ADD COLUMN IF NOT EXISTS celestia_address TEXT,
ADD COLUMN IF NOT EXISTS cardano_address TEXT,
ADD COLUMN IF NOT EXISTS tron_address TEXT,
ADD COLUMN IF NOT EXISTS algorand_address TEXT,
ADD COLUMN IF NOT EXISTS hedera_address TEXT,
ADD COLUMN IF NOT EXISTS tezos_address TEXT,
ADD COLUMN IF NOT EXISTS aptos_address TEXT,
ADD COLUMN IF NOT EXISTS sui_address TEXT,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS signup_date TIMESTAMPTZ DEFAULT now();

-- 2. REGISTRY TABLES
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blockchain_id TEXT NOT NULL, -- 'evm', 'xrp', 'solana', etc.
    address TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, blockchain_id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES auth.users(id),
    referred_id UUID REFERENCES auth.users(id) UNIQUE,
    status TEXT DEFAULT 'pending', -- 'pending', 'credited'
    reward_amount NUMERIC DEFAULT 400,
    created_at TIMESTAMPTZ DEFAULT now(),
    credited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES auth.users(id),
    requester_account_number TEXT NOT NULL,
    chain_type TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    token_address TEXT,
    amount NUMERIC NOT NULL,
    note TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'expired', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '48 hours')
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'swap'
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL, -- 'success', 'error', 'pending'
    timestamp TIMESTAMPTZ DEFAULT now(),
    tx_hash TEXT,
    token_symbol TEXT
);

-- 3. ATOMIC SYNC FUNCTION (Identity Handshake)
CREATE OR REPLACE FUNCTION public.sync_user_wallets(p_user_id UUID, p_wallets JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    wallet_record RECORD;
    col_name TEXT;
BEGIN
    FOR wallet_record IN SELECT * FROM jsonb_to_recordset(p_wallets) AS x(type TEXT, address TEXT)
    LOOP
        -- Update Wallets Table
        INSERT INTO public.wallets (user_id, blockchain_id, address, updated_at)
        VALUES (p_user_id, wallet_record.type, wallet_record.address, now())
        ON CONFLICT (user_id, blockchain_id) 
        DO UPDATE SET address = EXCLUDED.address, updated_at = now();

        -- Update Profile Column
        col_name := wallet_record.type || '_address';
        
        -- Handle mapping anomalies
        IF wallet_record.type = 'solana' THEN col_name := 'solana_address'; END IF;

        BEGIN
            EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', col_name)
            USING wallet_record.address, p_user_id;
        EXCEPTION WHEN OTHERS THEN
            -- Skip if column missing
        END;
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. ATOMIC WNC SETTLEMENT
CREATE OR REPLACE FUNCTION public.transfer_wnc(p_recipient_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID := auth.uid();
    v_sender_balance NUMERIC;
BEGIN
    -- 1. Check sender
    SELECT wnc_earnings INTO v_sender_balance FROM public.profiles WHERE id = v_sender_id;
    
    IF v_sender_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient WNC balance');
    END IF;

    -- 2. Atomic Move
    UPDATE public.profiles SET wnc_earnings = wnc_earnings - p_amount WHERE id = v_sender_id;
    UPDATE public.profiles SET wnc_earnings = wnc_earnings + p_amount WHERE id = p_recipient_id;

    -- 3. Log Movement
    INSERT INTO public.transactions (user_id, type, amount, status, timestamp, token_symbol)
    VALUES 
        (v_sender_id, 'withdrawal', p_amount, 'success', now(), 'WNC'),
        (p_recipient_id, 'deposit', p_amount, 'success', now(), 'WNC');

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

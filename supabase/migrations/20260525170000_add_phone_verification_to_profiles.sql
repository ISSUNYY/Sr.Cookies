-- Migration: Add phone verification columns to profiles table
-- Sr. Cookies - Reverse WhatsApp Verification Flow

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verification_code text DEFAULT null;

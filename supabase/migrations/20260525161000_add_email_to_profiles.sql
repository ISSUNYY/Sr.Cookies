-- Migration: Add email column to profiles table
-- Sr. Cookies - Dual Auth (Email/Phone) Sinc

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Migration: Enforce unique phone numbers on profiles
-- Sr. Cookies - Security Hardening

ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

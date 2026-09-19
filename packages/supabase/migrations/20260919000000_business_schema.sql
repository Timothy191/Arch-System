-- Migration: 00001_business_schema
-- Description: Core schema for Business Portal with Zero-Trust RLS

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users Profile Table (Extends Supabase Auth auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Roles Enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- 4. User Roles Mapping Table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Turn on Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ── RLS POLICIES ──────────────────────────────────────────────────────────

-- Users can only read their own profile
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

-- Users can view their assigned organization
CREATE POLICY "Users can view their organization" 
ON public.organizations FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.organization_id = organizations.id
    )
);

-- Users can view roles within their organization
CREATE POLICY "Users can view roles in their organization" 
ON public.user_roles FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
);

-- Functions & Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_org_modtime
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_user_modtime
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

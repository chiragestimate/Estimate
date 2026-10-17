-- ==============================================================================
-- Migration: Production Batches & Ingredients Schema (Decoupled from Formulations)
-- Date: 2026-10-09
-- ==============================================================================

-- 1. Create production_batches table
CREATE TABLE IF NOT EXISTS public.production_batches (
  id SERIAL PRIMARY KEY,
  batch_no VARCHAR(100) UNIQUE NULL,
  product_id INT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NULL,
  formula_name VARCHAR(255) NULL,
  quantity_produced DOUBLE PRECISION DEFAULT 0.0,
  date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create production_ingredients table
CREATE TABLE IF NOT EXISTS public.production_ingredients (
  id SERIAL PRIMARY KEY,
  production_id INT NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  inventory_id INT NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  inventory_name VARCHAR(255) NULL,
  quantity_used DOUBLE PRECISION DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ingredients ENABLE ROW LEVEL SECURITY;

-- 4. Policies for production_batches
DROP POLICY IF EXISTS "Enable read access for all users" ON public.production_batches;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.production_batches;
DROP POLICY IF EXISTS "Enable update for all users" ON public.production_batches;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.production_batches;

CREATE POLICY "Enable read access for all users" ON public.production_batches FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.production_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.production_batches FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.production_batches FOR DELETE USING (true);

-- 5. Policies for production_ingredients
DROP POLICY IF EXISTS "Enable read access for all users" ON public.production_ingredients;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.production_ingredients;
DROP POLICY IF EXISTS "Enable update for all users" ON public.production_ingredients;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.production_ingredients;

CREATE POLICY "Enable read access for all users" ON public.production_ingredients FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.production_ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.production_ingredients FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.production_ingredients FOR DELETE USING (true);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_prod_batches_date ON public.production_batches(date DESC);
CREATE INDEX IF NOT EXISTS idx_prod_batches_product_id ON public.production_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_ingredients_prod_id ON public.production_ingredients(production_id);
CREATE INDEX IF NOT EXISTS idx_prod_ingredients_inv_id ON public.production_ingredients(inventory_id);

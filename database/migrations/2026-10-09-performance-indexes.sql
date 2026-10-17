-- ==============================================================================
-- AGROCHEM / ANJANI ERP PERFORMANCE INDEXES
-- Optimizes query execution speeds across all ERP operations & Supabase requests
-- ==============================================================================

-- 1. Stock Batches (Heavily queried during inventory sync, sales orders, & purchases)
CREATE INDEX IF NOT EXISTS idx_stock_batches_item ON public.stock_batches (item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_stock_batches_current_qty ON public.stock_batches (current_qty);
CREATE INDEX IF NOT EXISTS idx_stock_batches_purchase_id ON public.stock_batches (purchase_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_batch_no ON public.stock_batches (batch_no);

-- 2. Order Line Items (Eliminates full table scans on order details & deletion)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

-- 3. Purchase Line Items (Eliminates full table scans on purchase loading & deletion)
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON public.purchase_items (item_id);

-- 4. Product Packaging (Speeds up pack size lookups & invoice autocomplete)
CREATE INDEX IF NOT EXISTS idx_product_packaging_product_id ON public.product_packaging (product_id);

-- 5. Orders (Accelerates dashboard KPI, filter by status, and date sorting)
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders (date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders (client_id);

-- 6. Purchases (Accelerates purchases listing, supplier ledger, and date sorting)
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases (date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases (status);

-- 7. Transactions (Accelerates account ledgers, receipt/payment summaries, and dates)
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);

-- 8. Expenses (Accelerates monthly KPI, category breakdowns, and reports)
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (category);

-- 9. Formulations & Formulation Ingredients (Speeds up batch calculator & production)
CREATE INDEX IF NOT EXISTS idx_formulation_ingredients_form_id ON public.formulation_ingredients (formulation_id);
CREATE INDEX IF NOT EXISTS idx_formulation_ingredients_prod_id ON public.formulation_ingredients (product_id);
CREATE INDEX IF NOT EXISTS idx_formulations_product_id ON public.formulations (product_id);

-- 10. Daily Transactions & Materials (Speeds up daily stock usage & history)
CREATE INDEX IF NOT EXISTS idx_daily_transactions_date ON public.daily_transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_materials_txn_id ON public.daily_transaction_materials (daily_transaction_id);
CREATE INDEX IF NOT EXISTS idx_daily_materials_item_id ON public.daily_transaction_materials (item_id);
CREATE INDEX IF NOT EXISTS idx_daily_items_txn_id ON public.daily_transaction_items (daily_transaction_id);

-- 11. Products & Inventory Items (Speeds up technical link resolution & search)
CREATE INDEX IF NOT EXISTS idx_products_inventory_id ON public.products (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items (category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items (name);

-- Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload_schema';

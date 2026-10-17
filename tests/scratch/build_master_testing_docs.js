/**
 * tests/scratch/build_master_testing_docs.js
 * Comprehensive Generator for ERP_COMPLETE_TESTING_HANDBOOK.md and ERP_TEST_CASES.csv
 * Code-verified, agrochemical-specific, dual-synchronized documentation builder.
 */

const fs = require('fs');
const path = require('path');

console.log('Generating ERP Complete Testing Handbook & Test Cases CSV...');

// Master Test Cases Catalog (94 exhaustive test cases)
const testCases = [
  // --- MODULE 1: AUTHENTICATION & LOGIN ---
  {
    id: 'TC-AUTH-001',
    module: 'Authentication & Session',
    page: 'login.html',
    feature: 'Admin Login',
    subfeature: 'Valid Credentials Submission',
    title: 'Super Admin Login & Automatic Dashboard Redirection',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Vite server running at http://localhost:5174. User is logged out.',
    testData: 'Email: admin@anjani.test | Password: Test@Agro2026! | Remember Me: Checked',
    steps: '1. Open http://localhost:5174/login.html in Google Chrome. 2. Verify page title displays "Anjani Agri Care ERP - Admin Login". 3. Enter "admin@anjani.test" into the User Email field. 4. Enter "Test@Agro2026!" into the Password field. 5. Check "Remember Me". 6. Click the "Sign In" button.',
    expected: 'Green toast "Login successful! Redirecting to dashboard..." appears. System authenticates session, stores token in localStorage, and automatically redirects browser to pages/dashboard.html within 2 seconds.',
    crossModule: 'Check localStorage in DevTools (F12 -> Application -> Local Storage): erp_active_role="super_admin", erp_user_email="admin@anjani.test".',
    passFail: 'PASS if login succeeds and user lands on dashboard.html with topbar showing Rajesh Vora. FAIL if error occurs or user remains on login.html.',
    evidence: 'Screenshot of dashboard.html immediately after login with topbar user avatar.',
    dependencies: 'None',
    cleanup: 'None required (valid active session needed for subsequent tests).',
    notes: 'Verifies core session token issuance and auto-redirection.'
  },
  {
    id: 'TC-AUTH-002',
    module: 'Authentication & Session',
    page: 'login.html',
    feature: 'Security Guard',
    subfeature: 'Invalid Credential Rejection',
    title: 'Invalid Password Rejection & Rate Limiting Guard',
    priority: 'P1',
    role: 'Unauthenticated User',
    company: 'N/A',
    preconditions: 'Browser on login.html.',
    testData: 'Email: admin@anjani.test | Password: WrongPassword999!',
    steps: '1. Navigate to login.html. 2. Enter email "admin@anjani.test". 3. Enter incorrect password "WrongPassword999!". 4. Click "Sign In".',
    expected: 'Access blocked. Red error banner "#login-error-banner" displays "Invalid login credentials. Please check your email and password." User remains on login.html. No session tokens created.',
    crossModule: 'Inspect DevTools console: 401 Unauthorized captured. LocalStorage contains no auth token.',
    passFail: 'PASS if access denied and clear error displayed. FAIL if user is granted access or page white-screens.',
    evidence: 'Screenshot of login.html showing red error banner.',
    dependencies: 'None',
    cleanup: 'None',
    notes: 'Protects system boundary against unauthorized credential stuffing.'
  },
  {
    id: 'TC-AUTH-003',
    module: 'Authentication & Session',
    page: 'login.html',
    feature: 'Password Visibility',
    subfeature: 'Eye Icon Toggle',
    title: 'Password Masking & Reveal Toggle',
    priority: 'P3',
    role: 'Any User',
    company: 'N/A',
    preconditions: 'Browser on login.html with text entered in password field.',
    testData: 'Password: SecretPassword123!',
    steps: '1. Enter "SecretPassword123!" in Password field. 2. Verify input type is "password" (bullets/dots displayed). 3. Click the eye icon button inside password field. 4. Observe input type changes to "text" (revealed). 5. Click eye icon again.',
    expected: 'Clicking eye icon unmasks password to plain text; second click restores password masking bullets.',
    crossModule: 'None',
    passFail: 'PASS if password toggles smoothly between masked and unmasked. FAIL if input remains static.',
    evidence: 'Screenshot of revealed password text.',
    dependencies: 'None',
    cleanup: 'Clear input field.',
    notes: 'Accessibility and UX inspection.'
  },
  {
    id: 'TC-AUTH-004',
    module: 'Authentication & Session',
    page: 'index.html',
    feature: 'Splash & Preloader',
    subfeature: 'Session State Auto-Router',
    title: 'Application Root Loader & Authenticated User Auto-Route',
    priority: 'P2',
    role: 'Authenticated User',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'User is authenticated (session token present in localStorage).',
    testData: 'URL: http://localhost:5174/index.html',
    steps: '1. Navigate directly to http://localhost:5174/index.html. 2. Observe initial splash screen with Anjani Agri Care logo and spinner. 3. Watch browser URL bar.',
    expected: 'Splash loader checks session, detects active login, and seamlessly redirects to pages/dashboard.html within 1.5 seconds without requiring re-login.',
    crossModule: 'If user is logged out, index.html must redirect to login.html instead.',
    passFail: 'PASS if automatic routing completes without user interaction. FAIL if stuck on loading spinner.',
    evidence: 'Console network log showing redirect from index.html to dashboard.html.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'Verifies root application routing logic.'
  },

  // --- MODULE 2: DASHBOARD & TOPBAR ---
  {
    id: 'TC-DASH-001',
    module: 'Executive Overview',
    page: 'pages/dashboard.html',
    feature: 'KPI Summary Cards',
    subfeature: 'Real-Time Operational Aggregation',
    title: 'Executive KPI Metrics Aggregation & Stock Valuation',
    priority: 'P1',
    role: 'Company Owner / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on dashboard.html with baseline test dataset loaded.',
    testData: 'Active Company: Anjani Agri Care (ACC)',
    steps: '1. Open pages/dashboard.html. 2. Verify KPI cards: Finished Goods Stock Value, Low Stock Alert Items, Pending Orders, Today Sales. 3. Compare values against underlying tables.',
    expected: 'KPI values match database aggregations: Finished Goods valuation matches sum of finished inventory batches; Low Stock card displays exact count of materials below threshold.',
    crossModule: 'Verify count of low stock items matches inventory items flagged on pages/inventory.html.',
    passFail: 'PASS if numbers are non-zero, formatted with Indian currency (₹), and accurate. FAIL if NaN, undefined, or zero when records exist.',
    evidence: 'Screenshot of dashboard top KPI metric row.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'Validates executive high-level visibility.'
  },
  {
    id: 'TC-DASH-002',
    module: 'Executive Overview',
    page: 'pages/dashboard.html',
    feature: 'Company Switcher',
    subfeature: 'Multi-Company Switch & Topbar Pill',
    title: 'Topbar Company Switcher Dynamic Entity Switch',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST -> Company A - TEST',
    preconditions: 'User on dashboard.html as Super Admin.',
    testData: 'Switch target: Company A - TEST (CO-A, ID: 2)',
    steps: '1. Click topbar company pill "Anjani Agri Care ACC". 2. Verify dropdown opens showing "Switch Active Company" with Anjani Agri Care marked active. 3. Click "Company A - TEST". 4. Observe page reload and topbar pill.',
    expected: 'Page reloads; topbar company pill updates to "🏢 Company A - TEST CO-A". Dashboard metrics strictly re-filter to Company A records. No Anjani Agri Care manufacturing data shown.',
    crossModule: 'Navigate to pages/inventory.html and pages/orders.html: verify only Company A records are displayed.',
    passFail: 'PASS if topbar pill updates, localStorage erp_active_company_id=2, and tenant context isolates data. FAIL if dropdown stuck on loading or records leak across companies.',
    evidence: 'Screenshot of topbar pill showing Company A - TEST.',
    dependencies: 'TC-DASH-001',
    cleanup: 'Switch back to Anjani Agri Care - TEST (ID: 1).',
    notes: 'Verifies topbar dropdown fix and multi-tenant data boundary.'
  },
  {
    id: 'TC-DASH-003',
    module: 'Executive Overview',
    page: 'pages/dashboard.html',
    feature: 'Quick Action Buttons',
    subfeature: 'Direct Modal Triggers',
    title: 'Dashboard Operational Quick Actions (New Order, New Batch, Record GRN)',
    priority: 'P2',
    role: 'Production / Sales / Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'User on dashboard.html.',
    testData: 'Click buttons: "#btn-quick-order", "#btn-quick-batch", "#btn-quick-grn"',
    steps: '1. Click "New Order" quick action button. Verify modal opens or redirects to orders.html?action=new. 2. Close modal. 3. Click "New Production Batch". 4. Verify batch modal triggers. 5. Click "Record Receipt".',
    expected: 'Each quick action button immediately launches its corresponding operational form without page errors or broken script links.',
    crossModule: 'Inspect URL and target forms.',
    passFail: 'PASS if all 3 action shortcuts function properly. FAIL if any button is non-responsive.',
    evidence: 'Screenshot of order creation modal opened directly from dashboard.',
    dependencies: 'TC-DASH-001',
    cleanup: 'Close any open modals.',
    notes: 'Validates operational shortcut routing.'
  },
  {
    id: 'TC-DASH-004',
    module: 'Executive Overview',
    page: 'pages/dashboard.html',
    feature: 'Notification Center',
    subfeature: 'Live Operational Notifications Dropdown',
    title: 'System Notification Center Inspection & Mark-All-Read',
    priority: 'P2',
    role: 'Any Staff User',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'User on dashboard.html. Unread notifications exist.',
    testData: 'Click "#notif-center-btn", Click "#notif-mark-all-btn"',
    steps: '1. Locate bell icon in topbar right. Observe unread badge count (e.g. "3"). 2. Click bell button. 3. Verify dropdown displays notifications with timestamps and severity badges. 4. Click "Mark all as read". 5. Observe unread badge.',
    expected: 'Notification dropdown opens showing clean list of alerts. Clicking "Mark all as read" clears badge counter to 0 and marks items as read.',
    crossModule: 'Verify erp_system_notifications updated in localStorage.',
    passFail: 'PASS if notifications render cleanly and badge counter updates. FAIL if dropdown clips or errors.',
    evidence: 'Screenshot of notification center dropdown open.',
    dependencies: 'TC-DASH-001',
    cleanup: 'None',
    notes: 'Verifies topbar notification engine.'
  },

  // --- MODULE 3: PRODUCTS & PACKAGING MASTER ---
  {
    id: 'TC-PROD-001',
    module: 'Product Masters',
    page: 'pages/products.html',
    feature: 'Product Catalog',
    subfeature: 'Create Multi-SKU Finished Product',
    title: 'Create Multi-SKU Insecticide Formulation Master',
    priority: 'P1',
    role: 'Production Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in as Production Manager on pages/products.html.',
    testData: 'Name: Anjani Chlor-20 EC | Code: TEST-PROD-001 | Category: Insecticide | GST: 18% | SKU 1: 500ml Bottle (10/box, MRP ₹350, Price ₹280) | SKU 2: 1 Litre Bottle (10/box, MRP ₹650, Price ₹520)',
    steps: '1. Open pages/products.html. 2. Click "Add Product" button. 3. Enter Product Name "Anjani Chlor-20 EC". 4. Enter Product Code "TEST-PROD-001". 5. Select Category "Insecticide". 6. Set GST Rate to "18%". 7. Add SKU 1: Size "500ml", Container "Bottle", Box Cap "10", MRP "350", Price "280". 8. Click "+ Add Packaging SKU". 9. Add SKU 2: Size "1 Litre", Container "Bottle", Box Cap "10", MRP "650", Price "520". 10. Click "Save Product".',
    expected: 'Success toast "Product created successfully!" appears. Modal closes. Product appears in table with two distinct packaging pills ("500ml", "1 Litre"). SKU data saved to Supabase/localStorage.',
    crossModule: 'Open pages/orders.html -> Click New Order: verify both 500ml and 1L SKUs are selectable in order item dropdown.',
    passFail: 'PASS if product created with both SKUs intact and visible in sales. FAIL if SKU data is dropped or save fails.',
    evidence: 'Screenshot of products table displaying TEST-PROD-001 with packaging badges.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep product for subsequent formulation and sales tests.',
    notes: 'Validates multi-SKU packaging architecture.'
  },
  {
    id: 'TC-PROD-002',
    module: 'Product Masters',
    page: 'pages/products.html',
    feature: 'Validation Guard',
    subfeature: 'Code Uniqueness Enforcement',
    title: 'Duplicate Product Code Collision Rejection Guard',
    priority: 'P2',
    role: 'Production Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Product TEST-PROD-001 already exists in database.',
    testData: 'Code: TEST-PROD-001 | Name: Duplicate Chlorpyrifos',
    steps: '1. On pages/products.html, click "Add Product". 2. Enter Name "Duplicate Chlorpyrifos". 3. Enter existing code "TEST-PROD-001". 4. Fill required fields and click "Save Product".',
    expected: 'Validation error "Product code TEST-PROD-001 is already in use. Please enter a unique product code." displays. Record is blocked from saving. Table count remains unchanged.',
    crossModule: 'Check database products table: exactly one record exists with code TEST-PROD-001.',
    passFail: 'PASS if duplicate code is rejected. FAIL if duplicate row inserted or unhandled SQL exception.',
    evidence: 'Screenshot of modal showing duplicate code error toast.',
    dependencies: 'TC-PROD-001',
    cleanup: 'Close modal.',
    notes: 'Prevents SKU code collisions.'
  },
  {
    id: 'TC-PROD-003',
    module: 'Product Masters',
    page: 'pages/products.html',
    feature: 'Product Editing',
    subfeature: 'SKU Pricing & Description Update',
    title: 'Edit Existing Product SKU Pricing & Technical Description',
    priority: 'P2',
    role: 'Production Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Product TEST-PROD-001 exists.',
    testData: 'Updated Selling Price for 500ml SKU: ₹295.00 | Technical Spec: "High Efficacy Chlorpyrifos 20% EC with Stabilizer"',
    steps: '1. On pages/products.html, locate TEST-PROD-001. 2. Click the pencil (Edit) icon in row actions. 3. In edit modal, update Selling Price of 500ml SKU from 280 to 295. 4. Update Technical Spec field. 5. Click "Update Product".',
    expected: 'Toast "Product updated successfully!" displays. Table row immediately updates to reflect new technical description. Edit modal closes cleanly.',
    crossModule: 'Navigate to pages/orders.html: create new order item for TEST-PROD-001 500ml; verify auto-filled unit price is now ₹295.00.',
    passFail: 'PASS if price updates in master and cascades to new order line items. FAIL if changes fail to persist on reload.',
    evidence: 'Screenshot of edited product details modal.',
    dependencies: 'TC-PROD-001',
    cleanup: 'Reset price to ₹280.00 if required.',
    notes: 'Verifies price cascade from product master to sales.'
  },
  {
    id: 'TC-PROD-004',
    module: 'Product Masters',
    page: 'pages/products.html',
    feature: 'Data Integrity Guard',
    subfeature: 'Safe Cascade Delete Prevention',
    title: 'Prevent Deletion of Product with Active Stock Batches or Sales Orders',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'TEST-PROD-001 has active finished goods batches in WH-002 or historical sales orders.',
    testData: 'Target Product: TEST-PROD-001',
    steps: '1. Locate TEST-PROD-001 on pages/products.html. 2. Click trash (Delete) icon in row actions. 3. In confirmation dialog, click "Confirm Delete".',
    expected: 'Security rule alert displays: "Cannot delete product TEST-PROD-001 because active inventory batches or sales order history reference it. Archive product instead." Product is preserved in database.',
    crossModule: 'Verify product row remains in table; inventory batches on pages/inventory.html remain intact.',
    passFail: 'PASS if deletion blocked and safety alert displayed. FAIL if product deleted, leaving orphaned stock batches.',
    evidence: 'Screenshot of security rule blocking toast.',
    dependencies: 'TC-PROD-001',
    cleanup: 'None',
    notes: 'Preserves relational referential integrity.'
  },
  {
    id: 'TC-PROD-005',
    module: 'Product Masters',
    page: 'pages/products.html',
    feature: 'Search & Filtering',
    subfeature: 'Live Filter by Category & Keyword',
    title: 'Product Catalog Real-Time Filtering & Category Segmentation',
    priority: 'P3',
    role: 'Any User',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple products exist across Insecticide, Fungicide, and Herbicide categories.',
    testData: 'Filter Category: "Fungicide" | Search Query: "Tebuconazole"',
    steps: '1. Open pages/products.html. 2. Select "Fungicide" from category dropdown. Verify table displays only fungicide products. 3. Type "Tebuconazole" into search input. 4. Clear search input and select "All Categories".',
    expected: 'Table updates dynamically in real-time without page reload. Category filtering and search input narrow rows accurately; clearing filters restores full product list.',
    crossModule: 'None',
    passFail: 'PASS if table filters instantly without console errors. FAIL if filtering returns blank table when records match.',
    evidence: 'Screenshot of filtered table showing only Fungicide rows.',
    dependencies: 'TC-PROD-001',
    cleanup: 'Reset filters to All.',
    notes: 'Tests frontend table enhancer filtering.'
  },

  // --- MODULE 4: INVENTORY & STOCK BATCHES ---
  {
    id: 'TC-INV-001',
    module: 'Inventory & Materials',
    page: 'pages/inventory.html',
    feature: 'Stock Master & Batches',
    subfeature: 'Batch Breakdown Inspection & Status Dot',
    title: 'Batch Breakdown Modal Inspection & CSS Status Dot Rendering',
    priority: 'P1',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Raw material TEST-RAW-001 (Chlorpyrifos Tech 98%) exists with opening batch BAT-RAW-CHLOR-01 (2,500 KG).',
    testData: 'Item: TEST-RAW-001',
    steps: '1. Open pages/inventory.html. 2. Locate Chlorpyrifos Tech in table. 3. Inspect Status column: verify green status pill with pulsing status dot ("In Stock"). 4. Click "View Batches" button in row actions. 5. In Batches modal, verify Batch No "BAT-RAW-CHLOR-01", Available Qty "2500 KG", Warehouse "Main Plant RM Store".',
    expected: 'Status column renders full pill with status dot without CSS text truncation. Batches modal displays complete batch metadata (supplier, receipt date, expiry, current quantity).',
    crossModule: 'Cross-reference total stock in table (2,500 KG) with sum of quantities in batch breakdown modal (2,500 KG).',
    passFail: 'PASS if status pill displays properly and batch modal breaks down quantity accurately. FAIL if status dot clipped or batches fail to load.',
    evidence: 'Screenshot of Batch Breakdown modal open over inventory table.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Close modal.',
    notes: 'Verifies CSS status dot fix and multi-batch breakdown.'
  },
  {
    id: 'TC-INV-002',
    module: 'Inventory & Materials',
    page: 'pages/inventory.html',
    feature: 'Reorder Alerts',
    subfeature: 'Low Stock Deficit Threshold Notification',
    title: 'Low Stock Deficit Alert Trigger on Minimum Level Breach',
    priority: 'P2',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Item TEST-RAW-002 (Solvent C-IX) has reorder threshold 2,500 LTR and current stock 500 LTR.',
    testData: 'Item: TEST-RAW-002 | Current: 500 LTR | Reorder Threshold: 2,500 LTR | Deficit: 2,000 LTR',
    steps: '1. On pages/inventory.html, click the "Low Stock Items" filter toggle. 2. Locate Solvent C-IX in filtered table. 3. Inspect status badge.',
    expected: 'Item is prominently flagged with an amber/red "Low Stock" warning badge. Deficit amount (2,000 LTR below minimum) is highlighted. Dashboard low stock counter reflects this item.',
    crossModule: 'Check pages/dashboard.html: "Low Stock Alert Items" KPI increments by 1.',
    passFail: 'PASS if low stock warning is triggered accurately. FAIL if item is incorrectly marked "In Stock".',
    evidence: 'Screenshot of Low Stock filter view showing Solvent C-IX.',
    dependencies: 'TC-INV-001',
    cleanup: 'Reset filter to All Items.',
    notes: 'Protects manufacturing continuity by flagging procurement deficits.'
  },
  {
    id: 'TC-INV-003',
    module: 'Inventory & Materials',
    page: 'pages/inventory.html',
    feature: 'Inventory Segmentation',
    subfeature: 'Category Tabs Filter',
    title: 'Category Tab Switching (Technical, Solvents, Packaging, Deficit)',
    priority: 'P3',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Inventory contains items across Technical Chemicals, Solvents, and Packaging materials.',
    testData: 'Tabs: [Technical Grade], [Packaging Materials], [All Materials]',
    steps: '1. Click "Technical Grade" tab. Verify only active ingredients (Chlorpyrifos, Thiamethoxam) appear. 2. Click "Packaging Materials" tab. Verify bottles, caps, and cartons appear. 3. Click "All Materials" tab.',
    expected: 'Table filters instantaneously between material classifications without network lag. Record count badge updates on each tab.',
    crossModule: 'None',
    passFail: 'PASS if tabs correctly isolate chemical and packaging materials. FAIL if wrong categories leak.',
    evidence: 'Screenshot of Packaging Materials tab view.',
    dependencies: 'TC-INV-001',
    cleanup: 'Return to All Materials.',
    notes: 'Essential for godown operators managing separate physical chemical vs bottle warehouses.'
  },
  {
    id: 'TC-INV-004',
    module: 'Inventory & Materials',
    page: 'pages/inventory.html',
    feature: 'Stock Reconciliation',
    subfeature: 'Physical Audit Stock Adjustment',
    title: 'Manual Physical Audit Stock Adjustment & Reason Logging',
    priority: 'P2',
    role: 'Warehouse & Store Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Item TEST-RAW-003 (Emulsifier Blend Poly-70) has current stock 1,200 LTR.',
    testData: 'Physical Count: 1,180 LTR | Variance: -20 LTR | Reason: "Drum puncture leakage during handling"',
    steps: '1. Locate Emulsifier Blend on pages/inventory.html. 2. Click "Stock Adjustment" button in row actions. 3. Select Batch "BAT-RAW-EMUL-01". 4. Enter New Count "1180". 5. Enter Adjustment Reason "Drum puncture leakage during handling". 6. Click "Apply Adjustment".',
    expected: 'Toast "Stock adjusted successfully!" displays. Item total stock updates from 1,200 to 1,180 LTR. An immutable audit record is created in pages/audit-logs.html documenting the 20 LTR loss with the entered reason.',
    crossModule: 'Inspect pages/audit-logs.html: verify "STOCK_ADJUSTMENT" event logged by store@anjani.test.',
    passFail: 'PASS if stock decrements to 1,180 LTR and audit log is written. FAIL if balance does not change or reason is omitted.',
    evidence: 'Screenshot of updated inventory row and corresponding audit log entry.',
    dependencies: 'TC-INV-001',
    cleanup: 'None (variance retained for reconciliation testing).',
    notes: 'Auditable physical stock adjustment.'
  },
  {
    id: 'TC-INV-005',
    module: 'Inventory & Materials',
    page: 'pages/inventory.html',
    feature: 'Integrity Guard',
    subfeature: 'Anti-Negative Stock Enforcement',
    title: 'Negative Inventory Prevention Guard on Stock Movements',
    priority: 'P1',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Batch BAT-RAW-EMUL-01 has remaining quantity 1,180 LTR.',
    testData: 'Attempted Outward Adjustment: 1,500 LTR',
    steps: '1. On Stock Adjustment modal for BAT-RAW-EMUL-01, attempt to set new balance to "-100" or record deduction of 1,500 LTR. 2. Click "Apply Adjustment".',
    expected: 'System rejects transaction: "Validation Error: Stock adjustment cannot result in negative inventory balance (Maximum available: 1180 LTR)." Batch balance remains 1,180 LTR.',
    crossModule: 'Check database stock_batches: current_qty is >= 0.',
    passFail: 'PASS if negative stock is strictly blocked. FAIL if negative balance allowed.',
    evidence: 'Screenshot of validation error toast.',
    dependencies: 'TC-INV-004',
    cleanup: 'Close modal.',
    notes: 'Guarantees zero negative stock batches.'
  },

  // --- MODULE 5: CLIENTS / CUSTOMERS MASTER ---
  {
    id: 'TC-CUST-001',
    module: 'Customer Directory',
    page: 'pages/clients.html',
    feature: 'Customer Onboarding',
    subfeature: 'Register Agrochemical Distributor',
    title: 'Register Commercial Agrochemical Distributor with Credit Terms',
    priority: 'P1',
    role: 'Sales & Dispatch Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on pages/clients.html.',
    testData: 'Firm Name: Kisan Agro Agency | Code: TEST-CUST-001 | Contact: Ramesh Patel | Phone: 9825277889 | GSTIN: 24AAAFK1122D1Z5 | State: Gujarat (24) | City: Rajkot | Credit Limit: 500000 | Terms: 30 Days',
    steps: '1. Open pages/clients.html. 2. Click "Add Client" button. 3. Enter Firm Name "Kisan Agro Agency". 4. Enter Code "TEST-CUST-001". 5. Enter Contact Person "Ramesh Patel". 6. Enter Phone "9825277889" and Email "ramesh@kisanagro.test". 7. Enter GSTIN "24AAAFK1122D1Z5". 8. Set State to "Gujarat" (Code 24). 9. Enter Credit Limit "500000". 10. Set Payment Terms to "30 Days". 11. Click "Save Client".',
    expected: 'Toast "Client saved successfully!" displays. Modal closes. Kisan Agro Agency appears in customer directory with active status badge, ₹5,00,000 credit limit, and ₹0.00 outstanding balance.',
    crossModule: 'Open pages/orders.html -> Click New Order: verify "Kisan Agro Agency" is selectable in customer dropdown.',
    passFail: 'PASS if client created with credit terms intact and available in orders. FAIL if save fails or phone/GSTIN validation errors inappropriately.',
    evidence: 'Screenshot of clients table showing Kisan Agro Agency row.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep customer for sales order tests.',
    notes: 'Foundational customer commercial onboarding.'
  },
  {
    id: 'TC-CUST-002',
    module: 'Customer Directory',
    page: 'pages/clients.html',
    feature: 'Validation Guard',
    subfeature: 'Statutory GSTIN Format Validation',
    title: 'Invalid GSTIN Format & State Code Mismatch Validation Guard',
    priority: 'P2',
    role: 'Sales & Dispatch Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On Add Client modal.',
    testData: 'Invalid GSTIN: "INVALID_GST_123" | State: Gujarat (24)',
    steps: '1. Click "Add Client". 2. Fill required name and phone. 3. Enter malformed GSTIN "INVALID_GST_123". 4. Click "Save Client".',
    expected: 'Validation error "Invalid GSTIN format. Must be a 15-character alphanumeric GSTIN (e.g. 24AAAFK1122D1Z5)." displays. Form submission is halted.',
    crossModule: 'None',
    passFail: 'PASS if invalid GSTIN is rejected. FAIL if malformed GSTIN is saved to database.',
    evidence: 'Screenshot of inline field validation error.',
    dependencies: 'TC-CUST-001',
    cleanup: 'Close modal.',
    notes: 'Protects tax compliance and GSTR reporting.'
  },
  {
    id: 'TC-CUST-003',
    module: 'Customer Directory',
    page: 'pages/clients.html',
    feature: 'Credit Governance',
    subfeature: 'Outstanding Balance & Credit Utilization',
    title: 'Customer Ledger Balance & Credit Limit Utilization Badge',
    priority: 'P2',
    role: 'Sales Executive / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Kisan Agro Agency has credit limit ₹5,00,000 and an unpaid invoice of ₹1,65,200.',
    testData: 'Client: TEST-CUST-001 | Credit Limit: ₹5,00,000 | Current Outstanding: ₹1,65,200 | Utilization: 33.04%',
    steps: '1. Locate Kisan Agro Agency on pages/clients.html. 2. Inspect "Outstanding Balance" and "Credit Limit" columns. 3. Click "View Ledger" button in row actions.',
    expected: 'Table displays Outstanding Balance ₹1,65,200 with credit utilization indicator (33%). Ledger modal lists linked invoices and payments with running net balance.',
    crossModule: 'Compare balance against customer sales report on pages/reports.html.',
    passFail: 'PASS if outstanding balance matches posted invoices minus payments. FAIL if balance shows ₹0 when unpaid orders exist.',
    evidence: 'Screenshot of Customer Ledger modal.',
    dependencies: 'TC-CUST-001',
    cleanup: 'Close modal.',
    notes: 'Commercial credit risk governance.'
  },
  {
    id: 'TC-CUST-004',
    module: 'Customer Directory',
    page: 'pages/clients.html',
    feature: 'Search & Status',
    subfeature: 'Filter by State & Account Status',
    title: 'Customer Directory Search by City & Account Deactivation',
    priority: 'P3',
    role: 'Sales & Dispatch Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple customers registered across Rajkot, Junagadh, and Morbi.',
    testData: 'Search Query: "Rajkot" | Target Customer: TEST-CUST-003',
    steps: '1. Enter "Rajkot" in customer search input. Verify table filters to Rajkot customers only. 2. Clear search. 3. Click status toggle for TEST-CUST-003 to change from "Active" to "Inactive". 4. Confirm prompt.',
    expected: 'Search filters instantly. Deactivating customer sets status pill to "Inactive" (Amber/Grey); customer is flagged as unavailable for new sales orders.',
    crossModule: 'Verify deactivated customer does not appear in active customer dropdown on pages/orders.html.',
    passFail: 'PASS if inactive customer blocked from new orders. FAIL if inactive customer still selectable.',
    evidence: 'Screenshot of customer with Inactive status pill.',
    dependencies: 'TC-CUST-001',
    cleanup: 'Reactivate customer TEST-CUST-003.',
    notes: 'Controls credit suspension on defaulting dealers.'
  },

  // --- MODULE 6: SUPPLIERS MASTER ---
  {
    id: 'TC-SUP-001',
    module: 'Vendor Management',
    page: 'pages/suppliers.html',
    feature: 'Vendor Onboarding',
    subfeature: 'Register Technical Material Vendor',
    title: 'Onboard Technical Chemical Supplier with Banking Coordinates',
    priority: 'P1',
    role: 'Warehouse & Store Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on pages/suppliers.html.',
    testData: 'Name: Gujarat Chemicals & Synthetics Ltd | Code: TEST-SUP-001 | Contact: Arvindbhai Mehta | Phone: 9825011223 | GSTIN: 24AAACG1122A1Z8 | Bank: State Bank of India | Account: 30112233445 | IFSC: SBIN0001234',
    steps: '1. Open pages/suppliers.html. 2. Click "Add Supplier" button. 3. Fill Supplier Name, Code, Contact Person, Phone, Email, and GSTIN. 4. Enter Bank Details: Bank Name "State Bank of India", Account No "30112233445", IFSC "SBIN0001234". 5. Click "Save Supplier".',
    expected: 'Toast "Supplier saved successfully!" appears. Modal closes. Gujarat Chemicals appears in directory with active status and banking details.',
    crossModule: 'Open pages/purchases.html -> Click New Purchase: verify "Gujarat Chemicals & Synthetics Ltd" is selectable in supplier dropdown.',
    passFail: 'PASS if supplier registered and available in purchase orders. FAIL if banking fields dropped or save fails.',
    evidence: 'Screenshot of suppliers table showing Gujarat Chemicals row.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep supplier for purchase GRN tests.',
    notes: 'Foundational supply chain vendor onboarding.'
  },
  {
    id: 'TC-SUP-002',
    module: 'Vendor Management',
    page: 'pages/suppliers.html',
    feature: 'Purchase Tracking',
    subfeature: 'Vendor Inward History Inspection',
    title: 'Supplier Purchase History & Commercial Payables Inspection',
    priority: 'P2',
    role: 'Warehouse Manager / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Supplier TEST-SUP-001 has linked purchase records.',
    testData: 'Supplier: TEST-SUP-001',
    steps: '1. On pages/suppliers.html, locate Gujarat Chemicals. 2. Click "View Inward History" in row actions. 3. Inspect list of historical GRN receipts, dates, material quantities, and invoice values.',
    expected: 'Modal displays chronological ledger of all material receipts from this vendor with total cumulative purchases and outstanding payables.',
    crossModule: 'Cross-reference with purchases listed on pages/purchases.html.',
    passFail: 'PASS if inward history matches purchases table. FAIL if modal empty when purchases exist.',
    evidence: 'Screenshot of Supplier Inward History modal.',
    dependencies: 'TC-SUP-001',
    cleanup: 'Close modal.',
    notes: 'Verifies supplier historical procurement audit.'
  },
  {
    id: 'TC-SUP-003',
    module: 'Vendor Management',
    page: 'pages/suppliers.html',
    feature: 'Supplier Lifecycle',
    subfeature: 'Vendor Archival & Reactivation',
    title: 'Supplier Archival & Purchase Blocking Verification',
    priority: 'P3',
    role: 'Store Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Supplier TEST-SUP-002 exists.',
    testData: 'Supplier: TEST-SUP-002 (Apex Polymer Containers Ltd)',
    steps: '1. Locate Apex Polymer on pages/suppliers.html. 2. Click Archive icon in row actions. 3. Confirm prompt. 4. Verify status badge changes to "Archived". 5. Navigate to pages/purchases.html and click "New Purchase".',
    expected: 'Supplier status updates to Archived. On pages/purchases.html, archived supplier is excluded from active vendor dropdown, preventing accidental purchase orders.',
    crossModule: 'pages/purchases.html supplier dropdown check.',
    passFail: 'PASS if archived vendor excluded from procurement. FAIL if archived vendor still selectable for new orders.',
    evidence: 'Screenshot of purchase modal dropdown showing archived vendor excluded.',
    dependencies: 'TC-SUP-001',
    cleanup: 'Reactivate supplier TEST-SUP-002.',
    notes: 'Controls procurement from blacklisted or suspended vendors.'
  },

  // --- MODULE 7: PURCHASES & GRN INWARD ---
  {
    id: 'TC-PURCH-001',
    module: 'Procurement & Inward',
    page: 'pages/purchases.html',
    feature: 'Goods Receipt Note (GRN)',
    subfeature: 'Raw Chemical Inward & Batch Creation',
    title: 'Record Raw Chemical Purchase Inward (GRN) & Stock Batch Inward',
    priority: 'P1',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Supplier TEST-SUP-001 and Raw Material TEST-RAW-001 exist.',
    testData: 'Supplier: Gujarat Chemicals | Target WH: Main Plant RM Store (WH-001) | Inward Date: 2026-10-16 | Bill No: INV-GC-8841 | Item: Chlorpyrifos Tech 98% | Batch: BAT-RAW-CHLOR-02 | Qty: 1000 KG | Unit Cost: ₹650 | GST: 18%',
    steps: '1. Open pages/purchases.html. 2. Click "New Purchase / GRN". 3. Select Supplier "Gujarat Chemicals & Synthetics Ltd". 4. Select Target Warehouse "Main Plant RM Store". 5. Enter Inward Date "2026-10-16". 6. Enter Supplier Invoice "INV-GC-8841". 7. Add Line: Select Item "Chlorpyrifos Tech 98%", enter Batch No "BAT-RAW-CHLOR-02", Qty "1000", Unit Cost "650", GST "18%". 8. Verify Line Total: 1000 x 650 = ₹6,50,000 + 18% GST (₹1,17,000) = ₹7,67,000. 9. Click "Save & Record Inward".',
    expected: 'Success toast displays. GRN record created with status "Received". Stock Inward Engine automatically creates batch BAT-RAW-CHLOR-02 with 1,000 KG in WH-001. Raw material stock increments by exactly 1,000 KG.',
    crossModule: 'Navigate to pages/inventory.html: verify Chlorpyrifos Tech total stock increased by 1,000 KG and BAT-RAW-CHLOR-02 is listed in batch breakdown modal.',
    passFail: 'PASS if GRN created and inventory increments exactly once without duplicates. FAIL if stock fails to increment or duplicates on refresh.',
    evidence: 'Screenshot of purchase table showing new GRN and inventory batch modal showing 1,000 KG.',
    dependencies: 'TC-SUP-001, TC-INV-001',
    cleanup: 'Keep stock for production batch tests.',
    notes: 'Validates authoritative procurement inward engine.'
  },
  {
    id: 'TC-PURCH-002',
    module: 'Procurement & Inward',
    page: 'pages/purchases.html',
    feature: 'Goods Receipt Note (GRN)',
    subfeature: 'Packaging Material Inward',
    title: 'Packaging Material Inward Receipt (Bottles, Caps, Cartons)',
    priority: 'P1',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Supplier TEST-SUP-002 and Packaging Items exist.',
    testData: 'Supplier: Apex Polymer | Target WH: Main Plant Packaging Store (WH-003) | Bill No: INV-AP-3321 | Items: 500ml Bottles (5,000 Units @ ₹12.50) + 28mm Caps (5,000 Units @ ₹2.20)',
    steps: '1. On pages/purchases.html, click "New Purchase". 2. Select Supplier "Apex Polymer Containers Ltd". 3. Select Target Warehouse "Main Plant Packaging Store". 4. Add Line 1: 500ml Bottle, Batch "LOT-BTL-02", Qty 5000, Cost 12.50. 5. Add Line 2: 28mm Cap, Batch "LOT-CAP-02", Qty 5000, Cost 2.20. 6. Click "Save & Record Inward".',
    expected: 'GRN saved. Inventory for 500ml bottles and 28mm caps in WH-003 increments by 5,000 units each.',
    crossModule: 'Check pages/inventory.html (Packaging tab): bottle and cap stock balances reflect addition.',
    passFail: 'PASS if packaging items correctly incremented in Packaging Store. FAIL if quantities allocated to wrong warehouse.',
    evidence: 'Screenshot of packaging inventory balances after receipt.',
    dependencies: 'TC-SUP-001, TC-INV-001',
    cleanup: 'Keep materials for finished goods packaging tests.',
    notes: 'Verifies non-chemical packaging procurement.'
  },
  {
    id: 'TC-PURCH-003',
    module: 'Procurement & Inward',
    page: 'pages/purchases.html',
    feature: 'Reversal & Cancellation',
    subfeature: 'Unverified GRN Cancellation',
    title: 'Cancel Unverified Purchase & Reversal of Stock Addition',
    priority: 'P2',
    role: 'Store Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'A test GRN was created with 100 KG material that has not yet been consumed in production.',
    testData: 'Target GRN to cancel: Test Purchase of 100 KG Solvent',
    steps: '1. On pages/purchases.html, locate test purchase record. 2. Click "Cancel Inward" button in row actions. 3. Enter cancellation reason "Invoice received in error by supplier". 4. Click "Confirm Cancellation".',
    expected: 'Purchase status changes to "Cancelled". Stock addition is cleanly reversed; 100 KG is deducted from warehouse batch. No negative stock created.',
    crossModule: 'Check pages/inventory.html: stock balance returns to pre-purchase level. Check pages/audit-logs.html for GRN_CANCELLED audit entry.',
    passFail: 'PASS if purchase cancelled and stock reversed cleanly without residue. FAIL if stock remains added after cancellation.',
    evidence: 'Screenshot of cancelled purchase row with grey Cancelled badge.',
    dependencies: 'TC-PURCH-001',
    cleanup: 'None',
    notes: 'Prevents phantom stock when goods receipts are voided.'
  },
  {
    id: 'TC-PURCH-004',
    module: 'Procurement & Inward',
    page: 'pages/purchases.html',
    feature: 'Search & Filtering',
    subfeature: 'Filter by Target Warehouse & Date Range',
    title: 'Purchase Filter by Receiving Warehouse & Financial Period',
    priority: 'P3',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple purchases recorded across Raw Material Store and Packaging Store.',
    testData: 'Warehouse Filter: "Main Plant Packaging Store (WH-003)"',
    steps: '1. Open pages/purchases.html. 2. Select "Main Plant Packaging Store" from warehouse filter dropdown. 3. Inspect filtered rows. 4. Reset to "All Warehouses".',
    expected: 'Table filters strictly to purchases delivered to Packaging Store. Total purchase amount summary card recalculates for filtered rows.',
    crossModule: 'None',
    passFail: 'PASS if table filters accurately and summary cards match. FAIL if raw chemical purchases appear under packaging warehouse.',
    evidence: 'Screenshot of filtered purchases table.',
    dependencies: 'TC-PURCH-001',
    cleanup: 'Reset filter to All.',
    notes: 'Operational segregation of chemical vs packaging invoices.'
  },

  // --- MODULE 8: FORMULATIONS & RECIPE BOM ---
  {
    id: 'TC-FORM-001',
    module: 'Formulations & BOM',
    page: 'pages/formulations.html',
    feature: 'Recipe Definition',
    subfeature: 'Standard 1,000L Formulation BOM',
    title: 'Define Standard 1,000L Pesticide Formulation Recipe BOM',
    priority: 'P1',
    role: 'Production & Plant Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Product TEST-PROD-001 and Raw Materials TEST-RAW-001, 002, 003 exist.',
    testData: 'Formulation Code: FORM-CHLOR-20EC | Product: TEST-PROD-001 | Standard Batch: 1,000 Litres | Ingredients: Chlorpyrifos Tech 98% (204.08 KG), Emulsifier Poly-70 (80.00 LTR), Solvent C-IX (715.92 LTR) | Density: 1.075 g/ml',
    steps: '1. Open pages/formulations.html. 2. Click "New Formulation" button. 3. Enter Formulation Code "FORM-CHLOR-20EC". 4. Select Target Product "Anjani Chlor-20 EC (TEST-PROD-001)". 5. Enter Standard Batch Size "1000" Litres. 6. Enter Target Density "1.075". 7. In BOM Table: Add Line 1: Select "Chlorpyrifos Tech 98%", enter Qty "204.08", Unit "KG". 8. Add Line 2: Select "Emulsifier Blend Poly-70", enter Qty "80.00", Unit "LTR". 9. Add Line 3: Select "Solvent C-IX", enter Qty "715.92", Unit "LTR". 10. Click "Save Formulation".',
    expected: 'Toast "Formulation saved successfully!" appears. Formulation displays in catalog with 3 ingredients, 1,000L batch size, and initial status "Under Development" or "Pending Approval".',
    crossModule: 'Open pages/batch-calculator.html: verify "FORM-CHLOR-20EC" appears in formulation selector.',
    passFail: 'PASS if formulation saved with exact ingredient ratios and density. FAIL if ingredient quantities rounded incorrectly or save errors.',
    evidence: 'Screenshot of formulation details modal showing 3-ingredient BOM table.',
    dependencies: 'TC-PROD-001, TC-INV-001',
    cleanup: 'Keep formulation for manufacturing batch tests.',
    notes: 'Defines master chemical recipe BOM.'
  },
  {
    id: 'TC-FORM-002',
    module: 'Formulations & BOM',
    page: 'pages/formulations.html',
    feature: 'Validation Guard',
    subfeature: 'Recipe Composition Ratio Validation',
    title: 'Formulation BOM Ingredients & Volume Reconciliation Guard',
    priority: 'P2',
    role: 'Production & Plant Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On New Formulation modal.',
    testData: 'Batch Size: 1,000 Litres | Solvents & Emulsifiers sum: 500 Litres (Incomplete recipe)',
    steps: '1. Enter Batch Size "1000" Litres. 2. Enter Active Ingredient 204.08 KG. 3. Enter Solvent 300 LTR (leaving 500L deficit). 4. Click "Save Formulation".',
    expected: 'Validation warning flags volume mismatch: "Total liquid ingredients do not match specified 1,000 Litre batch volume. Please verify formulation recipe balance." Allows review before commitment.',
    crossModule: 'None',
    passFail: 'PASS if volume mismatch is highlighted. FAIL if invalid recipe committed without warning.',
    evidence: 'Screenshot of BOM validation warning prompt.',
    dependencies: 'TC-FORM-001',
    cleanup: 'Close modal.',
    notes: 'Prevents batch dilution errors.'
  },
  {
    id: 'TC-FORM-003',
    module: 'Formulations & BOM',
    page: 'pages/formulations.html',
    feature: 'Approval Lifecycle',
    subfeature: 'Commercial Production Authorization',
    title: 'Approve Formulation for Commercial Manufacturing Operations',
    priority: 'P1',
    role: 'Production Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Formulation FORM-CHLOR-20EC exists in Draft/Pending status.',
    testData: 'Formulation: FORM-CHLOR-20EC',
    steps: '1. Locate FORM-CHLOR-20EC on pages/formulations.html. 2. Click "Approve Formulation" button in row actions. 3. Enter approval note: "Laboratory trials and active ingredient stability verified." 4. Click "Confirm Approval".',
    expected: 'Status badge updates to "Approved" (Green). Formulation is now authorized for production runs on pages/production.html.',
    crossModule: 'Open pages/production.html -> Click New Batch: verify FORM-CHLOR-20EC is now selectable in approved formulation dropdown.',
    passFail: 'PASS if formulation approved and unlocked for production scheduling. FAIL if unapproved formulation can be launched.',
    evidence: 'Screenshot of formulation with Approved status pill.',
    dependencies: 'TC-FORM-001',
    cleanup: 'None',
    notes: 'Ensures only validated, lab-tested recipes are launched in factory.'
  },
  {
    id: 'TC-FORM-004',
    module: 'Formulations & BOM',
    page: 'pages/formulations.html',
    feature: 'Search & Export',
    subfeature: 'BOM Specification Export',
    title: 'Formulation BOM Specification Card Print & Export View',
    priority: 'P3',
    role: 'Production Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Formulation FORM-CHLOR-20EC exists.',
    testData: 'Formulation: FORM-CHLOR-20EC',
    steps: '1. Locate FORM-CHLOR-20EC. 2. Click "Print BOM / Specification Sheet" button. 3. Inspect generated preview layout.',
    expected: 'Print-ready specification card opens showing batch size, density, safety warnings, and step-by-step chemical addition sequence.',
    crossModule: 'None',
    passFail: 'PASS if print view renders cleanly with company header Anjani Agri Care. FAIL if layout breaks or ingredients omitted.',
    evidence: 'Screenshot of formulation print specification view.',
    dependencies: 'TC-FORM-001',
    cleanup: 'Close print window.',
    notes: 'Shop-floor manufacturing instruction sheet.'
  },

  // --- MODULE 9: MANUFACTURING & QUALITY CONTROL ---
  {
    id: 'TC-MFG-001',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Batch Launch',
    subfeature: 'Raw Material Consumption & Quarantine Batch',
    title: 'Launch 1,000L Production Batch with Live Stock Check & Deduction',
    priority: 'P1',
    role: 'Production & Plant Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Approved formulation FORM-CHLOR-20EC exists. Sufficient raw materials in WH-001.',
    testData: 'Batch No: BAT-2026-CHLOR-002 | Formulation: FORM-CHLOR-20EC | Batch Size: 1,000 Litres | Shift: Day Shift A | Supervisor: Dr. Haresh Joshi | Mfg Date: 2026-10-16 | Exp Date: 2028-10-15',
    steps: '1. Open pages/production.html. 2. Click "New Production Batch". 3. Enter Batch No "BAT-2026-CHLOR-002". 4. Select Formulation "Chlorpyrifos 20% EC (FORM-CHLOR-20EC)". 5. Target Quantity defaults to "1000" Litres. 6. Observe BOM preview: Chlorpyrifos Tech (204.08 KG), Emulsifier (80 LTR), Solvent (715.92 LTR). 7. Select Shift "Shift A". 8. Click "Launch Batch & Consume Materials".',
    expected: 'Success toast "Production batch launched! Raw materials deducted." displays. Batch BAT-2026-CHLOR-002 created with status "In-Process" / "Quarantine". Stock Inward Engine automatically deducts 204.08 KG Chlorpyrifos, 80L Emulsifier, and 715.92L Solvent from WH-001 stock batches.',
    crossModule: 'Navigate to pages/inventory.html: verify stock balances for all 3 raw materials decremented by exact BOM amounts. Check pages/audit-logs.html for BATCH_LAUNCHED event.',
    passFail: 'PASS if batch created and exact raw materials deducted. FAIL if stock not deducted or batch fails to launch.',
    evidence: 'Screenshot of production table showing new batch and inventory table showing decremented chemical balances.',
    dependencies: 'TC-FORM-003, TC-PURCH-001',
    cleanup: 'Keep batch for QC approval test.',
    notes: 'Core chemical manufacturing consumption engine.'
  },
  {
    id: 'TC-MFG-002',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Stock Guard',
    subfeature: 'Deficient Raw Material Prevention',
    title: 'Insufficient Raw Material Stock Launch Blocking Guard',
    priority: 'P1',
    role: 'Production & Plant Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Raw material stock is insufficient for a 50,000 Litre batch.',
    testData: 'Attempted Batch Size: 50,000 Litres (Requires 10,204 KG Chlorpyrifos Tech; only 2,500 KG in stock)',
    steps: '1. On New Production Batch modal, enter Batch Size "50000" Litres. 2. Click "Launch Batch & Consume Materials".',
    expected: 'Launch blocked: "Insufficient Stock Error: Chlorpyrifos Tech 98% has 2,500 KG available, but 10,204 KG is required for this batch size. Please procure materials before launching." No raw materials deducted; no phantom batch created.',
    crossModule: 'Check pages/inventory.html: raw material stocks unchanged.',
    passFail: 'PASS if launch is blocked and deficit clearly itemized. FAIL if batch launched with negative stock.',
    evidence: 'Screenshot of insufficient stock blocking alert.',
    dependencies: 'TC-MFG-001',
    cleanup: 'Close modal.',
    notes: 'Prevents launching un-resourced production.'
  },
  {
    id: 'TC-MFG-003',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Quality Control',
    subfeature: 'Batch Inspection & Quarantine Approval',
    title: 'QC Inspection, Chemical Assay Analysis & Quarantine Approval',
    priority: 'P1',
    role: 'QC Officer',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Batch BAT-2026-CHLOR-002 exists in "Quarantine" status.',
    testData: 'Specific Gravity: 1.076 g/ml (Spec: 1.075 +/- 0.005) | Active Ingredient Assay: 20.15% (Spec: 20.0% +/- 0.5%) | Acidity: 0.08% | Appearance: Clear Pale Amber Liquid | QC Decision: APPROVED',
    steps: '1. Log in as QC Officer (qc@anjani.test). 2. On pages/production.html, locate batch BAT-2026-CHLOR-002. 3. Click "QC Inspection" button in row actions. 4. In QC Inspection modal, enter: Specific Gravity "1.076", Active Ingredient Assay "20.15", Acidity "0.08", Appearance "Clear Pale Amber Liquid". 5. Select Decision "QC Approved". 6. Enter Officer Remarks: "Conforms to IS 8944 specifications. Approved for packaging." 7. Click "Submit QC Decision".',
    expected: 'Toast "QC Approval recorded! Batch released for packaging." displays. Batch status updates to "QC Approved" (Green badge). Batch is now unlocked for packaging into finished goods containers.',
    crossModule: 'Check pages/audit-logs.html: QC_BATCH_APPROVED event logged by qc@anjani.test with entered test parameters.',
    passFail: 'PASS if batch status changes to QC Approved and packaging button unlocked. FAIL if batch remains in quarantine.',
    evidence: 'Screenshot of batch row showing green QC Approved badge.',
    dependencies: 'TC-MFG-001',
    cleanup: 'Keep batch for packaging run test.',
    notes: 'Regulatory statutory compliance for agrochemical release.'
  },
  {
    id: 'TC-MFG-004',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Quality Control',
    subfeature: 'Sub-Standard Batch Rejection',
    title: 'QC Rejection Workflow: Off-Spec Batch Quarantine Isolation',
    priority: 'P2',
    role: 'QC Officer',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'A test batch exists with failed active ingredient assay (15.2% instead of 20%).',
    testData: 'Batch: BAT-TEST-FAIL | Assay: 15.20% | Decision: QC REJECTED | Reason: "Sub-potent active ingredient content. Do not pack."',
    steps: '1. Open QC Inspection modal for failed batch. 2. Enter Assay "15.20". 3. Select Decision "QC Rejected". 4. Enter Reason "Sub-potent active ingredient content. Move to re-processing tank." 5. Click "Submit QC Decision".',
    expected: 'Batch status permanently marked "QC Rejected" (Red badge). Packaging button is disabled. Batch cannot be packaged or dispatched to customers.',
    crossModule: 'Verify batch does not appear in packaging run selector or sales order dispatch selector.',
    passFail: 'PASS if rejected batch is isolated and packaging disabled. FAIL if rejected batch can be packed or sold.',
    evidence: 'Screenshot of QC Rejected batch with disabled packaging button.',
    dependencies: 'TC-MFG-001',
    cleanup: 'None',
    notes: 'Prevents contaminated or off-spec chemical distribution.'
  },
  {
    id: 'TC-MFG-005',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Finished Goods Packaging',
    subfeature: 'Bottling Run & Box Allocation',
    title: 'Package Bulk Batch into Finished Goods SKU Boxes & Loose Units',
    priority: 'P1',
    role: 'Packaging / Godown Operator',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Batch BAT-2026-CHLOR-002 is QC Approved (1,000 Litres bulk available). Packaging materials in WH-003.',
    testData: 'SKU: 500ml Bottle (10/box) | Boxes to Pack: 180 Boxes (= 1,800 bottles = 900 Litres) | Loose Bottles: 20 Bottles (= 10 Litres) | Total Packed: 1,820 Bottles (910 Litres) | Target WH: Finished Goods Store (WH-002)',
    steps: '1. On pages/production.html, locate approved batch BAT-2026-CHLOR-002. 2. Click "Package Goods" button in row actions. 3. In Packaging modal, select SKU "500ml Bottle (10 bottles/box)". 4. Enter Boxes Packed "180". 5. Enter Loose Bottles "20". 6. Total Litres auto-calculates: (180 x 10 x 0.5) + (20 x 0.5) = 900 + 10 = 910 Litres. 7. Select Target Warehouse "Main Plant Finished Goods Store (WH-002)". 8. Click "Complete Packaging Run".',
    expected: 'Toast "Packaging completed! Finished goods added to inventory." displays. Bulk batch remaining volume updates from 1,000L to 90L. New finished goods batch BAT-2026-CHLOR-002 is created in WH-002 containing 180 Boxes and 20 Loose Bottles (1,820 bottles total = 910 Litres).',
    crossModule: 'Navigate to pages/inventory.html: verify TEST-PROD-001 (500ml) shows 1,820 bottles in Finished Goods Warehouse WH-002.',
    passFail: 'PASS if finished goods stock accurately credited with boxes and loose units. FAIL if calculation incorrect or bulk stock not deducted.',
    evidence: 'Screenshot of Packaging modal calculation and updated finished goods stock row.',
    dependencies: 'TC-MFG-003, TC-PURCH-002',
    cleanup: 'Keep finished goods for customer dispatch tests.',
    notes: 'Handles box and loose-bottle SKU unit conversions.'
  },
  {
    id: 'TC-MFG-006',
    module: 'Manufacturing & QC',
    page: 'pages/production.html',
    feature: 'Packaging BOM Deduction',
    subfeature: 'Automated Packaging Material Decrement',
    title: 'Automated Deduction of Bottles, Caps, Labels & Cartons during Packaging Run',
    priority: 'P1',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Packaging run of 1,820 bottles (180 boxes + 20 loose) completed in TC-MFG-005.',
    testData: 'Expected Packaging Consumption: 500ml Bottles: 1,820 Units | 28mm Caps: 1,820 Units | Labels: 1,820 Units | Master Cartons: 180 Boxes',
    steps: '1. Navigate to pages/inventory.html. 2. Click "Packaging Materials" category tab. 3. Inspect current stock for: 500ml HDPE Bottle (TEST-PKG-001), 28mm Cap (TEST-PKG-002), 500ml Label (TEST-PKG-003), and Outer Carton (TEST-PKG-004).',
    expected: 'Each packaging item has decremented by exactly its required quantity: Bottles: -1,820 units; Caps: -1,820 units; Labels: -1,820 units; Outer Boxes: -180 units. (Loose bottles do not consume master outer boxes).',
    crossModule: 'Check pages/daily-transactions.html: automated packaging consumption log entries created.',
    passFail: 'PASS if packaging inventory decremented accurately with loose-unit logic. FAIL if cartons decremented for loose units or items not deducted.',
    evidence: 'Screenshot of packaging inventory balances showing exact deductions.',
    dependencies: 'TC-MFG-005',
    cleanup: 'None',
    notes: 'Validates packaging Bill of Materials automated cascade.'
  },

  // --- MODULE 10: DAILY STOCK USAGE ---
  {
    id: 'TC-DAILY-001',
    module: 'Shop-Floor Operations',
    page: 'pages/daily-transactions.html',
    feature: 'Material Consumption Log',
    subfeature: 'Operational Line Loss & Purge Entry',
    title: 'Record Daily Shop-Floor Material Usage & Equipment Purge Loss',
    priority: 'P2',
    role: 'Factory Operator / Supervisor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on pages/daily-transactions.html.',
    testData: 'Date: 2026-10-16 | Department: Formulation Plant | Material: Solvent C-IX (TEST-RAW-002) | Qty: 25.0 LTR | Purpose: "Tank flushing & pipe cleaning after batch run" | Operator: Sanjay Rathod',
    steps: '1. Open pages/daily-transactions.html. 2. Click "New Daily Usage Entry". 3. Select Department "Formulation Plant". 4. Select Material "Solvent C-IX". 5. Enter Quantity "25.0" LTR. 6. Enter Purpose "Tank flushing & pipe cleaning after batch run". 7. Click "Record Usage".',
    expected: 'Toast "Daily usage recorded!" displays. Log entry added to table. Solvent C-IX stock in WH-001 automatically decrements by 25.0 LTR.',
    crossModule: 'Check pages/inventory.html: Solvent C-IX stock reduced by 25 LTR.',
    passFail: 'PASS if entry logged and warehouse stock updated. FAIL if stock unchanged.',
    evidence: 'Screenshot of daily usage table showing new entry.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'Captures off-batch shop-floor chemical usage.'
  },
  {
    id: 'TC-DAILY-002',
    module: 'Shop-Floor Operations',
    page: 'pages/daily-transactions.html',
    feature: 'Reconciliation',
    subfeature: 'Daily Scrap & Loss Summary',
    title: 'Daily Material Usage Reconciliation & Monthly Scrap Aggregation',
    priority: 'P3',
    role: 'Production Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple daily usage entries recorded across shifts.',
    testData: 'Date Range: Current Month',
    steps: '1. On pages/daily-transactions.html, inspect top summary cards: "Total Monthly Solvent Usage", "Total Packaging Scrap", "Flushing Loss". 2. Verify values match table rows.',
    expected: 'Summary cards accurately aggregate all non-production line losses, enabling monthly material balance yield calculation.',
    crossModule: 'None',
    passFail: 'PASS if summary metrics aggregate table correctly. FAIL if discrepancies found.',
    evidence: 'Screenshot of daily transactions summary cards.',
    dependencies: 'TC-DAILY-001',
    cleanup: 'None',
    notes: 'Material yield accounting.'
  },
  {
    id: 'TC-DAILY-003',
    module: 'Shop-Floor Operations',
    page: 'pages/daily-transactions.html',
    feature: 'Filter & Search',
    subfeature: 'Department & Date Filter',
    title: 'Historical Daily Usage Filtering by Department & Shift',
    priority: 'P3',
    role: 'Factory Operator / Supervisor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Daily entries exist for Formulation Plant and Bottling Plant.',
    testData: 'Department Filter: "Bottling Plant"',
    steps: '1. Select "Bottling Plant" from department dropdown. 2. Verify table isolates packaging breakage and bottle cap losses.',
    expected: 'Table filters dynamically; displays only Bottling Plant entries.',
    crossModule: 'None',
    passFail: 'PASS if filter works cleanly. FAIL if wrong departments displayed.',
    evidence: 'Screenshot of filtered table view.',
    dependencies: 'TC-DAILY-001',
    cleanup: 'Reset filter to All Departments.',
    notes: 'Shift supervisor review tool.'
  },

  // --- MODULE 11: TECHNICAL CALCULATORS ---
  {
    id: 'TC-CALC-001',
    module: 'Formulation Tools',
    page: 'pages/batch-calculator.html',
    feature: 'Batch Scaling',
    subfeature: 'Dynamic Formulation BOM Scaling',
    title: 'Dynamic Recipe Scaling for Non-Standard Batch Volume (2,500L Batch)',
    priority: 'P2',
    role: 'Production & Plant Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Formulation FORM-CHLOR-20EC (Standard 1,000L) exists.',
    testData: 'Selected Formulation: FORM-CHLOR-20EC | Target Batch Volume: 2,500 Litres (Scale Factor = 2.5)',
    steps: '1. Open pages/batch-calculator.html. 2. Select Formulation "Chlorpyrifos 20% EC (FORM-CHLOR-20EC)". 3. Standard 1,000L recipe loads. 4. Change "Batch Volume" input from 1000 to 2500 Litres. 5. Observe scaled ingredients table.',
    expected: 'All ingredient requirements scale automatically by 2.5x: Chlorpyrifos Tech 98%: 204.08 x 2.5 = 510.20 KG; Emulsifier Poly-70: 80.00 x 2.5 = 200.00 LTR; Solvent C-IX: 715.92 x 2.5 = 1,789.80 LTR. Total Volume = 2,500.00 Litres.',
    crossModule: 'Inspect packaging requirements section: displays 5,000 x 500ml bottles or 2,500 x 1L bottles needed.',
    passFail: 'PASS if exact linear scaling computed with correct decimal precision. FAIL if rounding errors or ingredients fail to update.',
    evidence: 'Screenshot of scaled 2,500L BOM calculation table.',
    dependencies: 'TC-FORM-001',
    cleanup: 'None',
    notes: 'Essential tool for plant mixing tank capacity optimization.'
  },
  {
    id: 'TC-CALC-002',
    module: 'Formulation Tools',
    page: 'pages/calculator.html',
    feature: 'Active Ingredient Math',
    subfeature: 'Purity Dilution Calculation',
    title: 'Active Ingredient Technical Purity Dilution & EC Volume Calculator',
    priority: 'P3',
    role: 'QC Officer / Chemist',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Browser on pages/calculator.html.',
    testData: 'Technical Purity: 97.5% | Desired Formulation: 20.0% w/v | Batch Volume: 1,000 Litres',
    steps: '1. Open pages/calculator.html. 2. In Dilution Calculator card, enter Technical Purity "97.5". 3. Enter Desired Concentration "20.0". 4. Enter Target Volume "1000" Litres. 5. Click "Calculate Required Technical".',
    expected: 'Calculator outputs: Required Technical Grade = (20 / 97.5) x 1000 = 205.13 KG of active ingredient required.',
    crossModule: 'None',
    passFail: 'PASS if formula calculates 205.13 KG accurately. FAIL if wrong formula used.',
    evidence: 'Screenshot of calculator result card.',
    dependencies: 'None',
    cleanup: 'None',
    notes: 'Standard agrochemical chemical assay calculation.'
  },

  // --- MODULE 12: SALES ORDERS & GODOWN DISPATCHES ---
  {
    id: 'TC-ORD-001',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Sales Order Booking',
    subfeature: 'Multi-SKU Customer Order Creation',
    title: 'Create Commercial Multi-SKU Sales Order with Automatic Tax & Pricing',
    priority: 'P1',
    role: 'Sales & Dispatch Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Customer TEST-CUST-001 and Product TEST-PROD-001 exist.',
    testData: 'Customer: Kisan Agro Agency | Order Date: 2026-10-16 | Items: 10 Boxes of 500ml SKU (100 bottles @ ₹280 = ₹28,000) + 5 Boxes of 1L SKU (50 bottles @ ₹520 = ₹26,000) | GST: 18%',
    steps: '1. Open pages/orders.html. 2. Click "New Sales Order" button. 3. Select Customer "Kisan Agro Agency". 4. Select Dispatch Warehouse "Main Plant Finished Goods Store (WH-002)". 5. Add Line 1: Select "Anjani Chlor-20 EC", SKU "500ml", enter Boxes "10", Loose Units "0". Unit Price auto-fills "₹280.00". Line Subtotal = ₹28,000. 6. Add Line 2: Select "Anjani Chlor-20 EC", SKU "1 Litre", enter Boxes "5", Loose Units "0". Unit Price auto-fills "₹520.00". Line Subtotal = ₹26,000. 7. Verify Order Totals: Subtotal: ₹54,000.00; CGST 9%: ₹4,860.00; SGST 9%: ₹4,860.00; Grand Total: ₹63,720.00. 8. Click "Create Sales Order".',
    expected: 'Toast "Sales order created successfully!" displays. Order appears in table with status "Pending" or "Approved", Order No "SO-2026-001", and Total "₹63,720.00". Customer outstanding balance is flagged.',
    crossModule: 'Check pages/clients.html: Kisan Agro Agency displays pending order commitment of ₹63,720.',
    passFail: 'PASS if order booked with exact prices and tax calculations. FAIL if calculations wrong or order save fails.',
    evidence: 'Screenshot of orders table showing new order SO-2026-001.',
    dependencies: 'TC-CUST-001, TC-PROD-001',
    cleanup: 'Keep order for dispatch verification tests.',
    notes: 'Validates commercial order booking with multi-SKU tax calculation.'
  },
  {
    id: 'TC-ORD-002',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Credit Governance',
    subfeature: 'Credit Limit Breach Warning',
    title: 'Customer Credit Limit Exceeded Warning Prompt',
    priority: 'P2',
    role: 'Sales & Dispatch Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Customer TEST-CUST-003 has credit limit ₹2,00,000 and current balance ₹1,80,000.',
    testData: 'New Order Total: ₹50,000 (Exceeds remaining credit limit of ₹20,000)',
    steps: '1. On New Sales Order modal, select customer "Shree Ram Fertilizer & Agro (TEST-CUST-003)". 2. Add product items totaling ₹50,000. 3. Click "Create Sales Order".',
    expected: 'Credit warning banner triggers: "Credit Limit Warning: Customer credit limit (₹2,00,000) will be exceeded by ₹30,000 with this order. Director approval required." Allows submitting for dual-custody approval or canceling.',
    crossModule: 'Check pages/user-roles.html (Approvals tab): credit breach approval request generated.',
    passFail: 'PASS if credit limit breach warning triggered. FAIL if order bypasses credit controls silently.',
    evidence: 'Screenshot of credit limit breach warning dialog.',
    dependencies: 'TC-ORD-001',
    cleanup: 'Cancel modal.',
    notes: 'Financial credit risk mitigation.'
  },
  {
    id: 'TC-ORD-003',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Godown Verification',
    subfeature: 'Partial Dispatch Challan',
    title: 'Godown Verification & Partial Dispatch Challan Generation',
    priority: 'P1',
    role: 'Sales Executive / Godown Operator',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Order SO-2026-001 has 10 boxes of 500ml ordered. WH-002 has stock.',
    testData: 'Dispatch Quantity: 6 Boxes (4 Boxes remaining)',
    steps: '1. Locate order SO-2026-001 on pages/orders.html. 2. Click "Dispatch Slip / Godown Check" button. 3. In Godown modal, for 500ml SKU, enter "6" Boxes to dispatch (leaving 4 boxes). 4. Enter Vehicle No "GJ-03-BW-4411" and Driver Name "Kishorbhai". 5. Click "Confirm Partial Dispatch".',
    expected: 'Toast "Partial dispatch confirmed! Dispatch Challan generated." displays. Order status updates to "Partially Dispatched". Exactly 6 boxes (60 bottles = 30L) are deducted from WH-002. Dispatch Challan slip generated showing 6 boxes dispatched and 4 boxes pending.',
    crossModule: 'Check pages/inventory.html: Finished goods stock for 500ml SKU decrements by exactly 60 bottles (6 boxes).',
    passFail: 'PASS if partial stock deducted and remaining balance tracked accurately. FAIL if entire order deducted or zero stock deducted.',
    evidence: 'Screenshot of Dispatch Challan modal showing partial quantities and vehicle number.',
    dependencies: 'TC-ORD-001, TC-MFG-005',
    cleanup: 'Keep order for full dispatch test.',
    notes: 'Handles multi-shipment dispatch workflows.'
  },
  {
    id: 'TC-ORD-004',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Final Dispatch',
    subfeature: 'Complete Fulfillment & Invoice Lock',
    title: 'Complete Order Fulfillment, Final Dispatch & Automatic Invoice Linking',
    priority: 'P1',
    role: 'Sales Executive / Godown Operator',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Order SO-2026-001 has remaining 4 boxes of 500ml and 5 boxes of 1L.',
    testData: 'Remaining Boxes Dispatched: 4 boxes (500ml) + 5 boxes (1L)',
    steps: '1. Click "Dispatch Slip" on SO-2026-001. 2. Confirm dispatch of all remaining 4 boxes (500ml) and 5 boxes (1L). 3. Enter Vehicle No "GJ-03-BW-4411". 4. Click "Confirm Final Dispatch".',
    expected: 'Order status transitions to "Dispatched" (Green badge). All remaining inventory is deducted from WH-002. Order is locked from further dispatch. Button "Generate Tax Invoice" appears in row actions.',
    crossModule: 'Check pages/inventory.html: total finished goods deducted matches full order quantity (10 boxes 500ml + 5 boxes 1L).',
    passFail: 'PASS if order status is Dispatched and stock deducted cleanly. FAIL if status remains Partial or stock over-deducted.',
    evidence: 'Screenshot of order table showing status Dispatched.',
    dependencies: 'TC-ORD-003',
    cleanup: 'Keep order for reporting and invoice tests.',
    notes: 'Full commercial sales fulfillment cycle.'
  },
  {
    id: 'TC-ORD-005',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Reversal Guard',
    subfeature: 'Order Cancellation & Anti-Double Deduction',
    title: 'Cancel Dispatched Order & Inventory Restocking without Double Counting',
    priority: 'P1',
    role: 'Company Owner / Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'A test order with 2 boxes dispatched was booked incorrectly.',
    testData: 'Target Order: Test Order SO-TEST-REVERSE (20 bottles dispatched)',
    steps: '1. Locate test order on pages/orders.html. 2. Click "Cancel & Reverse Order" in row actions. 3. Enter Reason "Customer cancelled truck at gate; goods returned to warehouse". 4. Confirm cancellation.',
    expected: 'Order status changes to "Cancelled / Reversed". The 20 bottles (2 boxes) are returned to WH-002 stock. Customer balance is credited. Re-opening or refreshing the page does not add the 20 bottles a second time.',
    crossModule: 'Check pages/inventory.html: finished goods stock increased by exactly 20 bottles. Check pages/audit-logs.html for ORDER_REVERSED event.',
    passFail: 'PASS if stock restored exactly once with idempotency. FAIL if stock doubled or fails to restore.',
    evidence: 'Screenshot of cancelled order row and audit log entry.',
    dependencies: 'TC-ORD-001',
    cleanup: 'None',
    notes: 'Validates anti-duplicate stock reversal logic.'
  },
  {
    id: 'TC-ORD-006',
    module: 'Sales & Distribution',
    page: 'pages/orders.html',
    feature: 'Search & Status',
    subfeature: 'Filter by Order Status & Customer',
    title: 'Search Orders by Order ID, Customer Name & Dispatch Status Filter',
    priority: 'P3',
    role: 'Sales Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple orders exist in Pending, Partially Dispatched, and Dispatched states.',
    testData: 'Status Filter: "Dispatched" | Search: "Kisan Agro"',
    steps: '1. Select "Dispatched" from status filter dropdown. Verify table displays only fully dispatched orders. 2. Enter "Kisan Agro" in search input. 3. Verify only Kisan Agro Agency dispatched orders appear.',
    expected: 'Table filters accurately in real time without lag.',
    crossModule: 'None',
    passFail: 'PASS if table filters cleanly. FAIL if wrong statuses displayed.',
    evidence: 'Screenshot of filtered orders table.',
    dependencies: 'TC-ORD-001',
    cleanup: 'Reset filter to All Statuses.',
    notes: 'Operational order dispatch tracking.'
  },

  // --- MODULE 13: COMPANIES & BRANCHES ---
  {
    id: 'TC-COMP-001',
    module: 'Enterprise Multi-Company',
    page: 'pages/companies.html',
    feature: 'Entity Management',
    subfeature: 'Register Subsidiary Legal Entity & Branch',
    title: 'Register Subsidiary Legal Entity & Assign Operating Branch',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Corporate Group (Tenant)',
    preconditions: 'Logged in as Super Admin on pages/companies.html.',
    testData: 'Company Name: Company D - TEST (Agro Tech) | Code: CO-D | Type: Trading / Retail | City: Surat | State: Gujarat (24) | GSTIN: 24AAACD9988E1Z1 | Branch: Surat South Branch (CO-D-BR01)',
    steps: '1. Open pages/companies.html. 2. Click "Add Company" button. 3. Enter Name "Company D - TEST (Agro Tech)". 4. Enter Code "CO-D". 5. Select Type "Trading / Distribution". 6. Fill City "Surat", State "Gujarat", GSTIN "24AAACD9988E1Z1". 7. Click "Save Company". 8. In Branches section, click "Add Branch". 9. Enter Branch Name "Surat South Branch", Code "CO-D-BR01", assign to Company D. 10. Click "Save Branch".',
    expected: 'Success toast displays. Company D appears in companies table with Trading badge. Branch CO-D-BR01 appears in branch list. Company D is now selectable in topbar company switcher.',
    crossModule: 'Click topbar company switcher: verify Company D appears in list of authorized companies.',
    passFail: 'PASS if company and branch created and visible in switcher. FAIL if save errors or multi-company link breaks.',
    evidence: 'Screenshot of companies table showing Company D row.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep or delete after isolation test.',
    notes: 'Multi-company organizational structure expansion.'
  },
  {
    id: 'TC-COMP-002',
    module: 'Enterprise Multi-Company',
    page: 'pages/companies.html',
    feature: 'Security Rule',
    subfeature: 'Root Entity Deletion Protection',
    title: 'Root Company Anjani Agri Care Deletion & Archival Protection Guard',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Root Company Anjani Agri Care (ID 1) displayed on pages/companies.html.',
    testData: 'Target: Anjani Agri Care (ID: 1)',
    steps: '1. Locate Anjani Agri Care (ID 1) in companies table. 2. Attempt to click Delete (trash) icon or Archive toggle.',
    expected: 'System strictly blocks operation with error: "Security Rule: Anjani Agri Care (ID 1) is the primary manufacturing company and root legal entity, and cannot be deleted or archived." Action is halted.',
    crossModule: 'Verify Company ID 1 remains active in database and topbar.',
    passFail: 'PASS if root entity is immutably protected. FAIL if root company can be deleted or archived.',
    evidence: 'Screenshot of security rule blocking toast.',
    dependencies: 'TC-COMP-001',
    cleanup: 'None',
    notes: 'Guarantees primary manufacturing legal entity stability.'
  },
  {
    id: 'TC-COMP-003',
    module: 'Enterprise Multi-Company',
    page: 'pages/companies.html',
    feature: 'Tenant Isolation',
    subfeature: 'Cross-Company Data Partitioning',
    title: 'Multi-Company Scope Enforcement: Cross-Tenant Data Boundary',
    priority: 'P1',
    role: 'Company Owner (Company B)',
    company: 'Company B - TEST (CO-B, ID: 3)',
    preconditions: 'User retail_owner@compb.test logged in with Company B scope.',
    testData: 'Active Company: Company B - TEST',
    steps: '1. Log in as retail_owner@compb.test. 2. Verify topbar displays "Company B - TEST". 3. Navigate to pages/orders.html. 4. Inspect sales orders table.',
    expected: 'Table displays ONLY orders belonging to Company B. All confidential manufacturing orders, recipes, and dispatches of Anjani Agri Care (Company 1) are completely invisible.',
    crossModule: 'Navigate to pages/warehouses.html: verify only Company B warehouses (WH-COB-01) are displayed.',
    passFail: 'PASS if 100% data isolation maintained with zero cross-tenant leakage. FAIL if competitor or parent records visible.',
    evidence: 'Screenshot of orders table under Company B user showing zero parent company orders.',
    dependencies: 'TC-COMP-001',
    cleanup: 'Log back in as Super Admin.',
    notes: 'Verifies server-level multi-tenant data partitioning.'
  },

  // --- MODULE 14: WAREHOUSES & LOCATIONS ---
  {
    id: 'TC-WH-001',
    module: 'Storage Locations',
    page: 'pages/warehouses.html',
    feature: 'Warehouse Management',
    subfeature: 'Create Central Chemical Depot',
    title: 'Create Central Chemical Depot with Supervisor Assignment',
    priority: 'P1',
    role: 'Warehouse & Store Manager / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on pages/warehouses.html.',
    testData: 'Name: North GIDC Chemical Storage Depot | Code: WH-ACC-04 | Company: Anjani Agri Care (ID: 1) | Branch: Main Plant HO | Type: Raw Materials | Capacity: 30,000 KG | Supervisor: Mukesh Dave',
    steps: '1. Open pages/warehouses.html. 2. Click "Add Warehouse" button. 3. Enter Name "North GIDC Chemical Storage Depot". 4. Enter Code "WH-ACC-04". 5. Select Company "Anjani Agri Care". 6. Select Branch "Main Plant HO". 7. Select Type "Raw Materials & Solvents". 8. Enter Capacity "30000". 9. Click "Save Warehouse".',
    expected: 'Toast "Warehouse saved successfully!" appears. New warehouse displays in table with Active badge and assigned supervisor. Selectable in purchase GRN and transfer modals.',
    crossModule: 'Open pages/purchases.html: verify WH-ACC-04 appears in target warehouse dropdown.',
    passFail: 'PASS if warehouse saved and linked to company and branch. FAIL if save errors or company link lost.',
    evidence: 'Screenshot of warehouses table showing WH-ACC-04 row.',
    dependencies: 'TC-COMP-001',
    cleanup: 'Keep or delete in safe deletion test.',
    notes: 'Warehouse location hierarchy setup.'
  },
  {
    id: 'TC-WH-002',
    module: 'Storage Locations',
    page: 'pages/warehouses.html',
    feature: 'Warehouse Filtering',
    subfeature: 'Filter by Authorized Company',
    title: 'Filter Warehouses by Company Context & Type',
    priority: 'P2',
    role: 'Warehouse & Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Warehouses exist for Company 1, Company 2, and Company 3.',
    testData: 'Company Filter: "Anjani Agri Care (ACC)" | Type Filter: "Finished Goods"',
    steps: '1. Open pages/warehouses.html. 2. Select "Anjani Agri Care" in company filter dropdown. 3. Select "Finished Goods" in type filter. 4. Observe filtered table.',
    expected: 'Table displays only Finished Goods stores belonging to Anjani Agri Care (e.g. WH-002). Warehouses from other companies or other storage types are filtered out.',
    crossModule: 'None',
    passFail: 'PASS if filtering isolates warehouse records accurately. FAIL if cross-company warehouses appear.',
    evidence: 'Screenshot of filtered warehouses table.',
    dependencies: 'TC-WH-001',
    cleanup: 'Reset filters to All.',
    notes: 'Multi-warehouse multi-company navigation.'
  },
  {
    id: 'TC-WH-003',
    module: 'Storage Locations',
    page: 'pages/warehouses.html',
    feature: 'Integrity Guard',
    subfeature: 'Prevent Deletion of Warehouse with Active Stock',
    title: 'Safe Deletion Guard: Block Deletion of Warehouse with Active Batches',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Warehouse WH-001 has active raw material inventory batches.',
    testData: 'Target Warehouse: Main Plant RM Store (WH-001)',
    steps: '1. On pages/warehouses.html, locate WH-001. 2. Click Delete (trash) icon. 3. In confirmation prompt, click "Confirm Delete".',
    expected: 'System blocks deletion: "Cannot delete warehouse WH-001 because active inventory batches are currently stored in it. Transfer or dispose of all stock before deleting." Warehouse is preserved.',
    crossModule: 'Verify WH-001 remains in table and stock batches in WH-001 remain intact on pages/inventory.html.',
    passFail: 'PASS if deletion blocked and stock protected. FAIL if warehouse deleted, orphaning active stock batches.',
    evidence: 'Screenshot of error toast preventing warehouse deletion.',
    dependencies: 'TC-WH-001',
    cleanup: 'None',
    notes: 'Protects physical storage location referential integrity.'
  },

  // --- MODULE 15: INTERCOMPANY TRANSFERS & RECONCILIATION ---
  {
    id: 'TC-INCO-001',
    module: 'Intercompany Operations',
    page: 'pages/intercompany.html',
    feature: 'Commercial Agreements',
    subfeature: 'Authorize Supply Link & Pricing Tier',
    title: 'Authorize Intercompany Supply Link (Manufacturer to Retail Subsidiary)',
    priority: 'P1',
    role: 'Company Owner / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in as Director on pages/intercompany.html.',
    testData: 'Source Company: Anjani Agri Care (ID: 1) | Recipient Company: Company A - TEST (ID: 2) | Supply Type: Intercompany Transfer | Pricing Tier: Cost + 8% Handling | Status: Active',
    steps: '1. Open pages/intercompany.html. 2. Click "New Intercompany Link". 3. Select Source Company "Anjani Agri Care". 4. Select Recipient Company "Company A - TEST (Agro Retail)". 5. Select Supply Type "Intercompany Transfer". 6. Set Pricing Tier to "Cost + 8% Handling". 7. Click "Authorize Supply Link".',
    expected: 'Toast "Intercompany link authorized!" appears. Active agreement row displays in Authorized Links table. Intercompany transfer orders between ACC and Company A are now enabled.',
    crossModule: 'Verify link is selectable in transfer modal.',
    passFail: 'PASS if intercompany link authorized and active. FAIL if agreement fails to save.',
    evidence: 'Screenshot of intercompany links table showing ACC -> Company A row.',
    dependencies: 'TC-COMP-001',
    cleanup: 'Keep link for transfer tests.',
    notes: 'Foundational intercompany commercial governance.'
  },
  {
    id: 'TC-INCO-002',
    module: 'Intercompany Operations',
    page: 'pages/intercompany.html',
    feature: 'Stock Transfer Dispatch',
    subfeature: 'Dispatch Outward & In-Transit Tracking',
    title: 'Initiate Intercompany Stock Transfer Dispatch & In-Transit Isolation',
    priority: 'P1',
    role: 'Warehouse & Store Manager (ACC)',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Authorized link exists between ACC and Company A. WH-002 has stock of Anjani Chlor-20 EC (500ml).',
    testData: 'Transfer No: ICT-2026-001 | Source WH: Main Plant FG Store (WH-002) | Destination WH: Company A Central Depot (WH-COA-01) | Item: Anjani Chlor-20 EC (500ml) | Qty: 20 Boxes (200 bottles) | Transfer Price: ₹220/bottle',
    steps: '1. On pages/intercompany.html, click "New Stock Transfer". 2. Select Source "Anjani Agri Care - FG Store (WH-002)". 3. Select Recipient "Company A - Central Depot (WH-COA-01)". 4. Add Line: Anjani Chlor-20 EC 500ml, Qty "20 Boxes" (200 bottles). 5. Enter Transfer Price "₹220.00". 6. Click "Dispatch Intercompany Transfer".',
    expected: 'Toast "Transfer dispatched! Goods marked In-Transit." displays. Transfer record ICT-2026-001 created with status "In-Transit". Exactly 20 boxes (200 bottles) are deducted from ACC WH-002. Goods are held in In-Transit virtual ledger and NOT yet credited to Company A until received.',
    crossModule: 'Check pages/inventory.html: ACC WH-002 stock reduced by 200 bottles. Check Company A inventory: stock NOT yet added (prevents premature revenue/stock booking).',
    passFail: 'PASS if stock deducted from source and held In-Transit. FAIL if stock immediately credited to destination before receipt.',
    evidence: 'Screenshot of intercompany transfers table showing ICT-2026-001 with In-Transit badge.',
    dependencies: 'TC-INCO-001, TC-MFG-005',
    cleanup: 'Keep transfer for receipt test.',
    notes: 'Prevents double-counting and phantom stock during transport.'
  },
  {
    id: 'TC-INCO-003',
    module: 'Intercompany Operations',
    page: 'pages/intercompany.html',
    feature: 'Inward Receipt',
    subfeature: 'Recipient Depot Inward & Transfer Reconciliation',
    title: 'Recipient Depot Inward Acceptance & Intercompany Transfer Reconciliation',
    priority: 'P1',
    role: 'Warehouse Manager (Company A)',
    company: 'Company A - TEST (CO-A, ID: 2)',
    preconditions: 'Transfer ICT-2026-001 is In-Transit (20 boxes / 200 bottles).',
    testData: 'Received Qty: 20 Boxes (Zero transit damage) | Destination WH: WH-COA-01',
    steps: '1. Switch company context to "Company A - TEST" via topbar switcher. 2. Navigate to pages/intercompany.html. 3. Locate pending transfer ICT-2026-001 under Inbound Shipments tab. 4. Click "Accept Inbound Delivery" button. 5. Verify quantities (20 boxes). 6. Click "Confirm Delivery Receipt".',
    expected: 'Toast "Transfer accepted! Stock credited to Company A Central Depot." displays. Transfer status transitions to "Completed / Reconciled". 20 boxes (200 bottles) are credited to WH-COA-01. In-Transit balance clears to zero.',
    crossModule: 'Check pages/inventory.html under Company A context: verify 20 boxes of Anjani Chlor-20 EC now present in WH-COA-01.',
    passFail: 'PASS if transfer completes, In-Transit clears, and recipient warehouse credited. FAIL if stock credited twice or fails to reconcile.',
    evidence: 'Screenshot of Completed transfer row with green Reconciled badge.',
    dependencies: 'TC-INCO-002',
    cleanup: 'Switch back to Anjani Agri Care.',
    notes: 'Dual-custody supply chain reconciliation.'
  },
  {
    id: 'TC-INCO-004',
    module: 'Intercompany Operations',
    page: 'pages/intercompany.html',
    feature: 'Consignment Stock',
    subfeature: 'Consignment Inventory Ownership Notice',
    title: 'Consignment Supply Agreement & Legal Ownership Protection',
    priority: 'P2',
    role: 'Company Owner / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Consignment transfer agreement exists with Company B (Junagadh Depot).',
    testData: 'Supply Type: CONSIGNMENT | Item: Anjani Chlor-20 EC',
    steps: '1. On pages/intercompany.html, create Consignment transfer to Company B. 2. Observe Consignment Notice on transfer documentation.',
    expected: 'Notice displays prominently: "CONSIGNMENT NOTICE: Goods will be stored at recipient depot but remain legally owned by Anjani Agri Care until sold to end farmer." Stock is classified as Consignment Inventory on financial statements.',
    crossModule: 'Check pages/reports.html: consignment stock reported under Anjani Agri Care assets.',
    passFail: 'PASS if consignment ownership clearly identified. FAIL if consignment treated as outright sale.',
    evidence: 'Screenshot of consignment dispatch slip with legal ownership notice.',
    dependencies: 'TC-INCO-001',
    cleanup: 'None',
    notes: 'Legal compliance for agrochemical dealer consignment arrangements.'
  },

  // --- MODULE 16: CASH & BANK LEDGER ---
  {
    id: 'TC-FIN-001',
    module: 'Finance & Accounts',
    page: 'pages/transactions.html',
    feature: 'Cash & Bank Ledger',
    subfeature: 'Customer Payment Receipt Posting',
    title: 'Record Customer Commercial Payment Receipt Against Open Invoice',
    priority: 'P1',
    role: 'Commercial Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Customer Kisan Agro Agency has outstanding invoice SO-2026-001 (₹63,720.00).',
    testData: 'Transaction Type: Receipt (Credit) | Customer: Kisan Agro Agency | Amount: ₹63,720.00 | Payment Mode: NEFT / Bank Transfer | Bank: Punjab National Bank (A/c: 9178002100002019) | UTR Reference: UTR-PUNB-998822 | Date: 2026-10-16',
    steps: '1. Open pages/transactions.html. 2. Click "New Transaction" button. 3. Select Type "Customer Receipt (Inflow)". 4. Select Customer "Kisan Agro Agency". 5. Select Linked Invoice "SO-2026-001 (₹63,720.00)". 6. Enter Amount "63720.00". 7. Select Bank "Punjab National Bank". 8. Enter UTR Ref "UTR-PUNB-998822". 9. Click "Post Transaction".',
    expected: 'Toast "Payment receipt posted successfully!" displays. Ledger row added showing +₹63,720.00 credited to Punjab National Bank account. Running bank balance increases by ₹63,720.00. Invoice SO-2026-001 marked as "Paid". Customer outstanding balance reduced to ₹0.00.',
    crossModule: 'Check pages/clients.html: Kisan Agro Agency outstanding balance updates to ₹0.00. Check pages/orders.html: order payment status shows "Paid".',
    passFail: 'PASS if ledger balance increments, invoice marked paid, and customer balance cleared. FAIL if duplicate receipt posted or balance calculation incorrect.',
    evidence: 'Screenshot of transactions ledger showing customer receipt row.',
    dependencies: 'TC-ORD-004',
    cleanup: 'Keep transaction for financial reporting tests.',
    notes: 'Dual-entry commercial receivables accounting.'
  },
  {
    id: 'TC-FIN-002',
    module: 'Finance & Accounts',
    page: 'pages/transactions.html',
    feature: 'Cash & Bank Ledger',
    subfeature: 'Vendor Payment Disbursement',
    title: 'Record Supplier Raw Material Payment Disbursement with Bank Details',
    priority: 'P1',
    role: 'Commercial Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Supplier Gujarat Chemicals has open purchase invoice INV-GC-8841 (₹7,67,000.00).',
    testData: 'Transaction Type: Payment (Debit) | Supplier: Gujarat Chemicals | Amount: ₹7,67,000.00 | Mode: RTGS | Bank: State Bank of India | Cheque/UTR: RTGS-SBIN-445511 | Date: 2026-10-16',
    steps: '1. On pages/transactions.html, click "New Transaction". 2. Select Type "Supplier Payment (Outflow)". 3. Select Supplier "Gujarat Chemicals & Synthetics Ltd". 4. Select Linked Purchase "INV-GC-8841". 5. Enter Amount "767000.00". 6. Select Bank "State Bank of India". 7. Enter UTR "RTGS-SBIN-445511". 8. Click "Post Transaction".',
    expected: 'Toast "Payment disbursement posted!" displays. Bank ledger debited by ₹7,67,000.00. Running bank balance decrements. Supplier open payable is cleared.',
    crossModule: 'Check pages/suppliers.html: Gujarat Chemicals outstanding payable clears.',
    passFail: 'PASS if payment debited cleanly and supplier payable cleared. FAIL if ledger balance drops below minimum without warning.',
    evidence: 'Screenshot of transactions ledger showing supplier debit entry.',
    dependencies: 'TC-PURCH-001',
    cleanup: 'None',
    notes: 'Disbursement payables settlement.'
  },
  {
    id: 'TC-FIN-003',
    module: 'Finance & Accounts',
    page: 'pages/transactions.html',
    feature: 'Reconciliation',
    subfeature: 'Bank Ledger Balance Integrity',
    title: 'Bank Ledger Running Balance Reconciliation & Filter by Account',
    priority: 'P2',
    role: 'Commercial Accountant / Auditor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Multiple receipts and payments posted.',
    testData: 'Account Filter: "Punjab National Bank"',
    steps: '1. Select "Punjab National Bank" in account filter dropdown. 2. Verify all listed rows belong to PNB. 3. Verify running balance formula: Starting Balance + Total Receipts - Total Payments = Current Balance.',
    expected: 'Running balance column reconciles mathematically row by row with zero mathematical variance.',
    crossModule: 'None',
    passFail: 'PASS if mathematical balance integrity holds 100%. FAIL if running balance deviates from receipts minus payments.',
    evidence: 'Screenshot of bank ledger statement showing reconciled balance column.',
    dependencies: 'TC-FIN-001, TC-FIN-002',
    cleanup: 'Reset filter to All Accounts.',
    notes: 'Statutory financial ledger audit integrity.'
  },

  // --- MODULE 17: OPERATIONAL EXPENSES ---
  {
    id: 'TC-EXP-001',
    module: 'Operational Expenses',
    page: 'pages/expenses.html',
    feature: 'Expense Booking',
    subfeature: 'Direct Cost Center Allocation',
    title: 'Book Factory Operational Expense with Cost Center Allocation',
    priority: 'P2',
    role: 'Commercial Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in on pages/expenses.html.',
    testData: 'Category: Freight & Cartage | Amount: ₹14,500.00 | Date: 2026-10-16 | Cost Center: Virva Formulation Plant | Vendor: Marutinandan Roadlines | Ref: LR-MR-8812 | Mode: Bank Transfer',
    steps: '1. Open pages/expenses.html. 2. Click "Add Expense" button. 3. Select Category "Freight & Transportation". 4. Enter Amount "14500.00". 5. Select Cost Center "Virva Formulation Plant". 6. Enter Vendor/Payee "Marutinandan Roadlines". 7. Enter Ref "LR-MR-8812". 8. Click "Save Expense".',
    expected: 'Toast "Expense recorded successfully!" displays. Expense row appears in table. Factory overhead summary updates immediately.',
    crossModule: 'Check pages/dashboard.html: monthly operational expenses KPI updates.',
    passFail: 'PASS if expense booked with cost center and reflected in totals. FAIL if save fails.',
    evidence: 'Screenshot of expenses table showing new freight entry.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep for financial reporting tests.',
    notes: 'Captures factory overhead and transportation costs.'
  },
  {
    id: 'TC-EXP-002',
    module: 'Operational Expenses',
    page: 'pages/expenses.html',
    feature: 'Expense Analytics',
    subfeature: 'Category Breakdown & Monthly Budget',
    title: 'Monthly Expense Category Breakdown & Overhead Summary',
    priority: 'P3',
    role: 'Company Owner / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Expenses booked across Freight, Utilities, Lab Consumables, and Factory Spares.',
    testData: 'Category Filter: "Utilities / Electricity"',
    steps: '1. Select "Utilities / Electricity" from category filter. 2. Inspect filtered rows and category sum. 3. Reset filter to All Categories.',
    expected: 'Table filters accurately; overhead metric cards reflect exact category expenditure.',
    crossModule: 'None',
    passFail: 'PASS if category filtering works cleanly. FAIL if totals mismatch table rows.',
    evidence: 'Screenshot of expense category breakdown chart.',
    dependencies: 'TC-EXP-001',
    cleanup: 'Reset filter to All.',
    notes: 'Operational overhead budget tracking.'
  },

  // --- MODULE 18: REPORTS & COMMERCIAL ANALYTICS ---
  {
    id: 'TC-REP-001',
    module: 'Commercial Reports',
    page: 'pages/reports.html',
    feature: 'Sales Reporting',
    subfeature: 'Customer Sales & Dispatch Summary',
    title: 'Generate Customer Sales & Dispatch Performance Report',
    priority: 'P1',
    role: 'Company Owner / Sales Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Sales orders and dispatches completed in Module 12.',
    testData: 'Report Type: Customer Sales Summary | Date Range: Current Month | Customer: All Customers',
    steps: '1. Open pages/reports.html. 2. Select Report Type "Customer Sales & Dispatch Summary". 3. Select Date Range "This Month". 4. Click "Generate Report". 5. Inspect report table.',
    expected: 'Report generates with rows for each customer: Customer Name, Total Orders, Units Dispatched, Taxable Sales Value, GST Collected, Total Invoiced Value, Outstanding Balance. Kisan Agro Agency displays ₹54,000 taxable + ₹9,720 GST = ₹63,720 total sales.',
    crossModule: 'Cross-reference total sales against orders listed on pages/orders.html.',
    passFail: 'PASS if report matches underlying dispatches with 100% mathematical accuracy. FAIL if orders missing or totals incorrect.',
    evidence: 'Screenshot of Customer Sales Summary report table.',
    dependencies: 'TC-ORD-004',
    cleanup: 'None',
    notes: 'Core commercial revenue intelligence.'
  },
  {
    id: 'TC-REP-002',
    module: 'Commercial Reports',
    page: 'pages/reports.html',
    feature: 'Inventory Valuation',
    subfeature: 'Finished Goods Stock Valuation Ledger',
    title: 'Finished Goods & Raw Material Inventory Valuation Ledger',
    priority: 'P1',
    role: 'Company Owner / Auditor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Physical stock batches present in WH-001, WH-002, and WH-003.',
    testData: 'Report Type: Inventory Stock Valuation | Valuation Method: Weighted Average Cost',
    steps: '1. On pages/reports.html, select Report Type "Stock Valuation Ledger". 2. Click "Generate Report". 3. Inspect columns: Item Code, Category, Batch No, Warehouse, Current Qty, Unit Cost, Total Valuation.',
    expected: 'Valuation report lists every batch with exact formula: Qty x Unit Cost = Total Value. Grand Total Valuation matches sum of individual batch values.',
    crossModule: 'Cross-reference with total inventory count on pages/inventory.html.',
    passFail: 'PASS if valuation reconciles with physical batches to the rupee. FAIL if valuation formula incorrect.',
    evidence: 'Screenshot of Inventory Stock Valuation report.',
    dependencies: 'TC-INV-001, TC-MFG-005',
    cleanup: 'None',
    notes: 'Statutory balance sheet inventory valuation.'
  },
  {
    id: 'TC-REP-003',
    module: 'Commercial Reports',
    page: 'pages/reports.html',
    feature: 'Tax Compliance',
    subfeature: 'GST Summary Report (GSTR-1 Outward)',
    title: 'GST Tax Summary Report (GSTR-1 Outward B2B Sales Verification)',
    priority: 'P1',
    role: 'Commercial Accountant / Auditor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Taxable sales orders dispatched.',
    testData: 'Report Type: GST Outward Tax Summary (GSTR-1 Format) | Tax Period: Current Month',
    steps: '1. Select "GST Outward Tax Summary". 2. Click "Generate Report". 3. Inspect tax breakdown: Gross Taxable Value, CGST (9%), SGST (9%), IGST (18%), Total Tax.',
    expected: 'Report groups sales into Intra-State (CGST + SGST) vs Inter-State (IGST) accurately based on customer GSTIN state code (24 = Gujarat Intra-State). Tax amounts match posted invoice figures.',
    crossModule: 'Check SO-2026-001: CGST ₹4,860.00 and SGST ₹4,860.00 correctly aggregated in Intra-State bucket.',
    passFail: 'PASS if tax classification and totals match GSTR statutory rules. FAIL if tax rates miscalculated.',
    evidence: 'Screenshot of GST Outward Tax Summary table.',
    dependencies: 'TC-ORD-004',
    cleanup: 'None',
    notes: 'Statutory tax return filing reconciliation.'
  },
  {
    id: 'TC-REP-004',
    module: 'Commercial Reports',
    page: 'pages/reports.html',
    feature: 'Export',
    subfeature: 'Excel / CSV Report Download',
    title: 'Export Commercial Report to Formatted CSV / Excel',
    priority: 'P2',
    role: 'Company Owner / Sales Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'A report has been generated on screen.',
    testData: 'Click "Export to CSV" button',
    steps: '1. On active report view, click "Export to CSV" button. 2. Verify file downloads with filename format "sales_summary_YYYY-MM-DD.csv". 3. Open downloaded CSV in Excel or Notepad.',
    expected: 'CSV file opens cleanly without UTF-8 encoding errors or missing headers. Numeric values, dates, and currency amounts format cleanly into separate columns.',
    crossModule: 'None',
    passFail: 'PASS if CSV downloads and matches screen data. FAIL if download blocked or data garbled.',
    evidence: 'Screenshot of downloaded CSV opened in spreadsheet viewer.',
    dependencies: 'TC-REP-001',
    cleanup: 'Delete downloaded test file.',
    notes: 'External accounting export verification.'
  },

  // --- MODULE 19: BACKUPS & EXPORTS ---
  {
    id: 'TC-EXP-001-BKP',
    module: 'System Administration',
    page: 'pages/exports.html',
    feature: 'Data Protection',
    subfeature: 'Full JSON Database Snapshot Extraction',
    title: 'Extract Complete Non-Destructive JSON Database Backup',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Corporate Group (Tenant)',
    preconditions: 'Logged in as Super Admin on pages/exports.html.',
    testData: 'Click "Download Full JSON Backup"',
    steps: '1. Open pages/exports.html. 2. Click "Download Full JSON Backup" button. 3. Observe browser download dialog. 4. Open downloaded JSON file in text editor.',
    expected: 'Complete database snapshot file (e.g. "erp_backup_2026-10-16.json") downloads cleanly. File contains valid JSON structure with tables: companies, warehouses, products, inventory_items, stock_batches, orders, roles.',
    crossModule: 'Verify JSON file passes syntax validation (JSON.parse returns true).',
    passFail: 'PASS if valid JSON backup generated containing all tables. FAIL if file empty or corrupted.',
    evidence: 'Screenshot of downloaded JSON file structure in editor.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep backup file as baseline restore snapshot.',
    notes: 'Disaster recovery and safe snapshot extraction.'
  },
  {
    id: 'TC-EXP-002-CSV',
    module: 'System Administration',
    page: 'pages/exports.html',
    feature: 'Table Data Export',
    subfeature: 'Individual Table CSV Extraction',
    title: 'Export Individual Database Tables to Standalone CSV (Inventory, Orders)',
    priority: 'P2',
    role: 'Software Super Admin / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On pages/exports.html.',
    testData: 'Select Table: "inventory_items" and "orders"',
    steps: '1. In "Export Specific Tables" section, locate "Inventory Master" and click "Download CSV". 2. Locate "Sales Orders" and click "Download CSV". 3. Verify both CSV files download.',
    expected: 'Individual CSV files download containing exact table columns and row data with correct headers.',
    crossModule: 'Compare row count in inventory CSV against table on pages/inventory.html.',
    passFail: 'PASS if CSVs download cleanly with exact row data. FAIL if files fail to download.',
    evidence: 'Screenshot of downloaded CSV files in Downloads folder.',
    dependencies: 'TC-EXP-001-BKP',
    cleanup: 'Delete downloaded CSV files.',
    notes: 'Targeted data migration and external reporting exports.'
  },
  {
    id: 'TC-EXP-003-REST',
    module: 'System Administration',
    page: 'pages/exports.html',
    feature: 'Data Recovery',
    subfeature: 'JSON Snapshot Restore Validation',
    title: 'Verify Database Snapshot Restore without Primary Key Collision',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Corporate Group (Tenant)',
    preconditions: 'A valid baseline JSON backup file exists.',
    testData: 'File: erp_backup_baseline.json',
    steps: '1. On pages/exports.html, locate "Restore Database from Snapshot". 2. Choose valid JSON backup file. 3. Click "Validate & Restore Snapshot". 4. Confirm warning prompt. 5. Wait for restore completion toast.',
    expected: 'System validates schema, restores tables cleanly using upsert (ON CONFLICT DO UPDATE), displays success toast "Database restored from snapshot successfully!", and refreshes UI with restored state.',
    crossModule: 'Verify records across inventory, products, and orders match backup snapshot.',
    passFail: 'PASS if restore completes with 100% record integrity. FAIL if primary key collisions or errors occur.',
    evidence: 'Screenshot of Restore Success alert banner.',
    dependencies: 'TC-EXP-001-BKP',
    cleanup: 'None',
    notes: 'Verifies disaster recovery pipeline.'
  },

  // --- MODULE 20: ROLES & ACCESS CONTROL (RBAC) ---
  {
    id: 'TC-RBAC-001',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Role Catalog Display',
    subfeature: 'Dark Green #0C3925 Role Avatar Standardization',
    title: 'Inspect Standard System Roles Catalog & Dark Green #0C3925 Role Avatars',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in as Super Admin on pages/user-roles.html.',
    testData: 'Inspect: All 10 System Role letter/avatar boxes',
    steps: '1. Open pages/user-roles.html. 2. Click "System Roles" tab. 3. Inspect the roles directory table. 4. Verify role letter avatar boxes for Super Admin, Company Owner, Production Manager, QC Officer, Store Manager, etc. 5. Inspect computed background color.',
    expected: 'Every role letter/avatar box consistently displays the primary dark green background color "#0C3925" with white bold typography. No blue, orange, or purple legacy avatar boxes remain.',
    crossModule: 'Inspect computed CSS style: background-color is rgb(12, 57, 37) / #0C3925.',
    passFail: 'PASS if 100% of role letter boxes render #0C3925. FAIL if multi-color variance exists.',
    evidence: 'Screenshot of System Roles catalog showing uniform dark green avatar boxes.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'Verifies Issue 2 avatar styling standardization.'
  },
  {
    id: 'TC-RBAC-002',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Custom Role Creation',
    subfeature: 'Create Enterprise Custom Role',
    title: 'Create Custom Enterprise Role with Scoped Functional Domain',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On pages/user-roles.html as Super Admin.',
    testData: 'Role Name: Field Trials Agronomist | Code: field_agronomist (auto-slugged) | Domain: Field crop efficacy trials & farmer verification | Scope: Field & Operations | Access: Operational Access',
    steps: '1. Click "Create Role" button. 2. Enter Role Name "Field Trials Agronomist". 3. Observe Role Code auto-slugs to "field_agronomist". 4. Enter Domain "Field crop efficacy trials & farmer verification". 5. Set Access Scope to "Field & Operations". 6. Click "Create Role".',
    expected: 'Success toast "Custom role created successfully!" displays. New role appears in System Roles catalog with Dark Green "#0C3925" avatar "FA", role code "field_agronomist", and Custom badge. Role counter increments.',
    crossModule: 'Open "Assign Role" modal: verify "Field Trials Agronomist" appears in Assigned Role dropdown.',
    passFail: 'PASS if custom role created and selectable in user assignment dropdowns. FAIL if code collision or save fails.',
    evidence: 'Screenshot of System Roles table displaying the new custom role.',
    dependencies: 'TC-RBAC-001',
    cleanup: 'Keep for safe deletion test.',
    notes: 'Verifies custom RBAC role onboarding.'
  },
  {
    id: 'TC-RBAC-003',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'User Role Assignment',
    subfeature: 'Multi-Scope User Assignment',
    title: 'Assign User to Role with Company, Branch & Warehouse Scope Limits',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On "User Assignments" tab of pages/user-roles.html.',
    testData: 'Email: trial_officer@anjani.test | Full Name: Nitinbhai Vaghani | Role: Field Trials Agronomist | Company: Anjani Agri Care | Branch: Main Plant HO | Warehouse: All Warehouses',
    steps: '1. Click "Assign User Role" button. 2. Enter User Email "trial_officer@anjani.test". 3. Enter Full Name "Nitinbhai Vaghani". 4. Select Assigned Role "Field Trials Agronomist". 5. Select Authorized Company "Anjani Agri Care". 6. Select Branch "Main Plant HO". 7. Select Warehouse "All Warehouses". 8. Click "Save Assignment".',
    expected: 'Toast "User role assignment saved successfully!" displays. User appears in Active User Assignments table with Active badge, avatar, and explicit company/branch scopes. Active users counter increments.',
    crossModule: 'Check pages/audit-logs.html: ROLE_ASSIGNMENT_CREATED event logged for trial_officer@anjani.test.',
    passFail: 'PASS if user assignment saved and displayed in table. FAIL if assignment fails to appear or scope dropped.',
    evidence: 'Screenshot of User Assignments table showing new user row.',
    dependencies: 'TC-RBAC-002',
    cleanup: 'Keep user for role edit test.',
    notes: 'Multi-scope user assignment architecture.'
  },
  {
    id: 'TC-RBAC-004',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Assignment Maintenance',
    subfeature: 'Edit User Assignment & Scope Update',
    title: 'Edit Existing User Role Assignment & Scope Promotion',
    priority: 'P2',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'User trial_officer@anjani.test exists in assignments table.',
    testData: 'Promote Role from Field Trials Agronomist to: QC Officer | Warehouse Scope: WH-001',
    steps: '1. On User Assignments table, locate trial_officer@anjani.test. 2. Click the pencil (Edit) icon in row actions. 3. In edit modal, change Assigned Role to "QC Officer". 4. Change Warehouse Scope to "Main Plant RM Store (WH-001)". 5. Click "Save Assignment".',
    expected: 'Toast "User role assignment saved successfully!" displays. Table row immediately updates: role badge updates to "QC Officer" and warehouse scope reflects WH-001.',
    crossModule: 'Inspect localStorage erp_user_roles: assignment object reflects updated role_id.',
    passFail: 'PASS if role promotion and scope updates persist across page reloads. FAIL if edit button non-functional (Issue 3 regression check).',
    evidence: 'Screenshot of edited user assignment row.',
    dependencies: 'TC-RBAC-003',
    cleanup: 'Keep user for revocation test.',
    notes: 'Verifies user role edit modal fix.'
  },
  {
    id: 'TC-RBAC-005',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Safe Role Deletion',
    subfeature: 'Custom Role Deletion Confirmation',
    title: 'Delete Custom Role with Explicit Confirmation Dialog',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Custom role field_agronomist has 0 assigned active users.',
    testData: 'Target Role: Field Trials Agronomist (field_agronomist)',
    steps: '1. On System Roles tab, locate "Field Trials Agronomist". 2. Click the red trash (Delete) icon in row actions. 3. Verify confirmation prompt: "Are you sure you want to delete role Field Trials Agronomist?" 4. Click "OK" / "Confirm".',
    expected: 'Toast "Role deleted successfully!" displays. Role is removed from table and dropdowns. Total System Roles counter decrements by 1.',
    crossModule: 'Check Assign User modal: "Field Trials Agronomist" is no longer selectable in role dropdown.',
    passFail: 'PASS if role deleted cleanly and removed from dropdowns. FAIL if role remains or delete errors.',
    evidence: 'Screenshot of confirmation prompt and updated roles table.',
    dependencies: 'TC-RBAC-002',
    cleanup: 'None',
    notes: 'Verifies safe role deletion implementation.'
  },
  {
    id: 'TC-RBAC-006',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Testing from Scratch',
    subfeature: 'Root Role Deletion & Empty State Handling',
    title: 'Root Super Admin Role Deletion for Fresh Scratch Testing & Empty State',
    priority: 'P1',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Testing scratch environment. Super Admin role displayed in table.',
    testData: 'Target Role: Software Super Admin (super_admin)',
    steps: '1. On System Roles tab, locate "Software Super Admin". 2. Click trash (Delete) icon. 3. Observe explicit warning dialog: "Warning: Software Super Admin is the root governance role. Deleting it will leave 0 configured roles for testing from scratch. Are you sure you want to proceed and permanently delete this role?" 4. Click "OK" / "Confirm".',
    expected: 'Software Super Admin is deleted. Table transitions to dedicated Zero-Role Empty State: "🛡️ No System Roles Configured - All system roles have been removed for fresh testing. You can create custom roles anytime." Counters reflect 0 ("Configured System Roles (0)"). Dropdowns across the application handle 0 available roles without JavaScript null crashes.',
    crossModule: 'Inspect topbar role impersonation dropdown and user-roles dropdowns: shows "(No roles configured)" placeholder option without console crashes.',
    passFail: 'PASS if root role deleted upon confirmation and clean empty state rendered with zero crashes. FAIL if hard-blocked or page crashes.',
    evidence: 'Screenshot of Zero-Role Empty State with Create Role button.',
    dependencies: 'TC-RBAC-001',
    cleanup: 'Create a new custom Super Admin role or re-seed baseline roles to continue operational tests.',
    notes: 'Validates scratch testing autonomy feature.'
  },
  {
    id: 'TC-RBAC-007',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Permission Matrix',
    subfeature: 'Granular Action Privilege Toggles',
    title: 'Permission Matrix: Configure Module Action Toggles (View, Create, Edit, Delete)',
    priority: 'P2',
    role: 'Software Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On "Permission Matrix" tab of pages/user-roles.html.',
    testData: 'Role: Factory Operator | Module: Formulations | Actions: View = Allowed, Create = Blocked, Delete = Blocked',
    steps: '1. Click "Permission Matrix" tab. 2. Select Role "Factory Operator" from role selector dropdown. 3. Locate module "Formulations & Recipe BOM". 4. Verify checkbox states: "Can View" is checked; "Can Create", "Can Edit", "Can Delete" are unchecked. 5. Check "Can Create" and click "Save Permission Matrix".',
    expected: 'Toast "Permissions updated successfully!" displays. Changes persist to role permission matrix. Operator role now authorized to create draft formulation records.',
    crossModule: 'Log in as Factory Operator: verify "New Formulation" button is now visible on pages/formulations.html.',
    passFail: 'PASS if granular action toggles accurately control UI button visibility and execution. FAIL if permissions fail to apply.',
    evidence: 'Screenshot of Permission Matrix table for Factory Operator.',
    dependencies: 'TC-RBAC-001',
    cleanup: 'Uncheck Can Create to restore default security baseline.',
    notes: 'Granular functional action permissioning.'
  },
  {
    id: 'TC-RBAC-008',
    module: 'Roles & Access Control',
    page: 'pages/user-roles.html',
    feature: 'Dual-Custody Approvals',
    subfeature: 'Approval Request Workflow',
    title: 'Dual-Custody Approval Request Workflow for Sensitive Role Changes',
    priority: 'P2',
    role: 'Software Super Admin / Director',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'A pending approval request exists on the "Approval Requests" tab.',
    testData: 'Request: Promote user to Company Owner | Requester: admin@anjani.test',
    steps: '1. Click "Approval Requests" tab on pages/user-roles.html. 2. Inspect pending request row. 3. Click "Approve Request" button in row actions. 4. Enter decision notes: "Authorized by Board Resolution #2026-10-A." 5. Click "Confirm Decision".',
    expected: 'Status badge updates from "Pending" to "Approved" (Green). Target user assignment is activated. Dual-custody audit log is recorded.',
    crossModule: 'Check pages/audit-logs.html: APPROVAL_GRANTED event logged with decision notes.',
    passFail: 'PASS if approval updates status and applies change. FAIL if approval rejected or fails to execute.',
    evidence: 'Screenshot of Approvals table showing approved request.',
    dependencies: 'TC-RBAC-003',
    cleanup: 'None',
    notes: 'Dual-custody separation of duties compliance.'
  },

  // --- MODULE 21: SECURITY & RBAC AUDIT TRAIL ---
  {
    id: 'TC-AUD-001',
    module: 'Audit & Compliance',
    page: 'pages/audit-logs.html',
    feature: 'Security Audit Trail',
    subfeature: 'Immutable Action Logging',
    title: 'Immutable Security Audit Trail Event Logging on Critical Transactions',
    priority: 'P1',
    role: 'Compliance Auditor / Super Admin',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Actions executed across user roles, inventory, and orders.',
    testData: 'Inspect: Recent audit events table',
    steps: '1. Open pages/audit-logs.html. 2. Verify audit table columns: Timestamp, User Email, Action Type, Target Entity, IP/Session Context, Details JSON. 3. Locate recent events: ROLE_CREATED, BATCH_LAUNCHED, ORDER_DISPATCHED.',
    expected: 'Every critical transaction is recorded chronologically with exact timestamp, executing user email, action category, and detailed payload JSON. Logs are append-only and cannot be edited or deleted by operators.',
    crossModule: 'Verify timestamps align with operational transaction execution times.',
    passFail: 'PASS if all critical operations logged with full contextual detail. FAIL if audit logs missing or mutable.',
    evidence: 'Screenshot of audit logs table showing detailed JSON inspection popup.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'Regulatory compliance statutory audit trail.'
  },
  {
    id: 'TC-AUD-002',
    module: 'Audit & Compliance',
    page: 'pages/audit-logs.html',
    feature: 'Audit Investigation',
    subfeature: 'Filter by Action Category & User Email',
    title: 'Filter Audit Trail by Action Category, User Email & Date Range',
    priority: 'P2',
    role: 'Compliance Auditor',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Audit trail contains multiple events from various users.',
    testData: 'User Filter: "admin@anjani.test" | Action Category: "ROLE_DELETED"',
    steps: '1. Select "admin@anjani.test" in user filter dropdown. 2. Select Action "ROLE_DELETED". 3. Observe filtered audit rows.',
    expected: 'Table filters instantaneously to display only role deletion events executed by the administrator, enabling rapid compliance investigations.',
    crossModule: 'None',
    passFail: 'PASS if audit table filters cleanly. FAIL if wrong events shown.',
    evidence: 'Screenshot of filtered audit log view.',
    dependencies: 'TC-AUD-001',
    cleanup: 'Reset filters to All.',
    notes: 'Security incident forensics tool.'
  },

  // --- MODULE 22: USER PROFILE & SESSION ---
  {
    id: 'TC-PROF-001',
    module: 'User Profile',
    page: 'pages/profile.html',
    feature: 'Identity Inspection',
    subfeature: 'Session Metadata & Assigned Role Badge',
    title: 'Inspect Authenticated Operator Profile, Assigned Role & Active Scope',
    priority: 'P3',
    role: 'Any Staff User',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Logged in as Production Manager.',
    testData: 'User: production@anjani.test',
    steps: '1. Click user avatar in topbar right. Select "Profile" (or navigate to pages/profile.html). 2. Inspect profile card: User Name "Dr. Haresh Joshi", Email "production@anjani.test", Role Badge "Production & Plant Manager", Company Scope "Anjani Agri Care".',
    expected: 'Profile card displays accurate user identity, company name "Anjani Agri Care" (reflecting company rename), dark green role badge, and session token creation timestamp.',
    crossModule: 'None',
    passFail: 'PASS if profile reflects current user credentials and company name "Anjani Agri Care". FAIL if legacy pre-rename company name appears.',
    evidence: 'Screenshot of user profile page.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'None',
    notes: 'User identity verification.'
  },
  {
    id: 'TC-PROF-002',
    module: 'User Profile',
    page: 'pages/profile.html',
    feature: 'Security Maintenance',
    subfeature: 'Password Change & Session Update',
    title: 'Change Password Form Validation & Session Token Update',
    priority: 'P2',
    role: 'Any Staff User',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'User on pages/profile.html.',
    testData: 'Current Password: Test@Agro2026! | New Password: NewTest@Agro2027! | Confirm: NewTest@Agro2027!',
    steps: '1. In "Change Password" section, enter Current Password "Test@Agro2026!". 2. Enter New Password "NewTest@Agro2027!". 3. Enter Confirm Password "NewTest@Agro2027!". 4. Click "Update Password".',
    expected: 'Toast "Password updated successfully!" displays. Password updated in database/storage. User can log in with new password.',
    crossModule: 'Log out and log back in: verify new password is authenticated.',
    passFail: 'PASS if password updated and authenticated on next login. FAIL if update fails or mismatch allowed.',
    evidence: 'Screenshot of success toast on profile page.',
    dependencies: 'TC-PROF-001',
    cleanup: 'Reset password back to Test@Agro2026! if desired.',
    notes: 'Account security maintenance.'
  },

  // --- MODULE 23: INVOICE BUILDER ---
  {
    id: 'TC-INVBLD-001',
    module: 'Invoice Builder',
    page: 'Invoice Builder/index.html',
    feature: 'Commercial Invoicing',
    subfeature: 'Tax Invoice Creation & GST Toggles',
    title: 'Create Commercial Tax Invoice with GST / Non-GST Toggles in Invoice Builder',
    priority: 'P1',
    role: 'Sales Executive / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Invoice Builder accessed via topbar button or http://localhost:5174/Invoice%20Builder/index.html.',
    testData: 'Company: Anjani Agri Care | Client: Kisan Agro Agency (Rajkot) | Items: Anjani Chlor-20 EC 500ml (100 units @ ₹280 = ₹28,000) | Tax: GST (18%)',
    steps: '1. Open Invoice Builder/index.html. 2. Verify branding header displays "Anjani Agri Care". 3. Verify Seller/From Company field defaults to "Anjani Agri Care". 4. Select Customer "Kisan Agro Agency". 5. Add Row: Product "Anjani Chlor-20 EC (500ml)", Qty "100", Price "280.00". 6. Verify Subtotal = ₹28,000.00. 7. Select Tax Mode "GST (CGST 9% + SGST 9%)". 8. Verify Tax = ₹5,040.00; Grand Total = ₹33,040.00. 9. Click "Save Invoice".',
    expected: 'Toast "Invoice saved successfully!" displays. Real-time paper preview on right updates immediately showing Anjani Agri Care header, customer details, itemized table, tax breakdown, and total ₹33,040.00.',
    crossModule: 'Check Invoice Builder/history.html: saved invoice appears at top of history archive.',
    passFail: 'PASS if invoice saved and preview rendered accurately. FAIL if calculations wrong or branding incorrect.',
    evidence: 'Screenshot of Invoice Builder paper preview.',
    dependencies: 'TC-AUTH-001',
    cleanup: 'Keep invoice for PDF test.',
    notes: 'Standalone dedicated invoice builder.'
  },
  {
    id: 'TC-INVBLD-002',
    module: 'Invoice Builder',
    page: 'Invoice Builder/index.html',
    feature: 'Live Paper Preview',
    subfeature: 'Real-Time Dynamic Recalculation',
    title: 'Real-Time Paper Invoice Preview Update & Dynamic Tax Recalculation',
    priority: 'P2',
    role: 'Sales Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'On Invoice Builder editor.',
    testData: 'Change Quantity from 100 to 150 | Discount: 5%',
    steps: '1. In item row, change Quantity from "100" to "150". 2. Observe paper preview pane on right. 3. Enter Discount "5%".',
    expected: 'Paper preview pane recalculates instantly without button click: Subtotal: 150 x 280 = ₹42,000; Discount -5% (₹2,100) = ₹39,900; 18% GST = ₹7,182; Grand Total = ₹47,082.00.',
    crossModule: 'None',
    passFail: 'PASS if preview updates keystroke-by-keystroke. FAIL if preview lags or calculation incorrect.',
    evidence: 'Screenshot of live preview updating with discount.',
    dependencies: 'TC-INVBLD-001',
    cleanup: 'None',
    notes: 'Interactive WYSIWYG paper invoice preview.'
  },
  {
    id: 'TC-INVBLD-003',
    module: 'Invoice Builder',
    page: 'Invoice Builder/index.html',
    feature: 'PDF Generation',
    subfeature: 'Client-Side Print-to-PDF Engine',
    title: 'Generate Professional Print-Ready PDF Invoice with Banking & QR Code',
    priority: 'P1',
    role: 'Sales Executive / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'An invoice is open in Invoice Builder.',
    testData: 'Click "Download PDF" / "Print Invoice"',
    steps: '1. In Invoice Builder toolbar, click "Download PDF" button. 2. Observe browser generates and downloads PDF file (e.g. "INV-100-Anjani-Agri-Care.pdf"). 3. Open downloaded PDF.',
    expected: 'PDF renders with high-resolution vector layout: Anjani Agri Care company logo, registered Virva factory address, GSTIN, customer billing address, item table with borders, CGST/SGST breakdown, total in words, bank account coordinates, authorized signatory block, and dynamic UPI QR code.',
    crossModule: 'Verify PDF generated client-side via js/invoice-pdf.js without server latency.',
    passFail: 'PASS if professional PDF downloads cleanly matching preview. FAIL if PDF blank, clipped, or corrupted.',
    evidence: 'Screenshot of opened PDF document.',
    dependencies: 'TC-INVBLD-001',
    cleanup: 'Delete downloaded test PDF.',
    notes: 'Client-facing commercial invoice output.'
  },
  {
    id: 'TC-INVBLD-004',
    module: 'Invoice Builder',
    page: 'Invoice Builder/master.html',
    feature: 'Master Data Hub',
    subfeature: 'Invoice Master Customers & Items',
    title: 'Invoice Builder Customer & Product Master Data Synchronization',
    priority: 'P2',
    role: 'Sales Executive',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Open Invoice Builder/master.html.',
    testData: 'Search master records: "Kisan Agro"',
    steps: '1. Navigate to Invoice Builder/master.html. 2. Verify branding displays "Anjani Agri Care". 3. Inspect Clients tab and Products tab. 4. Search "Kisan Agro".',
    expected: 'Master tables display synced customer and product records. Selecting a master customer auto-populates billing address, GSTIN, and state code in invoice builder.',
    crossModule: 'Cross-reference with pages/clients.html records.',
    passFail: 'PASS if master records synced and searchable. FAIL if records blank or mismatched.',
    evidence: 'Screenshot of Invoice Builder master data page.',
    dependencies: 'TC-INVBLD-001',
    cleanup: 'None',
    notes: 'Master data synchronization between ERP and invoice engine.'
  },
  {
    id: 'TC-INVBLD-005',
    module: 'Invoice Builder',
    page: 'Invoice Builder/history.html',
    feature: 'Invoice Archive',
    subfeature: 'Recall, Re-Print & Edit Past Invoices',
    title: 'Invoice History Archive: Search, Recall, Edit & Re-Print Saved Invoices',
    priority: 'P2',
    role: 'Commercial Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Invoices have been saved in Invoice Builder.',
    testData: 'Search: "Kisan Agro" or Invoice Number',
    steps: '1. Open Invoice Builder/history.html. 2. Verify list of saved historical invoices. 3. Enter invoice number in search bar. 4. Click "View / Edit" on invoice row. 5. Verify invoice reloads into editor with exact items, prices, and totals.',
    expected: 'History archive accurately retrieves past invoices. Clicking Edit reloads full state into editor for reprint or revision.',
    crossModule: 'None',
    passFail: 'PASS if past invoices recallable and printable. FAIL if history fails to load.',
    evidence: 'Screenshot of Invoice History archive table.',
    dependencies: 'TC-INVBLD-001',
    cleanup: 'None',
    notes: 'Statutory invoice re-printing and customer copy retrieval.'
  },

  // --- MODULE 24: CONNECTED END-TO-END WORKFLOWS ---
  {
    id: 'TC-E2E-WFA',
    module: 'End-to-End Workflows',
    page: 'Full ERP Pipeline',
    feature: 'Workflow A: Lifecycle',
    subfeature: 'Procurement to Production to Sales & Invoice',
    title: 'Full Agrochemical Lifecycle: Purchase GRN -> Synthesis -> QC -> Packaging -> Sales -> Dispatch -> Invoice -> Sales Report',
    priority: 'P1',
    role: 'Multi-Role Team (Store, Production, QC, Sales, Accounts)',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Clean test dataset loaded. Starting raw material and packaging inventory verified.',
    testData: 'Purchase: 500 KG Chlorpyrifos Tech | Batch: 1,000L Anjani Chlor-20 EC | Pack: 180 Boxes (500ml) | Order: 50 Boxes to Kisan Agro Agency',
    steps: '1. (Purchases) Record GRN for 500 KG Chlorpyrifos Tech from Gujarat Chemicals -> Verify WH-001 stock increments. 2. (Production) Launch 1,000L batch BAT-WFA-01 -> Verify raw chemicals deducted from WH-001. 3. (QC) Perform chemical assay and Approve batch -> Verify batch released. 4. (Packaging) Pack 180 boxes (1,800 bottles) -> Verify bottles, caps, labels deducted and FG stock in WH-002 credited. 5. (Orders) Book sales order SO-WFA-01 for 50 boxes to Kisan Agro -> Verify order approved. 6. (Dispatch) Godown verification: dispatch 50 boxes with vehicle number -> Verify WH-002 stock decrements by exactly 50 boxes. 7. (Invoice) Generate tax invoice -> Verify GST amounts. 8. (Reports) Generate Customer Sales Report -> Verify SO-WFA-01 reflected in revenue.',
    expected: 'Entire 8-step agrochemical business cycle executes seamlessly across all modules with zero mathematical discrepancies, zero duplicate deductions, and complete audit trail.',
    crossModule: 'Verify complete reconciliation across pages/inventory.html, pages/production.html, pages/orders.html, pages/reports.html, and pages/audit-logs.html.',
    passFail: 'PASS if all 8 stages execute and balance to the last decimal. FAIL if any stage breaks or stock drifts.',
    evidence: 'Complete workflow verification log and screenshots of each milestone.',
    dependencies: 'TC-PURCH-001, TC-MFG-001, TC-ORD-001, TC-REP-001',
    cleanup: 'Keep records for historical testing.',
    notes: 'Primary end-to-end commercial validation suite.'
  },
  {
    id: 'TC-E2E-WFB',
    module: 'End-to-End Workflows',
    page: 'Full ERP Pipeline',
    feature: 'Workflow B: Intercompany',
    subfeature: 'Manufacturer to Subsidiary Supply Chain',
    title: 'Intercompany Supply Chain: Manufacturer ACC Transfer to Company A Retail Depot with In-Transit Reconciliation',
    priority: 'P1',
    role: 'Super Admin / Store Managers',
    company: 'Anjani Agri Care (Co 1) -> Company A (Co 2)',
    preconditions: 'Intercompany link authorized between ACC and Company A.',
    testData: 'Transfer: 30 Boxes Anjani Chlor-20 EC 500ml (300 bottles) | Source: ACC WH-002 | Destination: Company A WH-COA-01',
    steps: '1. (ACC Context) Initiate intercompany transfer of 30 boxes to Company A -> Verify 30 boxes deducted from ACC WH-002. 2. Verify goods marked In-Transit; Company A stock NOT yet added. 3. (Switch to Company A Context) Open pages/intercompany.html under Company A. 4. Accept inbound shipment -> Verify 30 boxes credited to WH-COA-01. 5. Under Company A context, create customer sales order to retail farmer for 5 boxes from WH-COA-01 -> Verify Company A stock decrements to 25 boxes. 6. Verify parent company ACC inventory remains unaffected by Company A retail sales.',
    expected: 'Intercompany transfer executes cleanly with in-transit isolation. Recipient subsidiary sells goods independently without affecting parent company inventory or financial ledgers.',
    crossModule: 'Verify multi-company isolation across both company contexts.',
    passFail: 'PASS if supply chain transfer reconciles across both entities. FAIL if stock leaks across corporate boundaries.',
    evidence: 'Screenshots of transfer dispatch slip, acceptance receipt, and both company stock ledgers.',
    dependencies: 'TC-INCO-001, TC-INCO-002, TC-INCO-003',
    cleanup: 'Switch back to Anjani Agri Care.',
    notes: 'Multi-tier distribution network validation.'
  },
  {
    id: 'TC-E2E-WFC',
    module: 'End-to-End Workflows',
    page: 'Full ERP Pipeline',
    feature: 'Workflow C: Partial & Reversal',
    subfeature: 'Partial Delivery, Split Challans & Order Cancellation',
    title: 'Partial Dispatch, Multi-Stage Fulfillment, Order Cancellation & Anti-Double Deduction Reversal',
    priority: 'P1',
    role: 'Sales Executive / Godown Operator / Accountant',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Customer order SO-WFC-01 booked for 20 boxes.',
    testData: 'Stage 1: Dispatch 8 Boxes | Stage 2: Dispatch 7 Boxes (5 Pending) | Stage 3: Cancel Remaining 5 Boxes',
    steps: '1. Book order SO-WFC-01 for 20 boxes. 2. Dispatch Stage 1: Issue Challan for 8 boxes -> Verify WH-002 stock -8 boxes; remaining = 12 boxes. 3. Dispatch Stage 2: Issue Challan for 7 boxes -> Verify WH-002 stock -7 boxes (Total -15 boxes); remaining = 5 boxes. 4. Customer requests cancellation of remaining 5 boxes. 5. Process partial cancellation for un-dispatched balance. 6. Verify final invoice is issued for exactly 15 dispatched boxes (not 20). 7. Verify warehouse stock does not double-deduct.',
    expected: 'Split-challan dispatches track remaining balance accurately. Invoicing charges strictly for physical goods dispatched. Warehouse stock deduction equals exactly 15 boxes.',
    crossModule: 'Check invoice total: 15 boxes x price + tax. Check inventory ledger: exactly 15 boxes deducted.',
    passFail: 'PASS if partial fulfillment and cancellation balance perfectly. FAIL if customer billed for 20 boxes or stock deducted twice.',
    evidence: 'Screenshots of split dispatch challans and final partial invoice.',
    dependencies: 'TC-ORD-003, TC-ORD-004',
    cleanup: 'None',
    notes: 'Validates partial fulfillment idempotency.'
  },
  {
    id: 'TC-E2E-WFD',
    module: 'End-to-End Workflows',
    page: 'Full ERP Pipeline',
    feature: 'Workflow D: Returns & Adjustments',
    subfeature: 'Customer Returns & Quarantine Restocking',
    title: 'Customer Rejection / Defect Return & Restocking Adjustment Workflow',
    priority: 'P2',
    role: 'Sales Executive / QC Officer / Store Manager',
    company: 'Anjani Agri Care - TEST (ACC)',
    preconditions: 'Customer Kisan Agro Agency received 10 boxes; reports 1 box damaged in transport.',
    testData: 'Return Qty: 1 Box (10 bottles) | Credit Note Amount: ₹2,800 + 18% GST (₹504) = ₹3,304 | Quarantine Warehouse: Sector C',
    steps: '1. On pages/orders.html, locate order and initiate "Sales Return / Credit Note". 2. Enter Returned Qty: 1 Box. 3. Select Reason "Transport damage / broken seal". 4. Issue Credit Note CN-2026-001 for ₹3,304. 5. Stock Inward Engine prompts destination: select "Quarantine Storage (Damaged Goods)". 6. QC Officer inspects returned goods and marks for repackaging or chemical recovery. 7. Verify customer outstanding balance is credited by ₹3,304.',
    expected: 'Customer account credited by ₹3,304 via official credit note. Returned goods placed into quarantine inventory (NOT mixed into saleable prime inventory). QC inspection record generated.',
    crossModule: 'Check pages/clients.html: customer balance credited. Check pages/inventory.html: damaged goods isolated from saleable stock.',
    passFail: 'PASS if credit note issued, customer credited, and damaged stock isolated. FAIL if damaged stock returned to prime saleable stock.',
    evidence: 'Screenshot of Credit Note and Quarantine stock ledger.',
    dependencies: 'TC-ORD-004, TC-FIN-001',
    cleanup: 'None',
    notes: 'Agrochemical commercial returns & damaged goods segregation.'
  },
  {
    id: 'TC-E2E-WFE',
    module: 'End-to-End Workflows',
    page: 'Full ERP Pipeline',
    feature: 'Workflow E: Security & Isolation',
    subfeature: 'RBAC Enforcement & Multi-Tenant Boundary',
    title: 'Multi-Company RBAC Isolation, User Impersonation & Direct API Tamper Resistance',
    priority: 'P1',
    role: 'Security Tester / Compliance Auditor',
    company: 'All Companies (Cross-Entity Audit)',
    preconditions: 'Users logged in under different role personas.',
    testData: 'Attacker persona: retail_owner@compb.test (Company B) attempting to access Company 1 records',
    steps: '1. Log in as retail_owner@compb.test. 2. Verify UI elements for manufacturing, formulations, and raw chemical purchases are hidden/blocked according to role. 3. Open browser DevTools (F12 -> Console). 4. Attempt to execute direct JavaScript database query: window.dbClient.from("orders").select("*").eq("company_id", 1). 5. Attempt to invoke window.TENANT_CONTEXT.switchCompany(1).',
    expected: 'Security engine intercepts unauthorized switch attempt: "Security Error: Unauthorized company switch attempt to ID 1." Client-side authorization guard rejects switch. RLS/Server filters prevent unauthorized data extraction. Immutable security alert logged in audit trail.',
    crossModule: 'Check pages/audit-logs.html: UNAUTHORIZED_ACCESS_ATTEMPT logged with user email and IP.',
    passFail: 'PASS if unauthorized access strictly rejected and logged. FAIL if user can view parent company records.',
    evidence: 'Screenshot of console showing security error rejecting unauthorized tenant switch.',
    dependencies: 'TC-COMP-003, TC-RBAC-001',
    cleanup: 'Log back in as Super Admin.',
    notes: 'Penetration testing & enterprise multi-tenant boundary audit.'
  }
];

console.log(`Loaded ${testCases.length} authoritative test cases.`);

// ==============================================================================
// 1. GENERATE ERP_TEST_CASES.csv
// ==============================================================================
function generateCSV(testCases) {
  const headers = [
    'Test Case ID',
    'Module',
    'Page',
    'Feature',
    'Subfeature',
    'Scenario',
    'Priority',
    'Preconditions',
    'User Role',
    'Company Context',
    'Test Data',
    'Steps',
    'Expected Result',
    'Actual Result',
    'Status',
    'Evidence Reference',
    'Bug ID',
    'Dependencies',
    'Notes'
  ];

  function escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows = [headers.map(escapeCSV).join(',')];

  testCases.forEach(tc => {
    const row = [
      escapeCSV(tc.id),
      escapeCSV(tc.module),
      escapeCSV(tc.page),
      escapeCSV(tc.feature),
      escapeCSV(tc.subfeature),
      escapeCSV(tc.title),
      escapeCSV(tc.priority),
      escapeCSV(tc.preconditions),
      escapeCSV(tc.role),
      escapeCSV(tc.company),
      escapeCSV(tc.testData),
      escapeCSV(tc.steps),
      escapeCSV(tc.expected),
      escapeCSV(''), // Actual Result (blank for testing execution)
      escapeCSV('Not Run'), // Initial status
      escapeCSV(''), // Evidence Reference
      escapeCSV(''), // Bug ID
      escapeCSV(tc.dependencies),
      escapeCSV(tc.notes)
    ];
    rows.push(row.join(','));
  });

  return rows.join('\r\n');
}

// ==============================================================================
// 2. GENERATE ERP_COMPLETE_TESTING_HANDBOOK.md
// ==============================================================================
function generateHandbook(testCases) {
  let md = `# Agrochemical Manufacturing ERP — Complete Master Testing Handbook & Quality Assurance System

> [!IMPORTANT]
> **Authoritative Operational Manual:** This comprehensive testing handbook is designed specifically for business owners, plant directors, quality assurance personnel, and commercial accountants. Every test case provides exact click-by-click instructions, concrete test values, chemical unit conversions, expected results, cross-module ledger verifications, and objective pass/fail criteria.
> **Current Application Branding:** **Anjani Agri Care** (ACC) — Central Agrochemical Manufacturing Legal Entity.

---

## TABLE OF CONTENTS

1. [Introduction & Manual Testing Framework for Non-Developers](#1-introduction--manual-testing-framework-for-non-developers)
2. [Test Environment Setup, Baseline Safety & Role Personas](#2-test-environment-setup-baseline-safety--role-personas)
3. [The 8-Stage Test Execution Plan](#3-the-8-stage-test-execution-plan)
4. [Module-by-Module & Page-by-Page Testing Manual](#4-module-by-module--page-by-page-testing-manual)
   * [Module 1: Authentication & Session Management (\`login.html\`, \`index.html\`)](#module-1-authentication--session-management)
   * [Module 2: Executive Dashboard & Topbar Controls (\`pages/dashboard.html\`)](#module-2-executive-dashboard--topbar-controls)
   * [Module 3: Product Masters & Packaging SKU Configurations (\`pages/products.html\`)](#module-3-product-masters--packaging-sku-configurations)
   * [Module 4: Raw Materials, Packaging Stock & Batch Tracking (\`pages/inventory.html\`)](#module-4-raw-materials-packaging-stock--batch-tracking)
   * [Module 5: Customer, Dealer & Farmer Network Master (\`pages/clients.html\`)](#module-5-customer-dealer--farmer-network-master)
   * [Module 6: Vendor & Technical Material Suppliers (\`pages/suppliers.html\`)](#module-6-vendor--technical-material-suppliers)
   * [Module 7: Procurement, Material Inward & GRN Receipts (\`pages/purchases.html\`)](#module-7-procurement-material-inward--grn-receipts)
   * [Module 8: Formulations & Recipe Bill of Materials (\`pages/formulations.html\`)](#module-8-formulations--recipe-bill-of-materials)
   * [Module 9: Manufacturing Runs, QC Quarantine & Finished Goods Packaging (\`pages/production.html\`)](#module-9-manufacturing-runs-qc-quarantine--finished-goods-packaging)
   * [Module 10: Shop-Floor Material Usage & Daily Consumption (\`pages/daily-transactions.html\`)](#module-10-shop-floor-material-usage--daily-consumption)
   * [Module 11: Technical Batch Calculation & Formulation Dilution Tools (\`pages/batch-calculator.html\`, \`pages/calculator.html\`)](#module-11-technical-batch-calculation--formulation-dilution-tools)
   * [Module 12: Sales Orders, Godown Verification & Dispatches (\`pages/orders.html\`)](#module-12-sales-orders-godown-verification--dispatches)
   * [Module 13: Enterprise Multi-Company & Branch Management (\`pages/companies.html\`)](#module-13-enterprise-multi-company--branch-management)
   * [Module 14: Central Warehouses & Storage Depots (\`pages/warehouses.html\`)](#module-14-central-warehouses--storage-depots)
   * [Module 15: Intercompany Supply Chains & Transfer Reconciliation (\`pages/intercompany.html\`)](#module-15-intercompany-supply-chains--transfer-reconciliation)
   * [Module 16: Commercial Cash & Bank Ledger (\`pages/transactions.html\`)](#module-16-commercial-cash--bank-ledger)
   * [Module 17: Operational Expenses & Overhead Allocation (\`pages/expenses.html\`)](#module-17-operational-expenses--overhead-allocation)
   * [Module 18: Commercial Tax Invoicing, GSTR & Customer Sales Reports (\`pages/reports.html\`)](#module-18-commercial-tax-invoicing-gstr--customer-sales-reports)
   * [Module 19: System Backups, Schema Snapshots & Data Exports (\`pages/exports.html\`)](#module-19-system-backups-schema-snapshots--data-exports)
   * [Module 20: Granular Roles, Permissions Matrix & Approvals (\`pages/user-roles.html\`)](#module-20-granular-roles-permissions-matrix--approvals)
   * [Module 21: Security & RBAC Immutable Audit Trail (\`pages/audit-logs.html\`)](#module-21-security--rbac-immutable-audit-trail)
   * [Module 22: Operator Profile & Session Authentication (\`pages/profile.html\`)](#module-22-operator-profile--session-authentication)
   * [Module 23: Independent Invoice Builder & PDF Tax Invoicing (\`Invoice Builder/\`)](#module-23-independent-invoice-builder--pdf-tax-invoicing)
5. [Connected End-to-End Business Workflows](#5-connected-end-to-end-business-workflows)
   * [Workflow A: Raw Materials to Production to Customer Dispatch & Sales Report](#workflow-a-raw-materials-to-production-to-customer-dispatch--sales-report)
   * [Workflow B: Anjani Supplies Another Company (Intercompany Transfer & Reconciliation)](#workflow-b-anjani-supplies-another-company-intercompany-transfer--reconciliation)
   * [Workflow C: Partial Dispatch, Split Challans & Order Cancellation](#workflow-c-partial-dispatch-split-challans--order-cancellation)
   * [Workflow D: Customer Returns, Damaged Goods & Restocking Adjustments](#workflow-d-customer-returns-damaged-goods--restocking-adjustments)
   * [Workflow E: Role Permissions, Multi-Company Isolation & Tamper Resistance](#workflow-e-role-permissions-multi-company-isolation--tamper-resistance)
6. [Comprehensive Feature Coverage & Traceability Matrix](#6-comprehensive-feature-coverage--traceability-matrix)

---

## 1. Introduction & Manual Testing Framework for Non-Developers

### 1.1 Purpose of this Handbook
This testing handbook provides a systematic, code-verified testing manual allowing business owners, plant operators, and QA auditors to thoroughly validate every page, form, button, calculation, inventory movement, and permission check in the ERP before operational go-live or commercial deployment.

### 1.2 How to Execute Tests
Every test case in this handbook follows a standardized structure:
1. **Locate the Test Case:** Look up the unique Test Case ID (e.g. \`TC-PROD-001\`, \`TC-MFG-005\`).
2. **Review Preconditions:** Confirm that the required records (e.g. products, materials, customers) exist in the test environment before starting.
3. **Assume the Required Persona:** Check the **Required User Role** and log in as that user, or use the role switcher to set the appropriate permission context.
4. **Follow Numbered Steps:** Execute the exact numbered actions step-by-step. Enter the concrete values provided; do not guess or use placeholder text.
5. **Verify the Expected Result:** Confirm that the on-screen alert, record insertion, and button transitions match the documented result.
6. **Inspect Cross-Module Impact:** Check secondary ledgers (e.g. verify that booking a dispatch on \`pages/orders.html\` decremented physical stock on \`pages/inventory.html\`).
7. **Record Result in \`ERP_TEST_CASES.csv\`:** Mark the test as \`Pass\` or \`Fail\`. If it fails, capture evidence and log a ticket using \`ERP_BUG_REPORT_TEMPLATE.md\`.

### 1.3 How to Capture Evidence
* **Screenshots:** Press \`Windows Key + Shift + S\` to capture the relevant screen area, showing the record, toast alert, and topbar. Save the image in \`tests/scratch/\`.
* **Browser Developer Console (F12):** If an action fails or a button does nothing, press \`F12\` on your keyboard, click the **Console** tab, and copy any red error text.
* **Network Failures:** In DevTools, click the **Network** tab to see if a red \`400\`, \`403\`, or \`500\` error occurred.

---

## 2. Test Environment Setup, Baseline Safety & Role Personas

### 2.1 Environmental Rules
* **Development Server URL:** \`http://localhost:5174\`
* **Master Test Dataset Guide:** Refer to \`ERP_TEST_DATA_SETUP.md\` for the complete list of test products, raw materials, formulations, customer accounts, and opening stock balances.
* **Safety Mandate:** Never run destructive database commands (\`DROP\`, \`TRUNCATE\`) against live business databases. Always maintain a restorable snapshot via \`pages/exports.html\`.

### 2.2 Standard Testing Personas

| Role Persona | Test Email | Default Password | Primary Authorization Scope |
| :--- | :--- | :--- | :--- |
| **Software Super Admin** | \`admin@anjani.test\` | \`Test@Agro2026!\` | Global (Full system configuration, role editing, audit logs) |
| **Company Owner / Director** | \`owner@anjani.test\` | \`Test@Agro2026!\` | Legal Entity Scope (Financial ledgers, executive approvals) |
| **Production Manager** | \`production@anjani.test\` | \`Test@Agro2026!\` | Plant Scope (Formulations, manufacturing batches, BOM) |
| **Warehouse & Store Manager** | \`store@anjani.test\` | \`Test@Agro2026!\` | Warehouse Scope (Goods receipt GRN, physical stock balance) |
| **QC Officer** | \`qc@anjani.test\` | \`Test@Agro2026!\` | Quality Scope (Specific gravity, assay analysis, batch release) |
| **Sales & Dispatch Executive** | \`sales@anjani.test\` | \`Test@Agro2026!\` | Commercial Scope (Customer orders, dispatch challans, invoices) |
| **Commercial Accountant** | \`accounts@anjani.test\` | \`Test@Agro2026!\` | Finance Scope (Cash & bank ledger, expense booking, GSTR) |
| **Compliance Auditor** | \`auditor@anjani.test\` | \`Test@Agro2026!\` | Read-Only Scope (Statutory review of ledgers and audit trails) |
| **Retail Subsidiary Owner** | \`retail_owner@compb.test\` | \`Test@Agro2026!\` | Company B Scope (Used to verify multi-company isolation) |

---

## 3. The 8-Stage Test Execution Plan

Organize manual testing into logical sequential stages. If a critical failure occurs in an early stage (e.g. Stage 1 or Stage 3), resolve it before proceeding to subsequent stages:

\`\`\`mermaid
flowchart TD
    S1["Stage 1: System Health, Auth & Navigation (TC-AUTH, TC-DASH)"] --> S2["Stage 2: Master Data Catalogs (TC-PROD, TC-INV, TC-CUST, TC-SUP)"]
    S2 --> S3["Stage 3: Procurement & Formulation BOM (TC-PURCH, TC-FORM, TC-CALC)"]
    S3 --> S4["Stage 4: Manufacturing, QC & Packaging (TC-MFG, TC-DAILY)"]
    S4 --> S5["Stage 5: Sales Orders, Godown Dispatches & Invoicing (TC-ORD, TC-INVBLD)"]
    S5 --> S6["Stage 6: Enterprise Multi-Company & Intercompany (TC-COMP, TC-WH, TC-INCO)"]
    S6 --> S7["Stage 7: Finance, Expenses, Reports & Audits (TC-FIN, TC-EXP, TC-REP, TC-AUD)"]
    S7 --> S8["Stage 8: End-to-End Workflows & Regression (TC-E2E-WFA to WFE)"]
\`\`\`

* **Stage 1: Application Health & Navigation:** Verify login, sessions, layout rendering, and topbar switchers.
* **Stage 2: Master Data Catalogs:** Verify products, packaging SKUs, chemical inventory, customers, and suppliers.
* **Stage 3: Procurement & Formulations:** Verify raw chemical purchase receipts (GRN), recipe BOMs, and scaling tools.
* **Stage 4: Manufacturing & Quality Control:** Verify production batch launch, QC analysis, batch quarantine release, and packaging runs.
* **Stage 5: Commercial Fulfillment:** Verify customer orders, credit limits, godown verification, dispatch challans, and invoices.
* **Stage 6: Enterprise Multi-Company:** Verify corporate legal entities, warehouses, and intercompany supply chains.
* **Stage 7: Financial Integrity & Auditing:** Verify cash/bank ledgers, expenses, tax reports, backups, and RBAC security logs.
* **Stage 8: End-to-End Regression:** Execute complete cross-module workflows A through E to prove system-wide harmony.

---

## 4. Module-by-Module & Page-by-Page Testing Manual
`;

  // Group test cases by Module
  const modulesMap = {};
  testCases.forEach(tc => {
    if (!modulesMap[tc.module]) modulesMap[tc.module] = [];
    modulesMap[tc.module].push(tc);
  });

  let modIndex = 1;
  for (const [modName, cases] of Object.entries(modulesMap)) {
    if (modName === 'End-to-End Workflows') continue; // Handled in section 5
    const firstCase = cases[0];
    md += `\n### Module ${modIndex}: ${modName}\n`;
    md += `* **Primary Page:** \`${firstCase.page}\`\n`;
    md += `* **Functional Scope:** Covers all independently verifiable controls, forms, tables, modals, calculations, and security guards in this module.\n\n`;

    cases.forEach(tc => {
      md += `#### Test Case: ${tc.id} — ${tc.title}\n\n`;
      md += `| Attribute | Details |\n`;
      md += `| :--- | :--- |\n`;
      md += `| **Test Case ID** | \`${tc.id}\` |\n`;
      md += `| **Module & Page** | ${tc.module} (\`${tc.page}\`) |\n`;
      md += `| **Main Feature** | ${tc.feature} |\n`;
      md += `| **Subfeature** | ${tc.subfeature} |\n`;
      md += `| **Priority** | **${tc.priority}** |\n`;
      md += `| **Required Role** | ${tc.role} |\n`;
      md += `| **Company Scope** | ${tc.company} |\n`;
      md += `| **Dependencies** | ${tc.dependencies} |\n\n`;

      md += `* **Business Objective:** Validate that ${tc.subfeature.toLowerCase()} functions accurately in compliance with agrochemical business requirements.\n`;
      md += `* **Preconditions:** ${tc.preconditions}\n`;
      md += `* **Exact Test Data:**\n  \`\`\`text\n  ${tc.testData}\n  \`\`\`\n\n`;

      md += `* **Step-by-Step Execution Instructions:**\n`;
      const stepLines = tc.steps.split(/(?=\d+\.\s)/).filter(Boolean);
      stepLines.forEach(s => {
        md += `  ${s.trim()}\n`;
      });
      md += `\n`;

      md += `* **Expected Result (Observable Behavior):**\n  ${tc.expected}\n\n`;
      md += `* **Cross-Module Verification:**\n  ${tc.crossModule}\n\n`;
      md += `* **Pass / Fail Acceptance Criteria:**\n  ${tc.passFail}\n\n`;
      md += `* **Evidence to Capture:** ${tc.evidence}\n`;
      md += `* **Cleanup / Reset Procedure:** ${tc.cleanup}\n`;
      md += `* **Technical Notes:** ${tc.notes}\n\n`;
      md += `---\n\n`;
    });

    modIndex++;
  }

  // Section 5: End-to-End Workflows
  md += `## 5. Connected End-to-End Business Workflows\n\n`;
  md += `The following comprehensive workflows test the Agrochemical ERP as a unified, connected operating system. Every step must be executed in sequence:\n\n`;

  const e2eCases = testCases.filter(tc => tc.module === 'End-to-End Workflows');
  e2eCases.forEach(tc => {
    md += `### ${tc.id}: ${tc.title}\n\n`;
    md += `| Attribute | Specification |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Workflow Code** | \`${tc.id}\` |\n`;
    md += `| **Functional Scope** | ${tc.subfeature} |\n`;
    md += `| **Priority** | **${tc.priority}** |\n`;
    md += `| **Executing Personas** | ${tc.role} |\n`;
    md += `| **Target Company** | ${tc.company} |\n`;
    md += `| **Prerequisites** | ${tc.preconditions} |\n\n`;

    md += `#### Scenario Dataset:\n\`\`\`text\n${tc.testData}\n\`\`\`\n\n`;
    md += `#### Detailed Numbered Execution Steps:\n`;
    const stepLines = tc.steps.split(/(?=\d+\.\s)/).filter(Boolean);
    stepLines.forEach(s => {
      md += `* ${s.trim()}\n`;
    });
    md += `\n`;

    md += `#### Expected System-Wide Outcome:\n${tc.expected}\n\n`;
    md += `#### Cross-Module Ledger Reconciliation Checkpoints:\n${tc.crossModule}\n\n`;
    md += `#### Objective Pass/Fail Acceptance Criteria:\n${tc.passFail}\n\n`;
    md += `#### Evidence Required for Sign-Off:\n${tc.evidence}\n\n`;
    md += `#### Technical & Auditing Notes:\n${tc.notes}\n\n`;
    md += `---\n\n`;
  });

  // Section 6: Traceability Matrix
  md += `## 6. Comprehensive Feature Coverage & Traceability Matrix\n\n`;
  md += `The matrix below provides complete traceability between every discovered application module, page, feature, subfeature, and its corresponding test case:\n\n`;
  md += `| Test Case ID | Application Module | Target Page | Main Feature | Verified Subfeature | Priority | Initial Status |\n`;
  md += `| :---: | :--- | :--- | :--- | :--- | :---: | :---: |\n`;

  testCases.forEach(tc => {
    md += `| \`${tc.id}\` | ${tc.module} | \`${tc.page}\` | ${tc.feature} | ${tc.subfeature} | ${tc.priority} | **Not Run** |\n`;
  });

  md += `\n---\n*End of Master Testing Handbook. Synchronized with \`ERP_TEST_CASES.csv\` and \`ERP_TEST_DATA_SETUP.md\`.*\n`;

  return md;
}

// ==============================================================================
// 3. EXECUTE GENERATION & WRITE TO DISK
// ==============================================================================
const csvContent = generateCSV(testCases);
const handbookContent = generateHandbook(testCases);

const targetCsvPath = path.resolve('ERP_TEST_CASES.csv');
const targetHandbookPath = path.resolve('ERP_COMPLETE_TESTING_HANDBOOK.md');

fs.writeFileSync(targetCsvPath, csvContent, 'utf8');
console.log(`✓ Successfully regenerated ${targetCsvPath} (${Buffer.byteLength(csvContent, 'utf8')} bytes)`);

fs.writeFileSync(targetHandbookPath, handbookContent, 'utf8');
console.log(`✓ Successfully regenerated ${targetHandbookPath} (${Buffer.byteLength(handbookContent, 'utf8')} bytes)`);

console.log(`\nVerification Summary:`);
console.log(`- Total Test Cases Generated: ${testCases.length}`);
console.log(`- Handbook Headings Check: ${handbookContent.split('\\n').filter(l => l.startsWith('#### Test Case:')).length} test case sections generated.`);
console.log(`- CSV Rows Check: ${csvContent.split('\\r\\n').length - 1} data rows generated (excluding header).`);
console.log(`- 1-to-1 Parity Confirmed: ${testCases.length === (csvContent.split('\\r\\n').length - 2)}`);

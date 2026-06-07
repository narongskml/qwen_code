-- ============================================================================
-- Financial Portfolio Management System - Database Schema
-- PostgreSQL Database Creation and Tables
-- ============================================================================

-- Create the database
CREATE DATABASE portfolio_db
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Connect to the database
\c portfolio_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Customer types
CREATE TYPE customer_type AS ENUM ('INDIVIDUAL', 'CORPORATE', 'INSTITUTIONAL');

-- Account status
CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED');

-- Trade status
CREATE TYPE trade_status AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'FAILED', 'SETTLED');

-- Order type
CREATE TYPE order_type AS ENUM ('MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LIMIT');

-- Side (Buy/Sell)
CREATE TYPE trade_side AS ENUM ('BUY', 'SELL');

-- Maker-Checker status
CREATE TYPE workflow_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Credit rating grades
CREATE TYPE credit_rating AS ENUM (
    'AAA', 'AA+', 'AA', 'AA-', 
    'A+', 'A', 'A-', 
    'BBB+', 'BBB', 'BBB-', 
    'BB+', 'BB', 'BB-', 
    'B+', 'B', 'B-', 
    'CCC', 'CC', 'C', 'D'
);

-- Instrument type
CREATE TYPE instrument_type AS ENUM (
    'EQUITY', 'BOND', 'MUTUAL_FUND', 'ETF', 
    'DERIVATIVE', 'OPTION', 'FUTURE', 'FOREX', 
    'COMMODITY', 'CRYPTOCURRENCY'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Customers table
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_type customer_type NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    tax_id VARCHAR(50),
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    kyc_status BOOLEAN DEFAULT FALSE,
    kyc_verified_date DATE,
    kyc_verified_by UUID,
    risk_profile VARCHAR(20) DEFAULT 'MEDIUM',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create index on customer_code for faster lookups
CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_email ON customers(email);

-- Portfolios table
CREATE TABLE portfolios (
    portfolio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_code VARCHAR(50) UNIQUE NOT NULL,
    portfolio_name VARCHAR(200) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    base_currency VARCHAR(3) DEFAULT 'USD',
    total_value DECIMAL(18, 2) DEFAULT 0.00,
    cash_balance DECIMAL(18, 2) DEFAULT 0.00,
    inception_date DATE NOT NULL,
    status account_status DEFAULT 'ACTIVE',
    investment_objective TEXT,
    risk_tolerance VARCHAR(20),
    benchmark_id UUID,
    manager_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_portfolios_customer ON portfolios(customer_id);
CREATE INDEX idx_portfolios_code ON portfolios(portfolio_code);

-- Securities (Instrument Master) table
CREATE TABLE securities (
    security_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    instrument_type instrument_type NOT NULL,
    exchange VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    country VARCHAR(100),
    sector VARCHAR(100),
    industry VARCHAR(100),
    issuer VARCHAR(200),
    isin VARCHAR(12),
    cusip VARCHAR(9),
    sedol VARCHAR(7),
    lot_size INTEGER DEFAULT 1,
    tick_size DECIMAL(18, 6),
    maturity_date DATE,
    coupon_rate DECIMAL(8, 4),
    face_value DECIMAL(18, 2),
    current_price DECIMAL(18, 6),
    price_date DATE,
    dividend_yield DECIMAL(8, 4),
    beta DECIMAL(8, 4),
    market_cap DECIMAL(18, 2),
    pe_ratio DECIMAL(8, 2),
    eps DECIMAL(18, 4),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_securities_symbol_exchange ON securities(symbol, exchange);
CREATE INDEX idx_securities_isin ON securities(isin);
CREATE INDEX idx_securities_type ON securities(instrument_type);

-- Portfolio Holdings table
CREATE TABLE portfolio_holdings (
    holding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    security_id UUID NOT NULL REFERENCES securities(security_id),
    quantity DECIMAL(18, 6) NOT NULL DEFAULT 0,
    average_cost DECIMAL(18, 6) NOT NULL DEFAULT 0,
    current_price DECIMAL(18, 6),
    market_value DECIMAL(18, 2),
    unrealized_pnl DECIMAL(18, 2),
    unrealized_pnl_percent DECIMAL(8, 4),
    weight_percent DECIMAL(8, 4),
    cost_basis DECIMAL(18, 2),
    last_valuation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, security_id)
);

CREATE INDEX idx_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX idx_holdings_security ON portfolio_holdings(security_id);

-- Brokers table
CREATE TABLE brokers (
    broker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_code VARCHAR(50) UNIQUE NOT NULL,
    broker_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    commission_rate DECIMAL(8, 4),
    settlement_days INTEGER DEFAULT 2,
    trading_accounts JSONB,
    status account_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_brokers_code ON brokers(broker_code);

-- Trades table
CREATE TABLE trades (
    trade_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_reference VARCHAR(50) UNIQUE NOT NULL,
    portfolio_id UUID NOT NULL REFERENCES portfolios(portfolio_id),
    security_id UUID NOT NULL REFERENCES securities(security_id),
    broker_id UUID REFERENCES brokers(broker_id),
    trade_date DATE NOT NULL,
    settlement_date DATE,
    trade_side trade_side NOT NULL,
    order_type order_type NOT NULL,
    quantity DECIMAL(18, 6) NOT NULL,
    price DECIMAL(18, 6) NOT NULL,
    executed_price DECIMAL(18, 6),
    executed_quantity DECIMAL(18, 6),
    gross_amount DECIMAL(18, 2),
    commission DECIMAL(18, 2),
    taxes DECIMAL(18, 2),
    net_amount DECIMAL(18, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    status trade_status DEFAULT 'PENDING',
    execution_timestamp TIMESTAMP WITH TIME ZONE,
    settlement_status VARCHAR(20) DEFAULT 'PENDING',
    counterparty VARCHAR(200),
    trade_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_trades_portfolio ON trades(portfolio_id);
CREATE INDEX idx_trades_security ON trades(security_id);
CREATE INDEX idx_trades_date ON trades(trade_date);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_reference ON trades(trade_reference);

-- ============================================================================
-- CREDIT RATING MODULE
-- ============================================================================

-- Credit Ratings table
CREATE TABLE credit_ratings (
    rating_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    rating_agency VARCHAR(100),
    internal_rating credit_rating,
    external_rating credit_rating,
    rating_date DATE NOT NULL DEFAULT CURRENT_DATE,
    previous_rating credit_rating,
    rating_outlook VARCHAR(20),
    score_numeric DECIMAL(5, 2),
    probability_of_default DECIMAL(8, 6),
    loss_given_default DECIMAL(8, 6),
    exposure_at_default DECIMAL(18, 2),
    credit_limit DECIMAL(18, 2),
    utilized_credit DECIMAL(18, 2),
    available_credit DECIMAL(18, 2),
    risk_exposure DECIMAL(18, 2),
    assessment_notes TEXT,
    reviewed_by UUID,
    approved_by UUID,
    next_review_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_ratings_customer ON credit_ratings(customer_id);
CREATE INDEX idx_credit_ratings_date ON credit_ratings(rating_date);

-- ============================================================================
-- BENCHMARK MANAGEMENT
-- ============================================================================

-- Benchmarks table
CREATE TABLE benchmarks (
    benchmark_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    benchmark_code VARCHAR(50) UNIQUE NOT NULL,
    benchmark_name VARCHAR(200) NOT NULL,
    description TEXT,
    benchmark_type VARCHAR(50),
    currency VARCHAR(3) DEFAULT 'USD',
    provider VARCHAR(100),
    inception_date DATE,
    total_return DECIMAL(18, 6),
    ytd_return DECIMAL(8, 4),
    one_year_return DECIMAL(8, 4),
    three_year_return DECIMAL(8, 4),
    five_year_return DECIMAL(8, 4),
    volatility DECIMAL(8, 4),
    sharpe_ratio DECIMAL(8, 4),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_benchmarks_code ON benchmarks(benchmark_code);

-- Benchmark constituents
CREATE TABLE benchmark_constituents (
    constituent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    benchmark_id UUID NOT NULL REFERENCES benchmarks(benchmark_id) ON DELETE CASCADE,
    security_id UUID NOT NULL REFERENCES securities(security_id),
    weight_percent DECIMAL(8, 4) NOT NULL,
    shares DECIMAL(18, 6),
    rebalance_date DATE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(benchmark_id, security_id, effective_from)
);

CREATE INDEX idx_benchmark_constituents_benchmark ON benchmark_constituents(benchmark_id);

-- ============================================================================
-- MAKER-CHECKER WORKFLOW (4-EYES PRINCIPLE)
-- ============================================================================

-- Workflow approvals table
CREATE TABLE workflow_approvals (
    approval_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'TRADE', 'CUSTOMER', 'PORTFOLIO'
    entity_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE'
    workflow_status workflow_status DEFAULT 'PENDING_APPROVAL',
    maker_id UUID NOT NULL,
    maker_action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checker_id UUID,
    checker_action_timestamp TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    approval_comments TEXT,
    original_data JSONB,
    proposed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_entity ON workflow_approvals(entity_type, entity_id);
CREATE INDEX idx_workflow_status ON workflow_approvals(workflow_status);
CREATE INDEX idx_workflow_maker ON workflow_approvals(maker_id);
CREATE INDEX idx_workflow_checker ON workflow_approvals(checker_id);

-- ============================================================================
-- REPORTING MODULE
-- ============================================================================

-- Report templates table
CREATE TABLE report_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    description TEXT,
    report_type VARCHAR(50), -- e.g., 'PORTFOLIO', 'PERFORMANCE', 'TRANSACTION'
    template_file_path VARCHAR(500),
    output_formats VARCHAR(100) DEFAULT 'PDF,EXCEL,CSV', -- Comma-separated
    parameters_schema JSONB,
    schedule_enabled BOOLEAN DEFAULT FALSE,
    default_schedule_cron VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_report_templates_code ON report_templates(template_code);

-- Generated reports table
CREATE TABLE generated_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(template_id),
    report_name VARCHAR(200) NOT NULL,
    portfolio_id UUID REFERENCES portfolios(portfolio_id),
    customer_id UUID REFERENCES customers(customer_id),
    generation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    report_period_start DATE,
    report_period_end DATE,
    parameters JSONB,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    storage_location VARCHAR(100), -- e.g., 'RUSTFS', 'S3', 'LOCAL'
    object_storage_key VARCHAR(500),
    format VARCHAR(10) DEFAULT 'PDF',
    status workflow_status DEFAULT 'PENDING_APPROVAL',
    generated_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    emailed_to_customer BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX idx_generated_reports_portfolio ON generated_reports(portfolio_id);
CREATE INDEX idx_generated_reports_customer ON generated_reports(customer_id);
CREATE INDEX idx_generated_reports_date ON generated_reports(generation_date);
CREATE INDEX idx_generated_reports_status ON generated_reports(status);

-- Report schedules table
CREATE TABLE report_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(template_id),
    portfolio_id UUID REFERENCES portfolios(portfolio_id),
    customer_id UUID REFERENCES customers(customer_id),
    schedule_name VARCHAR(200) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    start_date DATE NOT NULL,
    end_date DATE,
    last_run_timestamp TIMESTAMP WITH TIME ZONE,
    next_run_timestamp TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    parameters JSONB,
    recipient_emails VARCHAR(500), -- Comma-separated email addresses
    notify_on_success BOOLEAN DEFAULT TRUE,
    notify_on_failure BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_report_schedules_template ON report_schedules(template_id);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_timestamp);
CREATE INDEX idx_report_schedules_enabled ON report_schedules(enabled);

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Audit log table
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW
    old_values JSONB,
    new_values JSONB,
    changed_fields VARCHAR(500),
    user_id UUID,
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100)
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- Users table (for application-level users, Keycloak handles authentication)
CREATE TABLE app_users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keycloak_id UUID UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(200),
    role VARCHAR(50) NOT NULL, -- MAKER, CHECKER, ADMIN, VIEWER
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_users_keycloak ON app_users(keycloak_id);
CREATE INDEX idx_app_users_role ON app_users(role);

-- System configuration table
CREATE TABLE system_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type VARCHAR(50) DEFAULT 'STRING', -- STRING, NUMBER, BOOLEAN, JSON
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Insert default configuration values
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('OBJECT_STORAGE_TYPE', 'RUSTFS', 'STRING', 'Object storage backend type'),
('RUSTFS_ENDPOINT', 'http://rustfs:8080', 'STRING', 'RustFS server endpoint'),
('RUSTFS_BUCKET_REPORTS', 'reports', 'STRING', 'Bucket name for storing reports'),
('RUSTFS_ACCESS_KEY', 'rustfsadmin', 'STRING', 'RustFS access key'),
('REPORT_RETENTION_DAYS', '2555', 'NUMBER', 'Number of days to retain reports (7 years)'),
('DEFAULT_CURRENCY', 'USD', 'STRING', 'Default currency for the system'),
('MAX_TRADE_VALUE', '10000000', 'NUMBER', 'Maximum trade value requiring additional approval'),
('EMAIL_ENABLED', 'true', 'BOOLEAN', 'Enable email notifications'),
('SMTP_HOST', 'smtp.example.com', 'STRING', 'SMTP server host'),
('SMTP_PORT', '587', 'NUMBER', 'SMTP server port');

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Portfolio summary view
CREATE OR REPLACE VIEW v_portfolio_summary AS
SELECT 
    p.portfolio_id,
    p.portfolio_code,
    p.portfolio_name,
    p.customer_id,
    c.customer_name,
    p.base_currency,
    p.total_value,
    p.cash_balance,
    p.status,
    COUNT(DISTINCT ph.security_id) as holdings_count,
    SUM(ph.market_value) as total_market_value,
    SUM(ph.unrealized_pnl) as total_unrealized_pnl,
    p.inception_date,
    p.updated_at
FROM portfolios p
LEFT JOIN customers c ON p.customer_id = c.customer_id
LEFT JOIN portfolio_holdings ph ON p.portfolio_id = ph.portfolio_id
GROUP BY p.portfolio_id, p.portfolio_code, p.portfolio_name, p.customer_id, 
         c.customer_name, p.base_currency, p.total_value, p.cash_balance, 
         p.status, p.inception_date, p.updated_at;

-- Trade summary view
CREATE OR REPLACE VIEW v_trade_summary AS
SELECT 
    t.trade_id,
    t.trade_reference,
    p.portfolio_code,
    s.symbol,
    s.name as security_name,
    t.trade_side,
    t.order_type,
    t.quantity,
    t.price,
    t.executed_price,
    t.net_amount,
    t.currency,
    t.status,
    t.trade_date,
    t.settlement_date,
    b.broker_name,
    t.created_at
FROM trades t
JOIN portfolios p ON t.portfolio_id = p.portfolio_id
JOIN securities s ON t.security_id = s.security_id
LEFT JOIN brokers b ON t.broker_id = b.broker_id;

-- Performance metrics view
CREATE OR REPLACE VIEW v_performance_metrics AS
SELECT 
    p.portfolio_id,
    p.portfolio_code,
    p.portfolio_name,
    SUM(ph.market_value) as current_value,
    SUM(ph.cost_basis) as total_cost,
    SUM(ph.unrealized_pnl) as total_pnl,
    ROUND((SUM(ph.unrealized_pnl) / NULLIF(SUM(ph.cost_basis), 0) * 100)::numeric, 2) as return_percent,
    COUNT(DISTINCT ph.security_id) as num_holdings,
    MAX(ph.last_valuation_date) as last_valuation
FROM portfolios p
LEFT JOIN portfolio_holdings ph ON p.portfolio_id = ph.portfolio_id
WHERE p.status = 'ACTIVE'
GROUP BY p.portfolio_id, p.portfolio_code, p.portfolio_name;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_securities_updated_at BEFORE UPDATE ON securities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_holdings_updated_at BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate portfolio holdings market value
CREATE OR REPLACE FUNCTION calculate_holding_market_value()
RETURNS TRIGGER AS $$
BEGIN
    NEW.market_value := NEW.quantity * NEW.current_price;
    NEW.cost_basis := NEW.quantity * NEW.average_cost;
    NEW.unrealized_pnl := NEW.market_value - NEW.cost_basis;
    NEW.unrealized_pnl_percent := 
        CASE 
            WHEN NEW.cost_basis > 0 THEN (NEW.unrealized_pnl / NEW.cost_basis * 100)
            ELSE 0
        END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_holding_value_before_insert
    BEFORE INSERT OR UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION calculate_holding_market_value();

-- Function to generate trade reference number
CREATE OR REPLACE FUNCTION generate_trade_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.trade_reference IS NULL OR NEW.trade_reference = '' THEN
        NEW.trade_reference := 'TRD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                               LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_trade_ref_before_insert
    BEFORE INSERT ON trades
    FOR EACH ROW EXECUTE FUNCTION generate_trade_reference();

-- ============================================================================
-- INITIAL DATA SEEDING
-- ============================================================================

-- Insert sample benchmark
INSERT INTO benchmarks (benchmark_code, benchmark_name, description, benchmark_type, currency, provider)
VALUES 
('SPX', 'S&P 500 Index', 'Standard & Poor''s 500 Index', 'EQUITY_INDEX', 'USD', 'S&P Dow Jones Indices'),
('AGG', 'Bloomberg Barclays US Aggregate Bond Index', 'US Investment Grade Bond Index', 'BOND_INDEX', 'USD', 'Bloomberg');

-- Insert sample system roles (for reference, actual roles managed in Keycloak)
-- This is just for documentation purposes
COMMENT ON TABLE app_users IS 'Application users mapped to Keycloak identities. Roles: MAKER (can create/modify), CHECKER (can approve/reject), ADMIN (full access), VIEWER (read-only)';

-- ============================================================================
-- GRANTS AND PERMISSIONS (Example - adjust based on your setup)
-- ============================================================================

-- Create application role
-- CREATE ROLE portfolio_app WITH LOGIN PASSWORD 'your_secure_password';
-- GRANT CONNECT ON DATABASE portfolio_db TO portfolio_app;
-- GRANT USAGE ON SCHEMA public TO portfolio_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portfolio_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portfolio_app;

-- Create read-only role for reporting
-- CREATE ROLE portfolio_reader WITH LOGIN PASSWORD 'your_secure_password';
-- GRANT CONNECT ON DATABASE portfolio_db TO portfolio_reader;
-- GRANT USAGE ON SCHEMA public TO portfolio_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO portfolio_reader;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

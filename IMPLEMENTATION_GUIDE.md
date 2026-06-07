# Financial Portfolio Management System - Implementation Guide

A complete full-stack application for managing customer portfolios, trades, and financial reporting with RustFS object storage.

## Project Structure

```
/workspace
├── database/           # PostgreSQL schema and migrations
│   └── schema.sql
├── backend/            # Node.js/Express REST API
│   ├── src/
│   │   ├── index.js
│   │   ├── database/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── storage/    # RustFS integration
│   └── package.json
└── frontend/           # React + Vite + Tailwind CSS
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   ├── pages/
    │   └── services/
    └── package.json
```

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Object Storage**: RustFS (S3-compatible)
- **Authentication**: Keycloak (JWT/OAuth2)
- **Caching**: Redis

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Icons**: Lucide React

### Database
- **Type**: Relational (PostgreSQL)
- **Features**: UUIDs, JSONB, Triggers, Views, Enums

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- RustFS running (or MinIO for development)
- Redis (optional)
- Keycloak (optional for development)

### 1. Database Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Run the schema
\i /workspace/database/schema.sql
```

### 2. Backend Setup

```bash
cd /workspace/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd /workspace/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API Health Check: http://localhost:3000/health

## RustFS Object Storage

The application uses RustFS for storing generated reports. Configuration:

```env
OBJECT_STORAGE_TYPE=RUSTFS
RUSTFS_ENDPOINT=http://localhost:8080
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=rustfsadmin123
RUSTFS_BUCKET_REPORTS=reports
RUSTFS_BUCKET_DOCUMENTS=documents
```

### Features
- Upload/download reports
- Presigned URLs for secure temporary access
- Automatic bucket creation
- S3-compatible API

## Key Features

### 1. Customer Management
- Create, read, update customers
- KYC status tracking
- Search and filtering
- Maker-checker workflow

### 2. Portfolio Management
- Multiple portfolios per customer
- Real-time holdings tracking
- Performance metrics
- Benchmark comparison

### 3. Trading
- Trade execution tracking
- Order management
- Settlement tracking
- Broker integration

### 4. Reporting
- Generate PDF/Excel/CSV reports
- Store reports in RustFS
- Download with presigned URLs
- Maker-checker approval workflow
- Scheduled report generation

### 5. Maker-Checker Workflow (4-Eyes Principle)
- All critical operations require approval
- Makers create/modify data
- Checkers review and approve
- Complete audit trail

## API Endpoints

### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create customer (pending approval)
- `PUT /api/customers/:id` - Update customer (pending approval)
- `DELETE /api/customers/:id` - Delete customer

### Portfolios
- `GET /api/portfolios` - List all portfolios
- `GET /api/portfolios/:id` - Get portfolio details

### Trades
- `GET /api/trades` - List all trades
- `POST /api/trades` - Create trade
- `POST /api/trades/:id/approve` - Approve trade

### Reports
- `GET /api/reports` - List all reports
- `POST /api/reports/generate` - Generate new report
- `GET /api/reports/:id/download` - Download report from RustFS
- `GET /api/reports/:id/url` - Get presigned URL
- `POST /api/reports/:id/approve` - Approve report

## Database Schema Highlights

### Core Tables
- `customers` - Customer information
- `portfolios` - Investment portfolios
- `securities` - Financial instruments
- `portfolio_holdings` - Portfolio positions
- `trades` - Trading transactions

### Workflow & Audit
- `workflow_approvals` - Maker-checker approvals
- `audit_logs` - Complete audit trail

### Reporting
- `report_templates` - Report definitions
- `generated_reports` - Generated report metadata
- `report_schedules` - Scheduled reports

### Views
- `v_portfolio_summary` - Portfolio overview
- `v_trade_summary` - Trade summary
- `v_performance_metrics` - Performance calculations

## Security

- JWT authentication via Keycloak
- Role-based access control (RBAC)
- Input validation on all endpoints
- CORS protection
- Helmet.js security headers
- Encrypted database connections

## Development

### Backend Scripts
```bash
npm start      # Production
npm run dev    # Development with hot reload
npm test       # Run tests
npm run lint   # Code linting
```

### Frontend Scripts
```bash
npm run dev    # Development server
npm run build  # Production build
npm run preview # Preview production build
npm run lint   # Code linting
```

## Environment Variables

See `/workspace/backend/.env.example` and `/workspace/frontend/.env.example` for all configurable options.

## License

MIT License

## Support

For issues or questions, please refer to the documentation or open an issue.

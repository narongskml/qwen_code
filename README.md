# Financial Portfolio Management System

A comprehensive web application for managing customer information, portfolios, trading activities, and financial reporting.

## Features

### Core Modules

- **Customer Information Management**
  - Complete customer profiles and data management
  - KYC (Know Your Customer) compliance support

- **Portfolio Management**
  - Portfolio creation and tracking
  - Asset allocation and diversification analysis
  - Real-time portfolio holdings

- **Trading Information**
  - Trade execution and tracking
  - Order management
  - Transaction history

- **Securities Management**
  - Security master data
  - Instrument types and classifications
  - Pricing and valuation

- **Broker & Counterparty Management**
  - Broker relationships and configurations
  - Counterparty risk management
  - Trade settlement tracking

- **Credit Rating**
  - Credit assessment and scoring
  - Rating agency integrations
  - Risk exposure monitoring

- **Performance Analytics**
  - Portfolio performance measurement
  - Return calculations (TWR, MWR)
  - Attribution analysis

- **Benchmark Management**
  - Benchmark index configuration
  - Performance comparison
  - Tracking error analysis

- **Reporting**
  - Comprehensive financial reports
  - Regulatory reporting
  - Open-source reporting tools integration (JasperReports/BIRT)
  - Scheduled report generation and delivery

### Advanced Features

- **Maker-Checker Workflow (4-Eyes Principle)**
  - Dual approval process for critical operations
  - Makers create/prepare data and reports
  - Checkers review, confirm, and approve
  - Prevents self-approval and ensures data integrity

- **Automated Report Scheduling**
  - Configurable report schedules (daily, weekly, monthly)
  - Automatic report generation based on triggers
  - Email delivery to customers upon approval

- **Customer Communication**
  - Secure email delivery of approved reports
  - Audit trail for all communications
  - Customer notification management

## Technology Stack

### Backend
- **Database**: PostgreSQL - Reliable, enterprise-grade relational database
  - Primary instance for transactions
  - Read replicas for reporting queries
  - WAL archiving for point-in-time recovery
- **Authentication**: Keycloak - Secure identity and access management
  - Single Sign-On (SSO)
  - Multi-factor authentication (MFA)
  - Role-based access control (RBAC)
  - Support for Maker/Checker roles
- **Caching**: Redis - Session management and query caching
- **Scheduler**: Quartz/Hangfire - Automated report scheduling

### Frontend
- Modern web application framework (React/Angular)
- Responsive design for desktop and mobile
- Real-time data grids and dashboards

### Reporting
- Open-source reporting tools (JasperReports/BIRT)
- PDF, Excel, CSV export capabilities
- Template-based report generation

### Infrastructure
- **Containerization**: Docker & Kubernetes
- **Load Balancing**: Nginx/HAProxy
- **Object Storage**: MinIO/S3 for report storage
- **Email**: SMTP integration for customer notifications

## Architecture

For detailed system architecture including multi-tier design, Maker-Checker workflows, and reporting pipelines, see [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

### High-Level Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│   Application    │────▶│   PostgreSQL    │
│   (Frontend)    │     │     Server       │     │    Database     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │     Keycloak     │     │   Redis Cache   │
                        │  (Authentication)│     └─────────────────┘
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   SMTP Server    │◀────┐
                        │   (Email)        │     │
                        └──────────────────┘     │
                               ▲                 │
                               │                 │
                        ┌────────────────────────┘
                        │
                  Customer Email
```

### Key Architectural Components

- **Multi-Tier Architecture**: Separation of presentation, business logic, and data layers
- **Maker-Checker Workflow**: 4-eyes principle enforced at the application layer
- **Report Scheduling Engine**: Automated job scheduling for report generation
- **Notification Service**: Email delivery upon report approval
- **Audit Logging**: Complete trail of all maker/checker actions

## Getting Started

### Prerequisites

- PostgreSQL 14+
- Keycloak 20+
- Node.js / Python / Java (depending on implementation)
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb portfolio_db
   ```

3. **Keycloak Configuration**
   - Install and start Keycloak
   - Create a new realm for the application
   - Configure clients and roles
   - Set up user federation if needed

4. **Application Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Update configuration values
   # - Database connection string
   # - Keycloak URL and credentials
   # - Application secrets
   ```

5. **Install Dependencies**
   ```bash
   # Install project dependencies
   npm install  # or pip install -r requirements.txt, or mvn install
   ```

6. **Run the Application**
   ```bash
   # Start the development server
   npm start  # or appropriate command
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `KEYCLOAK_URL` | Keycloak server URL | - |
| `KEYCLOAK_REALM` | Keycloak realm name | - |
| `KEYCLOAK_CLIENT_ID` | Keycloak client ID | - |
| `PORT` | Application port | 3000 |

## API Documentation

API documentation is available at `/api/docs` when running the application.

## Development

### Running Tests
```bash
npm test  # or appropriate test command
```

### Code Style
```bash
npm run lint  # or appropriate linting command
```

## Security

- All authentication handled through Keycloak
- Role-based access control for all endpoints
- Encrypted database connections
- Secure session management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- PostgreSQL community
- Keycloak team
- Open-source reporting tools contributors

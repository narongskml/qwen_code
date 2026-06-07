# System Architecture Design

## 1. Executive Summary

This document outlines the system architecture for a **Multi-Tier Financial Data Management and Reporting Application**. The system is designed to manage customer data, portfolio holdings, and trading information while enforcing strict governance via a **Maker-Checker (4-Eyes)** workflow. It features automated report scheduling, generation, validation, and secure delivery to customers via email.

## 2. Architectural Overview

The system follows a **Layered Multi-Tier Architecture** to ensure separation of concerns, scalability, and security.

### High-Level Diagram

```mermaid
graph TD
    subgraph "Client Tier"
        User[User (Browser)]
        EmailClient[Customer Email Client]
    end

    subgraph "Presentation Tier"
        LB[Load Balancer / Ingress]
        WebApp[Web Application Server (Frontend)]
        Keycloak[Keycloak (IAM)]
    end

    subgraph "Application Tier (Business Logic)"
        APIGW[API Gateway]
        AuthService[Auth Service Adapter]
        CustomerSvc[Customer Management Service]
        PortfolioSvc[Portfolio & Trading Service]
        WorkflowSvc[Workflow Engine (Maker/Checker)]
        ReportSvc[Reporting & Scheduling Service]
        EmailSvc[Notification Service]
    end

    subgraph "Data Tier"
        DB[(PostgreSQL Primary)]
        DB_Replica[(PostgreSQL Replica)]
        Cache[(Redis Cache)]
        FileStore[(Object Storage / Reports)]
    end

    subgraph "External Systems"
        SMTP[SMTP Server]
        MarketData[Market Data Feeds]
    end

    User --> LB
    LB --> WebApp
    WebApp --> Keycloak
    WebApp --> APIGW
    
    APIGW --> AuthService
    APIGW --> CustomerSvc
    APIGW --> PortfolioSvc
    APIGW --> WorkflowSvc
    APIGW --> ReportSvc
    
    WorkflowSvc --> DB
    CustomerSvc --> DB
    PortfolioSvc --> DB
    ReportSvc --> DB
    ReportSvc --> FileStore
    ReportSvc --> EmailSvc
    
    EmailSvc --> SMTP
    
    DB --> DB_Replica
    CustomerSvc --> Cache
    PortfolioSvc --> MarketData
    EmailClient -.-> SMTP
```

## 3. Tier Breakdown

### 3.1. Client Tier
- **Web Browser**: Users access the application via a responsive Single Page Application (SPA).
- **Email Clients**: Customers receive finalized reports via standard SMTP email.

### 3.2. Presentation Tier
- **Load Balancer**: Distributes incoming traffic across application instances.
- **Web Server**: Hosts the static frontend assets (React/Angular/Vue) and handles SSL termination.
- **Identity Provider (Keycloak)**: Manages authentication (SSO), MFA, and issues JWT tokens. It defines roles such as `MAKER`, `CHECKER`, `ADMIN`, and `CUSTOMER`.

### 3.3. Application Tier (Core Business Logic)
This tier is composed of modular services (can be deployed as a monolith or microservices):

1.  **Customer Management Service**:
    - CRUD operations for customer profiles, KYC data, and contact details.
    - *Security*: Data encryption at rest.

2.  **Portfolio & Trading Service**:
    - Ingests trading information, securities data, and broker/counterparty details.
    - Calculates performance metrics and benchmarks.
    - Integrates with external market data feeds.

3.  **Workflow Engine (Maker-Checker Core)**:
    - Enforces the **4-Eyes Principle**.
    - **State Machine**: `DRAFT` → `PENDING_REVIEW` → `APPROVED` / `REJECTED`.
    - Prevents the same user from approving their own creation.

4.  **Reporting & Scheduling Service**:
    - **Scheduler**: Cron-based or Quartz scheduler to trigger report generation jobs.
    - **Generator**: Aggregates data from PostgreSQL, renders templates (PDF/HTML), and stores them in Object Storage.
    - **Workflow Integration**: Generated reports enter the Maker-Checker flow before release.

5.  **Notification Service**:
    - Listens for `REPORT_APPROVED` events.
    - Composes emails with secure links or attachments.
    - Sends via SMTP.

### 3.4. Data Tier
- **PostgreSQL (Primary)**: Relational storage for structured financial data, user logs, and workflow states.
- **PostgreSQL (Read Replica)**: Handles heavy read operations for reporting dashboards to avoid locking the primary DB.
- **Redis**: Caches session data, frequent portfolio queries, and temporary report generation states.
- **Object Storage (MinIO/S3)**: Stores generated PDF reports and audit logs.

## 4. Key Workflows

### 4.1. Maker-Checker (4-Eyes) Workflow

This workflow ensures no critical action (Customer Update, Report Release) happens without dual approval.

| Step | Actor | Action | System State Change |
| :--- | :--- | :--- | :--- |
| **1** | **Maker** | Creates/Updates Customer Data or Prepares Report | `Status: DRAFT` |
| **2** | **Maker** | Submits for Approval | `Status: PENDING_REVIEW` <br> *Locks record from further editing by Maker* |
| **3** | **System** | Validates Permissions | Checks if `Checker` != `Maker` ID |
| **4** | **Checker** | Reviews Data/Report | Views audit trail and changes |
| **5a** | **Checker** | **Approves** | `Status: APPROVED` <br> *Triggers downstream actions (e.g., Email)* |
| **5b** | **Checker** | **Rejects** | `Status: REJECTED` <br> *Returns to Maker with comments* |

**Technical Implementation:**
- Database columns: `created_by`, `checked_by`, `approval_status`, `approval_timestamp`.
- Middleware check: `if (currentUser.id == record.created_by && action == 'approve') throw Error('Self-approval not allowed');`

### 4.2. Scheduled Reporting & Delivery Workflow

1.  **Schedule Trigger**: The Scheduler service identifies a due report (e.g., "Monthly Portfolio Statement").
2.  **Data Aggregation**: Fetches latest portfolio holdings, performance, and benchmark data.
3.  **Draft Generation**: Creates a draft report (`Status: DRAFT`).
4.  **Auto-Submission**: Depending on policy, the system may auto-submit to the queue or wait for a Maker to manually submit.
    *   *Scenario A (Fully Auto)*: System acts as "Maker", requires a human "Checker" to approve before sending.
    *   *Scenario B (Human in Loop)*: Notification sent to Relationship Manager (Maker) to review and submit.
5.  **Review**: Checker reviews the generated PDF/Data.
6.  **Approval & Dispatch**:
    - Upon approval, the `Notification Service` is triggered.
    - Email generated with secure link (or encrypted attachment).
    - Status updated to `SENT`.
    - Audit log recorded.

## 5. Data Model Highlights

### Workflow Tracking Table
```sql
CREATE TABLE workflow_audit (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50), -- e.g., 'CUSTOMER', 'REPORT'
    entity_id UUID,
    current_status VARCHAR(20), -- DRAFT, PENDING, APPROVED, REJECTED
    maker_id UUID,
    checker_id UUID,
    created_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejection_reason TEXT
);
```

### Report Schedule Table
```sql
CREATE TABLE report_schedules (
    id UUID PRIMARY KEY,
    customer_id UUID,
    report_type VARCHAR(50),
    cron_expression VARCHAR(50), -- e.g., '0 0 8 1 * ?'
    is_active BOOLEAN,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP
);
```

## 6. Security Architecture

- **Authentication**: OIDC/OAuth2 via Keycloak.
- **Authorization**: Role-Based Access Control (RBAC).
    - `ROLE_MAKER`: Can create/edit, cannot approve.
    - `ROLE_CHECKER`: Can view pending, approve/reject.
    - `ROLE_ADMIN`: Can configure schedules and users.
- **Data Security**:
    - TLS 1.3 for data in transit.
    - AES-256 for sensitive columns (PII) in PostgreSQL.
    - Signed URLs for report downloads (time-limited access).
- **Audit Logging**: Immutable logs of every state transition in the workflow.

## 7. Technology Stack Recommendation

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Frontend** | React or Angular | Rich ecosystem for data grids and dashboards. |
| **Backend** | Java (Spring Boot) or .NET | Strong typing, mature transaction management, excellent for financial logic. |
| **Database** | PostgreSQL | ACID compliance, JSONB support for flexible schema, robust replication. |
| **Auth** | Keycloak | Industry standard for IAM, supports 4-eyes policies via roles. |
| **Scheduler** | Quartz (Java) or Hangfire (.NET) | Reliable, persistent job scheduling. |
| **Reporting** | JasperReports or BIRT | Open source, integrates well with Java/.NET, exports to PDF. |
| **Email** | Spring Mail / SMTP | Standard protocol integration. |
| **Cache** | Redis | Low latency for session and data caching. |
| **Containerization**| Docker & Kubernetes | Scalability and orchestration. |

## 8. Deployment Strategy

- **Environment Separation**: Dev, UAT (for Maker/Checker testing), Prod.
- **High Availability**: 
    - Multiple instances of App Tier behind LB.
    - PostgreSQL configured with Patroni for automatic failover.
- **Backup**: Daily full backups + WAL archiving for Point-in-Time Recovery (PITR).

## 9. Future Considerations

- **Digital Signature**: Integrate PKI to digitally sign PDF reports upon Checker approval.
- **Customer Portal**: Allow customers to log in and view historical reports directly instead of email.
- **AI Insights**: Add a layer to analyze portfolio performance and generate natural language summaries for the reports.

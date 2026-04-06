# Test Cases — Technomatz Finance Management System

This document lists functional test cases for all modules in the system.

## Auth Module

- **TC-AUTH-01: Register first director (auto-approved)**
  - **Precondition**: `directors` collection empty
  - **Steps**:
    - Call `POST /api/auth/register` with valid `name/email/password`
  - **Expected**:
    - Response includes created director `id`
    - `status` is `approved`
    - Auth cookies set (`access_token`, `refresh_token`)

- **TC-AUTH-02: Register subsequent director (pending)**
  - **Precondition**: At least one approved director exists
  - **Steps**:
    - Call `POST /api/auth/register` with new email
  - **Expected**:
    - `status` is `pending`
    - Response includes `requiresApproval: true`
    - Director cannot login until approved

- **TC-AUTH-03: Login approved director**
  - **Steps**:
    - Call `POST /api/auth/login`
  - **Expected**:
    - 200 response
    - Cookies set; `GET /api/auth/me` returns director details

- **TC-AUTH-04: Login pending director denied**
  - **Expected**:
    - `POST /api/auth/login` returns 403 with pending message

- **TC-AUTH-05: Refresh token**
  - **Steps**:
    - Call `POST /api/auth/refresh` with valid refresh cookie
  - **Expected**:
    - 200 response, new `access_token` cookie

- **TC-AUTH-06: Logout clears session**
  - **Expected**:
    - `POST /api/auth/logout` clears cookies
    - Protected endpoints return 401

## Directors Module

- **TC-DIR-01: List approved directors**
  - **Steps**:
    - Call `GET /api/directors`
  - **Expected**:
    - Returns list containing only `status: approved`

- **TC-DIR-02: List pending directors**
  - **Steps**:
    - Call `GET /api/directors/pending`
  - **Expected**:
    - Returns list containing only `status: pending`

- **TC-DIR-03: Approve a pending director**
  - **Steps**:
    - Call `POST /api/directors/approve/:id`
  - **Expected**:
    - Director status changes to `approved`
    - Director can login

- **TC-DIR-04: Reject a pending director**
  - **Steps**:
    - Call `POST /api/directors/reject/:id`
  - **Expected**:
    - Director status changes to `rejected`
    - Login returns 403

- **TC-DIR-05: Update director profile**
  - **Steps**:
    - Call `PUT /api/directors/:id` with `name/email`
  - **Expected**:
    - Fields updated; email uniqueness enforced

- **TC-DIR-06: Delete director (cannot delete self)**
  - **Expected**:
    - `DELETE /api/directors/:id` fails if `:id === current user`

## Projects Module

- **TC-PROJ-01: Create project**
  - **Steps**:
    - `POST /api/projects` with `name`
  - **Expected**:
    - Project created with `id`, `created_by`

- **TC-PROJ-02: List projects**
  - **Steps**:
    - `GET /api/projects`
  - **Expected**:
    - List returns created projects

- **TC-PROJ-03: Get project by id**
  - **Expected**:
    - `GET /api/projects/:id` returns project or 404

- **TC-PROJ-04: Update project**
  - **Expected**:
    - `PUT /api/projects/:id` updates fields; returns updated doc

- **TC-PROJ-05: Delete project**
  - **Expected**:
    - `DELETE /api/projects/:id` removes project; subsequent GET returns 404

## Transactions Module

- **TC-TXN-01: Create company income**
  - **Steps**:
    - `POST /api/transactions` with `{ transaction_type: "income", amount, account_type:"company" }`
  - **Expected**:
    - Transaction inserted
    - Audit log entry created in `transaction_audit` with `action: "create"`

- **TC-TXN-02: Create director expense**
  - **Steps**:
    - `POST /api/transactions` with `{ transaction_type:"expense", amount, account_type:"director", director_id }`
  - **Expected**:
    - Transaction inserted with director context
    - Audit entry references `director_id`

- **TC-TXN-03: Create loan (director -> company)**
  - **Steps**:
    - `POST /api/transactions` with `{ transaction_type:"loan", amount, director_id }`
  - **Expected**:
    - Transaction inserted; dashboards reflect loans given / company balance
    - Audit entry created

- **TC-TXN-04: Create transfer (director -> director)**
  - **Steps**:
    - `POST /api/transactions` with `{ transaction_type:"transfer", amount, from_director_id, to_director_id }`
  - **Expected**:
    - Transaction inserted with from/to fields
    - Audit entry contains both ids

- **TC-TXN-05: Update transaction**
  - **Expected**:
    - `PUT /api/transactions/:id` updates fields
    - Audit entry `action:"update"` created and includes `previous_amount` and `previous_transaction_type`

- **TC-TXN-06: Delete transaction**
  - **Expected**:
    - `DELETE /api/transactions/:id` deletes transaction
    - Audit entry `action:"delete"` created

- **TC-TXN-07: List transactions with period filters**
  - **Expected**:
    - `GET /api/transactions?period=month&month=...&year=...` filters by `transaction_date`

- **TC-TXN-08: CSV export**
  - **Expected**:
    - `GET /api/transactions/csv?...` returns CSV with header row

## Dashboard Module

- **TC-DB-01: Company dashboard all-time**
  - **Expected**:
    - `GET /api/dashboard/company?period=all` returns totals and calculated fields

- **TC-DB-02: Company dashboard FY**
  - **Expected**:
    - FY filter uses April→March

- **TC-DB-03: Director dashboard**
  - **Expected**:
    - `GET /api/dashboard/director` returns `shareOfIncome`, `loansGiven`, transfers, balance

- **TC-DB-04: CSV exports**
  - **Expected**:
    - `GET /api/dashboard/company/csv`
    - `GET /api/dashboard/director/csv`

## Audit Module

- **TC-AUD-01: Audit log lists actions**
  - **Expected**:
    - `GET /api/transaction-audit` returns most recent first by `recorded_at`

- **TC-AUD-02: Audit period filters**
  - **Expected**:
    - Uses `recorded_at` (not `transaction_date`) for filtering

- **TC-AUD-03: Audit CSV export**
  - **Expected**:
    - `GET /api/transaction-audit/csv?...` returns CSV with action/amount/type/actor columns

## Seed Module

- **TC-SEED-01: Seed creates default directors**
  - **Steps**:
    - Run `yarn seed`
  - **Expected**:
    - 2 approved directors exist (dummy emails/password)

- **TC-SEED-02: Seed creates initial transactions**
  - **Expected**:
    - Seeded income/expense/loan/transfer exist in `transactions`

- **TC-SEED-03: Seed creates audit entries**
  - **Expected**:
    - Matching `transaction_audit` entries exist, visible on Audit page

- **TC-SEED-04: Seed is idempotent**
  - **Expected**:
    - Re-running seed does not duplicate directors/transactions/audit entries


# Siigo Integration Specifications

## 1. Connection and Authentication Agent
Communication with Siigo is done via a RESTful API that requires an access token (JWT).

- **Authentication Endpoint**: `POST https://api.siigo.com/auth`
- **Required Credentials**:
  - `username`: Integrator user email.
  - `access_key`: Secure key generated from the Siigo portal.
- **Critical Headers**:
  - `Authorization`: `Bearer {access_token}`
  - `Partner-Id`: Unique identifier of the integrator application (Mandatory Siigo requirement).
- **Token Lifespan**: 24 Hours. An automatic refresh or re-authentication mechanism must be implemented.

## 2. Main Resources (Base URL: `https://api.siigo.com/v1`)
The application will mainly interact with the following modules:

1.  **Third Parties (Customers)**:
    -   Endpoint: `/customers`
    -   Usage: Creation and update of clients and suppliers to ensure billing is assigned correctly.

2.  **Invoicing (Invoices)**:
    -   Endpoint: `/invoices`
    -   Usage: Automatic generation of sales invoices based on transactions recorded in the app.

3.  **Products and Services (Products)**:
    -   Endpoint: `/products`
    -   Usage: Catalog query to associate items with invoices.

4.  **Vouchers and Receipts**:
    -   Endpoints: `/vouchers`, `/payment-receipts`
    -   Usage: Registration of payments and additional accounting movements.

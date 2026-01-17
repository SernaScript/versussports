# Business Context & Logic

## 1. Project Objective
The main purpose of this application is to serve as an integration bridge with the **Siigo Nube** accounting system. The application allows managing and automating accounting requests, ensuring data synchronization between business operations and accounting.

## 2. Technical Reference
- **Official API Documentation**: [https://siigoapi.docs.apiary.io/#](https://siigoapi.docs.apiary.io/#)

## 3. Development Considerations
- **API Limits**: Respect Siigo's "Rate Limits" to avoid blocking.
- **Error Handling**: Implement robust logic to handle HTTP 400 (Bad Request), 401 (Unauthorized), and 5xx (Server Errors) responses.
- **Idempotency**: Use idempotency keys where possible to avoid document duplication in case of network failures.

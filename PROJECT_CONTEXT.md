# Contexto del Proyecto: Integración Siigo

## 1. Objetivo del Proyecto
El propósito principal de esta aplicación es servir como un puente de integración con el sistema contable **Siigo Nube**. La aplicación permitirá gestionar y automatizar solicitudes contables, asegurando la sincronización de datos entre la operación del negocio y la contabilidad.

## 2. Referencia Técnica
- **Documentación Oficial API**: [https://siigoapi.docs.apiary.io/#](https://siigoapi.docs.apiary.io/#)

## 3. Especificaciones de Integración Siigo

### 3.1 Agente de Conexión y Autenticación
La comunicación con Siigo se realiza mediante una API RESTful que requiere un token de acceso (JWT).

- **Endpoint de Autenticación**: `POST https://api.siigo.com/auth`
- **Credenciales Requeridas**:
  - `username`: Correo electrónico del usuario integrador.
  - `access_key`: Llave segura generada desde el portal de Siigo.
- **Headers Críticos**:
  - `Authorization`: `Bearer {access_token}`
  - `Partner-Id`: Identificador único de la aplicación integradora (Requisito obligatorio de Siigo).
- **Vida del Token**: 24 Horas. Se debe implementar un mecanismo de refresco o re-autenticación automática.

### 3.2 Recursos Principales (Base URL: `https://api.siigo.com/v1`)
La aplicación interactuará principalmente con los siguientes módulos:

1.  **Terceros (Customers)**:
    -   Endpoint: `/customers`
    -   Uso: Creación y actualización de clientes y proveedores para asegurar que la facturación se asigne correctamente.

2.  **Facturación (Invoices)**:
    -   Endpoint: `/invoices`
    -   Uso: Generación automática de facturas de venta basadas en las transacciones registradas en la app.

3.  **Productos y Servicios (Products)**:
    -   Endpoint: `/products`
    -   Uso: Consulta del catálogo para asociar ítems a las facturas.

4.  **Comprobantes y Recibos**:
    -   Endpoints: `/vouchers`, `/payment-receipts`
    -   Uso: Registro de pagos y movimientos contables adicionales.

## 4. Consideraciones de Desarrollo
- **Límites de API**: Respetar los "Rate Limits" de Siigo para evitar bloqueos.
- **Manejo de Errores**: Implementar lógica robusta para manejar respuestas HTTP 400 (Bad Request), 401 (Unauthorized) y 5xx (Server Errors).
- **Idempotencia**: Usar claves de idempotencia donde sea posible para evitar duplicidad de documentos en caso de fallos de red.

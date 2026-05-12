# Configuración de Wompi para AnmeraStore

## Variables de Entorno Requeridas

Para que la integración de Wompi funcione correctamente, debes configurar las siguientes variables de entorno en el archivo `.env` del backend:

```env
# Payment Provider Configuration
PAYMENT_PROVIDER=wompi

# Wompi Configuration (Colombia)
# Obtén tus llaves desde: https://comercios.wompi.co/
WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxxxxxxxxxxx
WOMPI_PRIVATE_KEY=prv_test_xxxxxxxxxxxxxxxxxxxxxx
WOMPI_EVENT_SECRET=test_events_xxxxxxxxxxxxxxxxxxxxxx

# Frontend URL (para redirecciones)
FRONTEND_URL=http://localhost:5173
```

## Cómo Obtener las Credenciales de Wompi

1. Regístrate en [Wompi Comercios](https://comercios.wompi.co/)
2. Ve a **Configuración** → **Credenciales**
3. Copia las siguientes llaves:
   - **Llave pública** → `WOMPI_PUBLIC_KEY`
   - **Llave privada** → `WOMPI_PRIVATE_KEY`
   - **Secret de eventos** → `WOMPI_EVENT_SECRET`

## Modo Sandbox vs Producción

- **Sandbox (Pruebas)**: Las llaves comienzan con `pub_test_`, `prv_test_`, `test_events_`
- **Producción**: Las llaves comienzan con `pub_prod_`, `prv_prod_`, `prod_events_`

El sistema detecta automáticamente el ambiente basado en `NODE_ENV`:
- `development` → usa sandbox de Wompi
- `production` → usa producción de Wompi

## Tarjetas de Prueba (Sandbox)

Para probar pagos en el ambiente de sandbox, usa estas tarjetas:

### Visa - Pago Exitoso
- **Número**: 4242 4242 4242 4242
- **CVV**: Cualquier 3 dígitos
- **Fecha**: Cualquier fecha futura

### Mastercard - Pago Rechazado
- **Número**: 5555 5555 5555 4444
- **CVV**: Cualquier 3 dígitos
- **Fecha**: Cualquier fecha futura

## Flujo de Pago

1. Usuario completa el formulario de checkout
2. Backend crea la orden y genera sesión de pago con Wompi
3. Usuario es redirigido a Wompi para completar el pago
4. Wompi procesa el pago y notifica al backend vía webhook
5. Usuario es redirigido de vuelta a la página de éxito

## Configuración de Webhooks

Para recibir notificaciones de Wompi en producción:

1. Ve a **Configuración** → **Webhooks** en el dashboard de Wompi
2. Agrega la URL: `https://tu-dominio.com/api/payments/webhook/wompi`
3. Selecciona el evento: `transaction.updated`

**Nota**: Para desarrollo local, usa [ngrok](https://ngrok.com/) para exponer tu backend.

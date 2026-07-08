---
title: "Adapters — Corehub IAM"
description: "Adapters swappables para OTP, email, pagos Bancard, generación de PDFs y almacenamiento de archivos. Stubs por defecto en desarrollo."
category: "API: Corehub IAM"
order: 106
date: "2026-05-05"
---

# Adapters

El servicio utiliza un sistema de adapters swappables: cada integración externa implementa una interfaz TypeScript y el proveedor concreto se selecciona por variable de entorno al arrancar. El stub es el proveedor por defecto en desarrollo, lo que permite trabajar sin ninguna credencial externa.

## Tabla de adapters

| Adapter | Stub (desarrollo) | Real (producción) | Variable de entorno |
|---------|------------------|--------------------|---------------------|
| OTP por email | Imprime el código en el log del servidor | Resend API | `OTP_EMAIL_PROVIDER=resend` |
| OTP por SMS | Imprime el código en el log del servidor | Twilio | `OTP_SMS_PROVIDER=twilio` |
| Email transaccional | Imprime en el log | Resend API | `EMAIL_PROVIDER=resend` |
| Pagos Bancard | Siempre aprueba el pago | API real de Bancard | `BANCARD_PROVIDER=real` |
| Generación de PDF | Devuelve un buffer mínimo vacío | `@react-pdf/renderer` | `PDF_PROVIDER=react-pdf` |
| Almacenamiento de archivos | Filesystem local (`/tmp/iam-storage`) | Amazon S3 | `STORAGE_PROVIDER=s3` |

## Trabajar con stubs en desarrollo

En modo stub, los adapters son completamente funcionales desde el punto de vista del flujo:

**OTP stub**: el código OTP se imprime en el log del servidor en lugar de enviarse por email/SMS. Puedes leer el código directamente en la consola o en `logs/api-iam.log`.

```
[info] { category: 'otp', event: 'otp_sent', code: '123456', channel: 'email', ... }
```

**Bancard stub**: el webhook de confirmación de pago puede simularse manualmente o el stub puede configurarse para aprobar automáticamente. Esto permite completar el flujo de onboarding sin credenciales de Bancard.

**PDF stub**: genera un buffer vacío pero válido para que el flujo de submit complete. Los documentos no tendrán contenido real hasta activar `PDF_PROVIDER=react-pdf`.

**Storage stub**: los archivos se guardan en el directorio local configurado por `STORAGE_STUB_DIR` (default: `/tmp/iam-storage`). Las URLs generadas apuntan a rutas locales.

## Variables de entorno por proveedor

### OTP por email — Resend

```env
OTP_EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=no-reply@corehub.com
```

### OTP por SMS — Twilio

```env
OTP_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+15551234567
```

### Email transaccional — Resend

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=no-reply@corehub.com
```

### Pagos — Bancard real

```env
BANCARD_PROVIDER=real
BANCARD_API_KEY=...
BANCARD_API_URL=https://vpos.infonet.com.py
BANCARD_WEBHOOK_SECRET=<min-16-chars>
BANCARD_RETURN_URL=https://hub.corehub.com/onboarding/payment/return
BANCARD_SHOP_PROCESS_PREFIX=corehub
```

### Generación de PDF — react-pdf

```env
PDF_PROVIDER=react-pdf
```

No requiere credenciales adicionales; el renderizado se hace en proceso.

### Almacenamiento — S3

```env
STORAGE_PROVIDER=s3
AWS_BUCKET=corehub-documents
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

## Selección de adapter al arrancar

El selector de adapter se ejecuta una sola vez en el composition root (`src/index.ts`) durante el arranque del servidor. Una vez seleccionado el proveedor, el resto de la aplicación trabaja contra la interfaz abstracta sin conocer la implementación concreta.

Esto garantiza que:
- Los tests unitarios pueden usar stubs inyectados directamente sin variables de entorno
- El código de servicio no contiene condicionales `if (provider === 'resend')`
- Cambiar de proveedor en producción solo requiere actualizar la variable de entorno y reiniciar

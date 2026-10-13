# Publicar Finance en Google Play

## 1. Antes de la primera build

0. **Supabase:** ejecuta `owner_defaults_migration.sql` en el SQL Editor **antes** de publicar una build hecha después del commit de React Doctor 100/100: la app ya no envía `user_id` al crear pagos fijos y subcategorías; lo asigna la base de datos.

1. **Supabase:** ejecuta `account_deletion_migration.sql` en el SQL Editor (habilita "Eliminar mi cuenta").
2. **Páginas legales:** se publican solas con GitHub Pages desde `docs/` → https://aldairmm18.github.io/finance/privacy-policy.html y https://aldairmm18.github.io/finance/delete-account.html
4. **Inicio con Google:** confirma que esté configurado en Supabase → Authentication → Providers; un botón que falla es motivo de rechazo. (Facebook se retiró de la app.)

## 2. Build y envío

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview      # APK para probar en tu teléfono
npx eas-cli build --platform android --profile production   # AAB para Play
```

- La **primera** subida del AAB a Play Console debe ser **manual** (Prueba interna → Crear versión).
- Después puedes usar `npx eas-cli submit --platform android --profile production` (requiere una cuenta de servicio de Google Cloud; EAS te guía).
- EAS crea y guarda la llave de firma. Activa **Play App Signing** (viene activo por defecto).
- Las cuentas personales nuevas de Play deben hacer una **prueba cerrada con 12 testers durante 14 días** antes de poder publicar en producción.

## 3. Ficha de la tienda

**Nombre (30):** Finance: presupuesto mensual

**Descripción breve (80):** Planea tu mes, registra tus gastos y mira cuánto te queda. Simple y sin anuncios.

**Descripción completa:**

> Finance te ayuda a saber, de un vistazo, cuánto te queda para gastar este mes.
>
> PLANEA TU MES
> Define tus ingresos, gastos fijos y meta de ahorro por categoría: hogar, comida, transporte, salud y más. Los gastos anuales o trimestrales se reparten solos por mes.
>
> REGISTRA EN SEGUNDOS
> Toca + para anotar un gasto o ingreso. También puedes registrarlos escribiéndole al bot de Telegram, por ejemplo "mercado 85 mil".
>
> MIRA CÓMO VAS
> Compara lo planeado con lo real en cada categoría, revisa cómo cerró cada mes del año y descubre en qué se va tu dinero.
>
> PAGOS FIJOS SIN SORPRESAS
> Agrega arriendo, servicios o suscripciones y recibe un recordatorio días antes de cada cobro.
>
> TU META DE LIBERTAD FINANCIERA
> Calcula cuánto patrimonio necesitas para cubrir tus gastos con lo que rinden tus inversiones.
>
> PRIVADO Y SIN ANUNCIOS
> Tus datos solo los ves tú. Funciona sin conexión, con modo claro y oscuro. Puedes eliminar tu cuenta y todos tus datos cuando quieras desde Ajustes.

**Categoría:** Finanzas · **Etiquetas:** presupuesto, control de gastos

**Gráficos** (en esta carpeta):
- Ícono 512×512: `play-icon-512.png`
- Gráfico destacado 1024×500: `feature-graphic-1024x500.png`
- Capturas de teléfono: mínimo 2 y máximo 8. La proporción no puede pasar de 2:1, así que tómalas en un emulador o teléfono Android (las de iPhone 17 no sirven).

## 4. Contenido de la app (Play Console → Política)

| Sección | Respuesta |
|---|---|
| Política de privacidad | URL de `privacy-policy.html` |
| Acceso a la app | "Se requiere inicio de sesión". Crea una **cuenta de prueba** con algunos movimientos y pon su correo y contraseña ahí |
| Anuncios | No contiene anuncios |
| Clasificación de contenido | Cuestionario IARC: utilidad o productividad, sin violencia, sin apuestas, sin compras. Resultado esperado: Apto para todos |
| Público objetivo | 18 años o más |
| App financiera | No ofrece préstamos, inversiones, criptomonedas ni banca. Es una herramienta de presupuesto personal |
| Eliminación de cuenta | Sí, desde la app. URL de `delete-account.html` |

### Seguridad de los datos

- **¿Recopila o comparte datos?** Recopila sí; comparte con terceros no.
- **¿Cifrados en tránsito?** Sí (HTTPS).
- **¿El usuario puede pedir la eliminación?** Sí.

| Tipo de dato | Recopilado | Obligatorio | Uso |
|---|---|---|---|
| Correo electrónico | Sí | Sí | Gestión de la cuenta, funcionalidad |
| ID de usuario | Sí | Sí | Gestión de la cuenta |
| Información financiera → otra info financiera (presupuestos y movimientos que escribe el usuario) | Sí | Sí | Funcionalidad de la app |
| Nombre (solo si inicia sesión con Apple o Google) | Sí | No | Gestión de la cuenta |

No se recopilan ubicación, contactos, fotos, audio, identificadores de publicidad ni datos de diagnóstico.

## 5. Notas técnicas

- `app.json` bloquea los permisos que no se usan (almacenamiento, superposición, alarmas exactas). Solo pide `POST_NOTIFICATIONS` para los recordatorios.
- `versionCode` lo incrementa EAS automáticamente en cada build de producción (`appVersionSource: remote`, `autoIncrement`). Cuando cambies funciones visibles, sube `version` en `app.json` (1.0.0 → 1.1.0).

## 6. Regenerar íconos con el logo final

`store/make_icons.py` genera todos los íconos y gráficos. Si me compartes el logo en `assets/logo-fuente.png` (o `.svg`), adapto el script para usarlo en lugar de la hoja provisional.

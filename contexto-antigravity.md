# Finance App — Contexto Completo del Proyecto para Antigravity

## RESUMEN EJECUTIVO

App de finanzas personales en React Native + Expo con bot de Telegram conectado a Supabase. El proyecto tiene 3 componentes: una app móvil Android, un bot de Telegram, y una base de datos PostgreSQL en la nube (Supabase) que los conecta.

**Autor:** Aldair Murillo Mosquera (estudiante de Ingeniería de Software, editor de video y fotógrafo)
**Dispositivo de prueba:** Motorola moto g54 5G + Emulador Pixel 9 Pro XL
**PC de desarrollo:** Windows 11, i5 10th gen + NVIDIA MX250
**Repo:** `https://github.com/Aldairmm18/finance.git`

---

## STACK TÉCNICO

### App Móvil
- **Framework:** React Native 0.83.2 + Expo SDK 55
- **Navegación:** @react-navigation/bottom-tabs 7.x
- **Storage local:** @react-native-async-storage/async-storage 2.2.0
- **Gráficas:** react-native-chart-kit 6.12.0 + react-native-svg 15.x
- **Backend:** @supabase/supabase-js 2.99.0
- **Build:** EAS Build (Expo Application Services)

### Bot de Telegram
- **Lenguaje:** Python 3.11+
- **Bot framework:** python-telegram-bot 22.6 (async)
- **DB client:** supabase-py 2.28.0
- **Config:** python-dotenv

### Base de datos
- **Servicio:** Supabase (PostgreSQL)
- **URL:** `https://scvltqqtkjazopjyauyv.supabase.co`
- **Anon key:** está en `eas.json` y en `telegram-bot/.env`
- **Tablas:** `presupuesto`, `presupuesto_mensual`, `transacciones`, `configuracion`, `telegram_users`
- **Realtime:** habilitado en `transacciones` y `presupuesto_mensual`

---

## ESTRUCTURA DEL PROYECTO

```
finance/
├── App.js                          # Entry point con ThemeProvider + NavigationContainer
├── app.json                        # Config de Expo
├── eas.json                        # Config de EAS Build (contiene Supabase env vars)
├── package.json                    # Dependencias
├── index.js                        # Registro de la app
├── prompt.txt                      # Requisitos originales (histórico)
│
├── src/
│   ├── context/
│   │   └── ThemeContext.js          # Proveedor dark/light con persistencia
│   │
│   ├── hooks/
│   │   └── useRealtimeSync.js      # Suscripción a cambios en `transacciones` via Supabase Realtime
│   │
│   ├── navigation/
│   │   └── TabNavigator.js         # Bottom tabs: Dashboard, Presupuesto, Resumen, Gastos, Config
│   │
│   ├── screens/
│   │   ├── DashboardScreen.js      # Dashboard principal (~835 líneas) — stats, gráficas pie, extraordinarios, FAB
│   │   ├── PresupuestoScreen.js    # Formulario de presupuesto mensual (~539 líneas) — selector de mes
│   │   ├── ResumenMesScreen.js     # Resumen del mes actual (~347 líneas) — progreso por categoría
│   │   ├── GastosScreen.js         # Historial de transacciones (~357 líneas) — filtros, búsqueda, pie chart
│   │   ├── ConfigScreen.js         # Configuración (~227 líneas) — tema, sync, info
│   │   ├── FlujoMensualScreen.js   # ⚠️ EXISTE pero NO está en TabNavigator — RESTAURAR
│   │   └── TranquilidadScreen.js   # ⚠️ EXISTE pero NO está en TabNavigator — mover a Config
│   │
│   ├── services/
│   │   └── supabase.js             # Cliente Supabase inicializado con vars de entorno
│   │
│   └── utils/
│       ├── calculations.js         # COLORS legacy, PERIODICIDADES, parseAmount, toMonthly, toAnnual, formatCOP, computeTotals
│       ├── storage.js              # Toda la lógica de datos: loadData, saveData, loadDataMes, saveDataMes, loadTransaccionesMes, registrarExtraordinario, syncData
│       └── theme.js                # Paletas DARK y LIGHT
│
├── telegram-bot/
│   ├── bot.py                      # Handlers de comandos y texto libre
│   ├── categories.py               # 140+ keywords → (categoria, subcategoria)
│   ├── database.py                 # CRUD con Supabase (zona Colombia UTC-5)
│   ├── finance_parser.py           # Parseo inteligente de mensajes naturales
│   ├── requirements.txt            # python-telegram-bot, supabase, python-dotenv
│   └── .env                        # TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY (gitignoreado)
│
└── assets/                         # Iconos y splash de la app
```

---

## TABLAS DE SUPABASE (SCHEMA ACTUAL)

```sql
-- Presupuesto global (legacy, aún usado por loadData/saveData)
CREATE TABLE presupuesto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  datos JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Presupuesto por mes (cada mes tiene su propio presupuesto independiente)
CREATE TABLE presupuesto_mensual (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  mes TEXT NOT NULL, -- formato: '2026-03'
  datos JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mes)
);

-- Transacciones individuales (del bot y de la app)
CREATE TABLE transacciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  monto DECIMAL(12,2) NOT NULL,
  descripcion TEXT,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  esencial BOOLEAN DEFAULT false,
  periodicidad TEXT DEFAULT 'unico',
  fuente TEXT DEFAULT 'app', -- 'app' | 'telegram_bot'
  es_extraordinario BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración del usuario
CREATE TABLE configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  tema TEXT DEFAULT 'dark',
  datos JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vinculación de usuarios de Telegram (para multi-usuario futuro)
CREATE TABLE telegram_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Realtime habilitado en:
-- ALTER PUBLICATION supabase_realtime ADD TABLE transacciones;
-- ALTER PUBLICATION supabase_realtime ADD TABLE presupuesto_mensual;

-- RLS deshabilitado actualmente (se habilitará con multi-usuario):
-- ALTER TABLE presupuesto DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE transacciones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
```

---

## CATEGORÍAS DEL SISTEMA

### Gastos (usadas en app Y bot)
| Categoría | Subcategorías |
|-----------|--------------|
| hogar | arriendo, administracion, luz, agua, gas, telefono, internet, tv, otro |
| comida | mercado, comidasFuera, otro |
| transporte | gasolina, taxiUber, transportePublico, metro, mantenimientoAuto, seguroAuto, otro |
| creditos | creditoHipotecario, creditoAuto, tarjetaCredito, otro |
| entretenimiento | viajes, restaurantes, diversion, fiesta, appleMusic, ia, otros |
| familia | colegios, seguroMedico, otrosSeguros, suscripciones, gimnasio, impuestos, entretenimiento, otros |

### Ingresos (app)
| Fuente |
|--------|
| salario, bonos, dividendos, comisiones, otros |

---

## HISTORIAL DE LO IMPLEMENTADO (en orden cronológico)

### Fase 1: Sistema de Temas
- ThemeContext con `useTheme()` hook + persistencia en AsyncStorage
- Paleta DARK (original) y LIGHT (premium azul-gris)
- Toggle en pantalla de Configuración
- Todas las pantallas migradas a estilos dinámicos via `useTheme()`

### Fase 2: Mejora de UI/UX
- Dashboard: count-up animado, stagger de entrada, StatCards premium con barra de acento
- Presupuesto: LayoutAnimation para expand/collapse, hints de formateo, badges E/NE como píldoras
- FlujoMensual: borde lateral coloreado, fondo rosado en meses negativos, mini barras relativas
- Tranquilidad: barra de progreso animada con milestones en 25/50/75/100%

### Fase 3: Integración Supabase
- Cliente Supabase con guard (null si no hay vars)
- Estrategia dual: Supabase first (6s timeout) → AsyncStorage fallback
- Sync manual desde Config con indicador de estado
- La app funciona 100% offline

### Bot de Telegram
- Bot @aldair_finance_bot con python-telegram-bot 22.6
- Parseo inteligente: "almuerzo 12000" → gasto, comida > comidasFuera
- Comandos: /start, /hoy, /semana, /mes, /balance, /categorias, /ultimos, /borrar, /ayuda
- 140+ keywords mapeadas a categorías
- Soporte para gastos extraordinarios ("extra multa 200000")
- Zona horaria Colombia UTC-5

### Prioridad 1 (bugs): 
- Dashboard ahora lee transacciones del bot via mergeTransacciones()
- Typos "ano" → "año" corregidos
- Parser mejorado con word boundaries para keywords cortas

### Prioridad 2 (extraordinarios):
- FAB modal permite elegir Gasto o Ingreso extraordinario
- Card de extraordinarios muestra gastos e ingresos separados
- Ingresos extraordinarios afectan totales y gráficas

### Prioridad 3 (presupuesto mensual):
- Cada mes tiene su propio presupuesto independiente
- Selector de mes con flechas en Presupuesto
- Dashboard usa el presupuesto del mes actual

### Prioridad 4 (resumen del mes):
- Nueva pantalla Resumen con progreso por categoría
- Barras de progreso: teal <80%, naranja 80-100%, rosa si excede
- Últimas 12 transacciones + Realtime

### Prioridad 5 (gastos detallados):
- Nueva pantalla Gastos con búsqueda, filtros por tipo/categoría
- PieChart por categoría + lista animada de transacciones
- Selector de mes para ver historial

---

## LO QUE FALTA POR HACER (SIGUIENTE PASO)

### A. Restaurar pantalla Flujo Mensual
`FlujoMensualScreen.js` existe en el código pero fue removida del TabNavigator. **RESTAURARLA** como tab (entre Resumen y Gastos, o accesible desde algún lado).

### B. Categorías de ingresos expandidas
Actualmente los ingresos solo tienen: salario, bonos, dividendos, comisiones, otros.
**AGREGAR** las mismas categorías que los gastos para que los ingresos también se puedan categorizar por:
- hogar, comida, transporte, creditos, entretenimiento, familia, ahorro
- Esto aplica tanto en la app (formularios, Dashboard, gráficas) como en el bot de Telegram
- Ejemplo: un ingreso por "devolución del seguro" → ingreso categorizado en "familia > seguroMedico"
- Ejemplo: un ingreso por "venta del carro" → ingreso categorizado en "transporte > otro"

### C. Prioridad 6: Multi-usuario con Supabase Auth
**Esta es la tarea principal pendiente.** Implementar:

1. **Autenticación con Supabase Auth:**
   - Pantalla de Login/Registro (email + contraseña)
   - Al registrarse, se crea un `user_id` único
   - Todos los datos se asocian al `user_id` autenticado
   - Row Level Security (RLS) en Supabase

2. **Pantalla de Auth:**
   - Login con email/contraseña
   - Registro con email/contraseña
   - "Olvidé mi contraseña"
   - Se muestra ANTES de la app si no hay sesión

3. **Migración del usuario actual:**
   - Datos con `user_id = 'default'` se migran al nuevo user_id al registrarse

4. **Bot multi-usuario:**
   - Vincular cuenta de Telegram con cuenta de la app via `/vincular email`
   - Bot usa chat_id → user_id de la tabla telegram_users
   - Solo guarda datos si el usuario está vinculado

5. **Distribución:**
   - APK via EAS Build
   - Documentar proceso para Google Play Store

---

## CÓMO EJECUTAR

### App (desarrollo)
```bash
cd C:\Users\Aldair Murillo\StudioProjects\finance
npm install
npx expo start --clear
# Presionar 'a' para abrir en Android (emulador o dispositivo conectado)
```

### App (build APK)
```bash
eas build -p android --profile preview
# Genera link para descargar APK
```

### Bot de Telegram
```bash
cd telegram-bot
pip install -r requirements.txt
python bot.py
# El bot necesita .env con TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY
```

### Variables de entorno necesarias

**App (.env en raíz del proyecto):**
```
EXPO_PUBLIC_SUPABASE_URL=https://scvltqqtkjazopjyauyv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<la anon key>
```

**Bot (.env en telegram-bot/):**
```
TELEGRAM_BOT_TOKEN=<token del @aldair_finance_bot>
SUPABASE_URL=https://scvltqqtkjazopjyauyv.supabase.co
SUPABASE_KEY=<la misma anon key>
```

**EAS Build:** Las vars están hardcoded en `eas.json` para los 3 profiles (development, preview, production).

---

## CONVENCIONES DEL PROYECTO

- **Idioma:** Todo el UI en español (Colombia)
- **Moneda:** COP con formato colombiano ($1.500.000)
- **Tema:** Dual dark/light con `useTheme()` hook
- **Offline first:** La app siempre funciona sin internet
- **Git commits:** `feat(scope): descripción`, `fix(scope): descripción`
- **Código:** Limpio, modular, sin over-engineering ni decoración innecesaria
- **Testing:** En Motorola moto g54 5G físico + emulador Pixel 9 Pro XL

---

## INSTRUCCIONES PARA EL AGENTE

1. Antes de modificar cualquier archivo, lee su contenido actual completo
2. Mantener compatibilidad con el sistema de temas (usar `useTheme()`, no hardcodear colores)
3. Mantener la estrategia offline-first (AsyncStorage + Supabase)
4. Hacer commit y push después de cada bloque de cambios
5. Usar el formato de commits establecido
6. Todo texto visible en la app debe ser en español
7. Formato de moneda colombiano (COP) siempre
8. Los archivos `.env` NUNCA deben subirse al repo

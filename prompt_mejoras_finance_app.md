# PROMPT DE EJECUCIÓN — Mejoras Finance App
> Stack: React Native + Expo SDK 55 + Supabase
> Repo: Aldairmm18/finance.git
> Supabase project: scvltqqtkjazopjyauyv.supabase.co

---

## CONTEXTO DEL PROYECTO

- App de finanzas personales en React Native con Expo SDK 55
- Backend: Supabase (auth, base de datos PostgreSQL, RLS, Realtime)
- Las categorías están centralizadas en `categoryTheme.js` mediante las funciones `getCategoryIcon` y `getCategoryColor` — **NUNCA hardcodear emojis o colores fuera de este archivo**
- Tema dark/light manejado por `ThemeContext`
- Las transacciones tienen CRUD completo; long press = eliminar, tap = editar

---

## TAREA GENERAL

Implementar 4 mejoras en la app sin romper funcionalidad existente:

1. Subcategorías personalizadas con CRUD
2. Ingresos recurrentes multi-mes
3. Nueva categoría: Salud
4. Notificaciones de pagos recurrentes con `expo-notifications`

---

## MEJORA 1 — SUBCATEGORÍAS PERSONALIZADAS

### 1.1 — Migración SQL en Supabase

Ejecutar el siguiente SQL en el editor de Supabase:

```sql
-- Tabla de subcategorías personalizadas
CREATE TABLE subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,         -- Ej: 'alimentacion', 'salud', 'transporte'
  name TEXT NOT NULL,
  icon TEXT NOT NULL,                 -- nombre del ícono de @expo/vector-icons
  color TEXT NOT NULL,                -- hex color
  duration_months INT DEFAULT NULL,  -- NULL = sin límite, N = activa N meses
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subcategories"
  ON subcategories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice
CREATE INDEX idx_subcategories_user_category ON subcategories(user_id, category_key);

-- Agregar subcategory_id a transactions (nullable)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;
```

### 1.2 — Archivo: `services/subcategoryService.js` (CREAR)

```javascript
import { supabase } from './supabaseClient';

export const subcategoryService = {
  async getByCategory(userId, categoryKey) {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', userId)
      .eq('category_key', categoryKey)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAll(userId) {
    const { data, error } = await supabase
      .from('subcategories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('category_key', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('subcategories')
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('subcategories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('subcategories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
};
```

### 1.3 — Componente: `components/SubcategoryModal.jsx` (CREAR)

Modal reutilizable para crear y editar subcategorías. Debe contener:

- **Campo:** Nombre de la subcategoría (TextInput)
- **Campo:** Ícono — mostrar un picker con al menos 12 íconos de `@expo/vector-icons/MaterialCommunityIcons` (ej: `food`, `heart`, `car`, `home`, `cart`, `briefcase`, `music`, `gamepad`, `phone`, `dumbbell`, `pill`, `shirt`)
- **Campo:** Color — mostrar una paleta de 10 colores seleccionables como círculos
- **Campo:** Duración en meses — TextInput numérico con label "¿Cuántos meses aplica? (dejar vacío = sin límite)"
- **Botón:** Guardar / Actualizar
- **Botón:** Cancelar

Props:
```javascript
{
  visible: bool,
  onClose: fn,
  onSave: fn(subcategoryData),
  categoryKey: string,       // categoría padre
  editData: object | null    // null = crear, objeto = editar
}
```

### 1.4 — Modificar `BudgetScreen.jsx`

En la pantalla de presupuesto, dentro de cada fila de categoría agregar:

- Ícono de chevron / flecha expandible
- Al expandir, mostrar las subcategorías activas de esa categoría (leer de Supabase con `subcategoryService.getByCategory`)
- Botón "+" al lado del nombre de la categoría para abrir `SubcategoryModal` en modo creación
- Long press sobre una subcategoría → opciones: **Editar** | **Eliminar**
- Al eliminar, hacer soft delete (`is_active = false`) y refrescar la lista

---

## MEJORA 2 — INGRESOS RECURRENTES

### 2.1 — Migración SQL en Supabase

```sql
-- Agregar columnas a transactions para manejar recurrencia
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurrence_months INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID DEFAULT NULL;

-- Índice para agrupar recurrentes
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence ON transactions(recurrence_group_id);
```

### 2.2 — Lógica en `services/transactionService.js` (MODIFICAR)

Agregar función `createRecurringIncome`:

```javascript
import { v4 as uuidv4 } from 'uuid'; // o usar crypto.randomUUID()

async function createRecurringIncome(userId, baseTransaction, recurrenceMonths) {
  const groupId = crypto.randomUUID();
  const transactions = [];

  for (let i = 0; i < recurrenceMonths; i++) {
    const date = new Date(baseTransaction.date);
    date.setMonth(date.getMonth() + i);

    transactions.push({
      ...baseTransaction,
      user_id: userId,
      date: date.toISOString().split('T')[0],
      recurrence_months: recurrenceMonths,
      recurrence_group_id: groupId
    });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) throw error;
  return data;
}
```

### 2.3 — Modificar `TransactionModal.jsx`

Cuando `type === 'income'` (ingreso):

1. Después de completar el formulario normal, antes de guardar mostrar un **segundo paso** dentro del mismo modal o un Alert/Modal secundario con:
   - Pregunta: *"¿Este ingreso se repite? ¿Durante cuántos meses?"*
   - Selector numérico (TextInput o picker de 1 a 60)
   - Opción "No se repite" (valor = 1, solo el mes actual)

2. Si `recurrenceMonths > 1`, llamar a `createRecurringIncome` en lugar del `insert` normal.

3. Si la transacción pertenece a un `recurrence_group_id`, al editarla preguntar:
   - *"¿Editar solo este mes o todos los meses futuros?"*
   - Implementar ambas opciones.

---

## MEJORA 3 — NUEVA CATEGORÍA: SALUD

### 3.1 — Modificar `categoryTheme.js`

Agregar `salud` al objeto de categorías. Seguir exactamente el mismo patrón que las categorías existentes:

```javascript
salud: {
  icon: 'heart-pulse',           // MaterialCommunityIcons
  color: '#EF4444',              // rojo salud
  label: 'Salud',
}
```

Asegurarse de que `getCategoryIcon('salud')` y `getCategoryColor('salud')` retornen los valores correctos.

### 3.2 — Verificar en todas las pantallas

Buscar todos los lugares donde se listan categorías hardcodeadas (ej: arrays de categorías en filtros, pickers, BudgetScreen) y agregar `salud` a esas listas si aplica.

---

## MEJORA 4 — NOTIFICACIONES DE PAGOS RECURRENTES

### 4.1 — Instalación

```bash
npx expo install expo-notifications expo-device
```

### 4.2 — Migración SQL en Supabase

```sql
CREATE TABLE recurring_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Ej: "Apple Music", "Plan de datos"
  amount NUMERIC(12,2) NOT NULL,
  category_key TEXT NOT NULL,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  day_of_month INT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  notify_days_before INT DEFAULT 3,     -- Con cuántos días de anticipación notificar
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring payments"
  ON recurring_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 4.3 — Archivo: `services/notificationService.js` (CREAR)

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  async requestPermissions() {
    if (!Device.isDevice) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pagos', {
        name: 'Pagos recurrentes',
        importance: Notifications.AndroidImportance.HIGH,
        sound: true,
      });
    }
  },

  async schedulePaymentReminder(payment) {
    // Calcular próxima fecha de pago
    const now = new Date();
    let paymentDate = new Date(now.getFullYear(), now.getMonth(), payment.day_of_month);
    if (paymentDate <= now) {
      paymentDate.setMonth(paymentDate.getMonth() + 1);
    }

    const notifyDate = new Date(paymentDate);
    notifyDate.setDate(notifyDate.getDate() - payment.notify_days_before);

    if (notifyDate <= now) return null; // Ya pasó

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💳 Pago próximo',
        body: `${payment.name} — $${payment.amount.toLocaleString()} se cobra el día ${payment.day_of_month}`,
        data: { paymentId: payment.id },
        channelId: 'pagos',
      },
      trigger: {
        date: notifyDate,
      },
    });
    return id;
  },

  async cancelAllPaymentNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  async rescheduleAll(payments) {
    await this.cancelAllPaymentNotifications();
    for (const p of payments.filter(p => p.is_active)) {
      await this.schedulePaymentReminder(p);
    }
  }
};
```

### 4.4 — Archivo: `services/recurringPaymentService.js` (CREAR)

```javascript
import { supabase } from './supabaseClient';

export const recurringPaymentService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .select('*, subcategories(name, icon, color)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('day_of_month', { ascending: true });
    if (error) throw error;
    return data;
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('recurring_payments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('recurring_payments')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  }
};
```

### 4.5 — Pantalla: `screens/RecurringPaymentsScreen.jsx` (CREAR)

Pantalla completa de gestión de pagos recurrentes. Debe incluir:

- Lista de pagos recurrentes del usuario ordenados por `day_of_month`
- Cada ítem muestra: nombre, monto, día de cobro, días de anticipación para notificar, ícono/color de categoría
- FAB (botón flotante "+") para agregar nuevo pago
- Long press sobre un ítem → opciones: **Editar** | **Eliminar**
- Modal de creación/edición con campos:
  - Nombre del pago (TextInput)
  - Monto (TextInput numérico)
  - Categoría (picker con las categorías de `categoryTheme.js`)
  - Subcategoría (picker opcional, cargar según categoría seleccionada)
  - Día del mes en que se cobra (1–31)
  - Días de anticipación para notificar (default: 3)
- Al guardar/editar, llamar a `notificationService.rescheduleAll` con la lista actualizada
- Al eliminar, ídem

### 4.6 — Inicialización en `App.jsx` o pantalla principal

Al iniciar la app (después de autenticar al usuario):

```javascript
import { notificationService } from './services/notificationService';
import { recurringPaymentService } from './services/recurringPaymentService';

// En useEffect post-auth:
const granted = await notificationService.requestPermissions();
if (granted) {
  const payments = await recurringPaymentService.getAll(user.id);
  await notificationService.rescheduleAll(payments);
}
```

### 4.7 — Agregar navegación a `RecurringPaymentsScreen`

Agregar la pantalla al stack/tab navigator existente. El acceso puede ser desde:
- Un ítem en el menú de configuración / perfil, o
- Una pestaña nueva en el tab navigator (ícono sugerido: `bell-ring` de MaterialCommunityIcons)

---

## REGLAS GENERALES — NO ROMPER

1. **NO** hardcodear colores, íconos o emojis de categorías fuera de `categoryTheme.js`
2. **NO** modificar la lógica de RLS de Supabase existente — solo agregar nuevas políticas
3. **NO** cambiar el sistema de auth ni el flujo de login/registro
4. **Toda nueva tabla** debe tener RLS habilitado y política por `user_id`
5. Mantener el estilo visual existente: usar las variables de `ThemeContext` para todos los colores UI
6. Todos los `catch` deben mostrar error legible al usuario (Alert o toast), no solo `console.error`
7. Las nuevas pantallas deben respetar `SafeAreaView` y el padding del header existente

---

## ORDEN DE EJECUCIÓN SUGERIDO

```
1. Ejecutar SQLs en Supabase (mejoras 1, 2 y 4)
2. Modificar categoryTheme.js (mejora 3)
3. Crear subcategoryService.js
4. Crear SubcategoryModal.jsx
5. Modificar BudgetScreen.jsx
6. Modificar TransactionModal.jsx + transactionService.js
7. Crear notificationService.js
8. Crear recurringPaymentService.js
9. Crear RecurringPaymentsScreen.jsx
10. Modificar App.jsx (inicialización de notificaciones)
11. Modificar navegación (agregar RecurringPaymentsScreen)
```

import React from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { TYPE, NUM, RADIUS, SPACE } from '../theme/tokens';
import { formatCOP } from '../utils/calculations';
import { mesLabel, addMes } from '../utils/dateUtils';

export const TAB_BAR_HEIGHT = 64;

// ─── Texto ───────────────────────────────────────────────────────────────────

export function Txt({ variant = 'body', color, muted, faint, center, style, children, ...rest }) {
  const { colors: C } = useTheme();
  const tone = color || (faint ? C.textFaint : muted ? C.textMuted : C.text);
  return (
    <Text style={[TYPE[variant], { color: tone }, center && { textAlign: 'center' }, style]} {...rest}>
      {children}
    </Text>
  );
}

/** Monto en COP con cifras tabulares. sign: muestra + / − explícitos. */
export function Money({ value, variant = 'body', color, sign = false, style, ...rest }) {
  const n = Number(value) || 0;
  const prefix = sign && n > 0 ? '+' : '';
  return (
    <Txt variant={variant} color={color} style={[NUM, style]} numberOfLines={1} {...rest}>
      {prefix}{formatCOP(n)}
    </Txt>
  );
}

// ─── Estructura de pantalla ──────────────────────────────────────────────────

/** withTopInset=false para pantallas que ya tienen cabecera de navegación. */
export function Screen({ children, scroll = true, refreshing, onRefresh, contentStyle, withTopInset = true, keyboardShouldPersistTaps = 'handled' }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: (withTopInset ? insets.top : 0) + SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.xxl * 2 + (withTopInset ? 0 : insets.bottom),
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: C.bg }, padding, contentStyle]}>{children}</View>;
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[padding, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.textMuted} colors={[C.brand]} />
        ) : undefined}
      >
        {children}
      </ScrollView>
      {withTopInset ? <StatusBarBackdrop /> : null}
    </View>
  );
}

/** Fondo bajo la barra de estado para que el contenido no se vea detrás de la hora al hacer scroll. */
export function StatusBarBackdrop() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg }}
    />
  );
}

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: SPACE.xl }}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Txt variant="label" muted style={{ marginBottom: 2 }}>{subtitle}</Txt> : null}
        <Txt variant="title" accessibilityRole="header">{title}</Txt>
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: SPACE.xs }}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction, style }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xl, marginBottom: SPACE.sm }, style]}>
      <Txt variant="heading">{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          {({ pressed }) => <Txt variant="label" color={C.brand} style={{ opacity: pressed ? 0.6 : 1 }}>{action}</Txt>}
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style, padded = true }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{
      backgroundColor: C.card,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    }, padded && { padding: SPACE.lg }, style]}>
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }) {
  const { colors: C } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.divider, marginLeft: inset }} />;
}

// ─── Controles ───────────────────────────────────────────────────────────────

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, accessibilityLabel }) {
  const { colors: C } = useTheme();
  const palette = {
    primary:   { bg: C.brand, fg: C.onBrand, border: C.brand },
    secondary: { bg: C.card, fg: C.text, border: C.border },
    ghost:     { bg: 'transparent', fg: C.brand, border: 'transparent' },
    danger:    { bg: 'transparent', fg: C.expense, border: C.border },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [{
        minHeight: 48,
        borderRadius: RADIUS.md,
        backgroundColor: palette.bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE.sm,
        paddingHorizontal: SPACE.lg,
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <Txt variant="label" color={palette.fg} style={{ fontSize: 15, fontWeight: '600' }}>{title}</Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color, size = 22 }) {
  const { colors: C } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? C.sunken : 'transparent',
      })}
    >
      <Ionicons name={icon} size={size} color={color || C.text} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }) {
  const { colors: C } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6,
        minHeight: 36, paddingHorizontal: 14, borderRadius: 18,
        backgroundColor: selected ? C.text : C.sunken,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? C.bg : C.textMuted} /> : null}
      <Txt variant="label" color={selected ? C.bg : C.text}>{label}</Txt>
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: C.sunken, borderRadius: RADIUS.md, padding: 3 }, style]} accessibilityRole="tablist">
      {options.map(opt => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center',
              borderRadius: RADIUS.sm + 1,
              backgroundColor: active ? C.card : 'transparent',
            }}
          >
            <Txt variant="label" color={active ? (opt.color || C.text) : C.textMuted}>{opt.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ ratio, color, height = 6 }) {
  const { colors: C } = useTheme();
  const clamped = Math.max(0, Math.min(Number.isFinite(ratio) ? ratio : 1, 1));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.sunken, overflow: 'hidden' }}>
      <View style={{ width: `${clamped * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color || C.brand }} />
    </View>
  );
}

export function IconBadge({ icon, color, size = 36 }) {
  const { colors: C } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.3,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.sunken,
    }}>
      <Ionicons name={icon} size={size * 0.5} color={color || C.textMuted} />
    </View>
  );
}

export function EmptyState({ icon, title, body, actionLabel, onAction }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.lg }}>
      <Ionicons name={icon} size={28} color={C.textFaint} style={{ marginBottom: SPACE.md }} />
      <Txt variant="heading" center style={{ marginBottom: SPACE.xs }}>{title}</Txt>
      {body ? <Txt muted center style={{ lineHeight: 21 }}>{body}</Txt> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} variant="secondary" style={{ marginTop: SPACE.lg }} /> : null}
    </View>
  );
}

export function Field({ label, hint, error, style, inputStyle, suffix, ...inputProps }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{ marginBottom: SPACE.lg }, style]}>
      {label ? <Txt variant="label" muted style={{ marginBottom: 6 }}>{label}</Txt> : null}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.sunken, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: error ? C.expense : 'transparent',
        paddingHorizontal: SPACE.md,
      }}>
        <TextInput
          placeholderTextColor={C.textFaint}
          style={[{ flex: 1, minHeight: 48, fontSize: 16, color: C.text }, inputStyle]}
          {...inputProps}
        />
        {suffix ? <Txt muted style={{ marginLeft: SPACE.sm }}>{suffix}</Txt> : null}
      </View>
      {error ? <Txt variant="caption" color={C.expense} style={{ marginTop: 6 }}>{error}</Txt>
        : hint ? <Txt variant="caption" muted style={{ marginTop: 6 }}>{hint}</Txt> : null}
    </View>
  );
}

export function MonthSwitcher({ mes, onChange, max }) {
  const { colors: C } = useTheme();
  const canNext = !max || mes < max;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton icon="chevron-back" label="Mes anterior" onPress={() => onChange(addMes(mes, -1))} color={C.textMuted} />
      <Txt variant="heading" accessibilityLiveRegion="polite">{mesLabel(mes)}</Txt>
      <View style={{ opacity: canNext ? 1 : 0.3 }} pointerEvents={canNext ? 'auto' : 'none'}>
        <IconButton icon="chevron-forward" label="Mes siguiente" onPress={() => onChange(addMes(mes, 1))} color={C.textMuted} />
      </View>
    </View>
  );
}

// ─── Hoja inferior ───────────────────────────────────────────────────────────

export function Sheet({ visible, onClose, title, children, footer }) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={{
          backgroundColor: C.card,
          borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
          maxHeight: '92%',
          paddingBottom: Math.max(insets.bottom, SPACE.lg),
        }}>
          <View style={{ alignItems: 'center', paddingTop: SPACE.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: SPACE.xl, paddingRight: SPACE.sm, paddingTop: SPACE.sm }}>
            <Txt variant="heading" accessibilityRole="header">{title}</Txt>
            <IconButton icon="close" label="Cerrar" onPress={onClose} color={C.textMuted} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.sm, paddingBottom: SPACE.sm }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: SPACE.xl, paddingTop: SPACE.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Fila tocable genérica para listas de ajustes. */
export function ListRow({ icon, title, subtitle, value, onPress, destructive, right }) {
  const { colors: C } = useTheme();
  const content = (pressed) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: SPACE.sm, gap: SPACE.md, opacity: pressed ? 0.6 : 1 }}>
      {icon ? <Ionicons name={icon} size={20} color={destructive ? C.expense : C.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Txt color={destructive ? C.expense : C.text}>{title}</Txt>
        {subtitle ? <Txt variant="caption" muted style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      </View>
      {value ? <Txt muted>{value}</Txt> : null}
      {right}
      {onPress && !right && !destructive ? <Ionicons name="chevron-forward" size={16} color={C.textFaint} /> : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

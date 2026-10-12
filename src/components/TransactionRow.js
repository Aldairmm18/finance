import React, { memo } from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Txt, Money, IconBadge } from './ui';
import { categoryIcon, categoryLabel, categoryColor } from '../utils/categories';
import { dayLabel } from '../utils/dateUtils';
import { SPACE } from '../theme/tokens';

function TransactionRow({ tx, onPress, showDate = true }) {
  const { colors: C, mode } = useTheme();
  const isIngreso = tx.tipo === 'ingreso';
  const label = categoryLabel(tx.categoria);
  const title = tx.descripcion?.trim() || label;
  const meta = showDate ? `${label} · ${dayLabel(tx.fecha)}` : label;

  return (
    <Pressable
      onPress={onPress ? () => onPress(tx) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${isIngreso ? 'ingreso' : 'gasto'}, ${meta}`}
      accessibilityHint={onPress ? 'Abre el movimiento para editarlo' : undefined}
    >
      {({ pressed }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, opacity: pressed ? 0.6 : 1 }}>
          <IconBadge icon={categoryIcon(tx.categoria)} color={categoryColor(tx.categoria, mode)} />
          <View style={{ flex: 1 }}>
            <Txt numberOfLines={1}>{title}</Txt>
            <Txt variant="caption" muted style={{ marginTop: 2 }} numberOfLines={1}>{meta}</Txt>
          </View>
          <Money
            value={isIngreso ? tx.monto : -(Number(tx.monto) || 0)}
            sign
            color={isIngreso ? C.income : C.text}
            style={{ fontWeight: '500' }}
          />
        </View>
      )}
    </Pressable>
  );
}

export default memo(TransactionRow);

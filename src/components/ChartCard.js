import React from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ChartCard({ title, accentColor, animVal, children }) {
  const { colors: C } = useTheme();
  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  } : {};
  return (
    <Animated.View style={[
      { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 12 },
      animStyle,
    ]}>
      <View style={{ height: 3, backgroundColor: accentColor }} />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }}>
          {title}
        </Text>
        {children}
      </View>
    </Animated.View>
  );
}

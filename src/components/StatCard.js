import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function useCountUp(target, triggerKey, duration = 850) {
  const [val, setVal] = useState(0);
  const frameRef = useRef(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const t0 = targetRef.current;
    if (!t0) { setVal(0); return; }
    setVal(0);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) { setVal(t0); return; }
      const progress = elapsed / duration;
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(t0 * eased));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [triggerKey, duration]);

  return val;
}

export default function StatCard({ label, value, sub, accentColor, half, animVal }) {
  const { colors: C } = useTheme();
  const animStyle = animVal ? {
    opacity: animVal,
    transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  } : {};
  return (
    <Animated.View style={[
      {
        backgroundColor: C.card,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        marginBottom: 10,
        flexDirection: 'row',
      },
      half && { flex: 1 },
      animStyle,
    ]}>
      <View style={{ flex: 1, padding: 14 }}>
        <Text style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 6 }}>
          {label}
        </Text>
        <Text
          style={{ fontSize: 22, fontWeight: '900', color: accentColor, letterSpacing: -0.5 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {value}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

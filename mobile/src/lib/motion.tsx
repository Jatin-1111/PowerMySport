import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * The app's motion, in one place. Subtle on purpose: short, no bounce, small distances.
 * Everything here follows the phone's "reduce motion" setting (ReduceMotion.System), so people
 * who turn it on get no movement at all.
 */
export const MOTION = {
  /** Entrance of a section or row. */
  enterMs: 260,
  /** How far an entrance rises, in px. */
  rise: 8,
  /** Delay between neighbours in a list, capped so a long list never feels slow. */
  staggerMs: 40,
  maxStaggerSteps: 6,
  pressMs: 110,
  pressScale: 0.98,
} as const;

/** Fades in and rises a few px when it first appears. `index` staggers siblings. */
export function Reveal({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const step = Math.min(index, MOTION.maxStaggerSteps);
  return (
    <Animated.View
      entering={FadeInDown.delay(step * MOTION.staggerMs)
        .duration(MOTION.enterMs)
        .withInitialValues({ opacity: 0, transform: [{ translateY: MOTION.rise }] })
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A pressable that eases down to a slightly smaller size while held. Layout classes go on the
 * inner pressable via `className`; `style` is for the outer wrapper (sizing within a flex row).
 */
export function PressableScale({
  className,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableProps & { className?: string; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const to = (value: number) => {
    scale.value = withTiming(value, {
      duration: MOTION.pressMs,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  };
  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        {...rest}
        className={className}
        onPressIn={(e) => {
          to(MOTION.pressScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          to(1);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

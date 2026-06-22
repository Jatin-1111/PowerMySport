import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, Zap } from 'lucide-react-native';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { authApi } from '@/modules/auth/services/auth';
import { useAuthStore } from '@/modules/auth/store/authStore';
import { COLORS } from '@lib/constants';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, setToken } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
      } else {
        Alert.alert('Login Failed', res.message || 'Invalid credentials');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6">
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-deep-slate items-center justify-center mb-4">
              <Zap size={32} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            </View>
            <Text className="text-3xl font-bold text-deep-slate">PowerMySport</Text>
            <Text className="text-base text-muted mt-1">India's Sports Platform</Text>
          </View>

          {/* Heading */}
          <Text className="text-2xl font-bold text-foreground mb-1">Welcome back</Text>
          <Text className="text-muted mb-8">Sign in to your account</Text>

          {/* Form */}
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: '' }));
            }}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
            leftIcon={<Mail size={18} color={COLORS.muted} />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: '' }));
            }}
            secureTextEntry
            autoComplete="password"
            error={errors.password}
            leftIcon={<Lock size={18} color={COLORS.muted} />}
          />

          <TouchableOpacity
            className="self-end -mt-2 mb-6"
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text className="text-sm font-medium text-power-orange">Forgot password?</Text>
          </TouchableOpacity>

          <Button onPress={handleLogin} loading={loading} size="lg">
            Sign In
          </Button>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="mx-4 text-sm text-muted">or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Google Login placeholder */}
          <Button
            variant="outline"
            size="lg"
            onPress={() => Alert.alert('Coming Soon', 'Google Sign-In will be available soon.')}
          >
            Continue with Google
          </Button>

          {/* Register link */}
          <View className="flex-row items-center justify-center mt-8">
            <Text className="text-muted">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-power-orange font-semibold">Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

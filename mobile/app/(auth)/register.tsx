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
import { Mail, Lock, User, Phone, Zap } from 'lucide-react-native';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { authApi } from '@/modules/auth/services/auth';
import { useAuthStore } from '@/modules/auth/store/authStore';
import { COLORS } from '@lib/constants';
import type { UserRole } from '@/types';

const ROLES: { label: string; value: UserRole; description: string }[] = [
  { label: 'Player', value: 'PLAYER', description: 'Book coaches & venues' },
  { label: 'Coach', value: 'COACH', description: 'Offer coaching sessions' },
  { label: 'Venue Owner', value: 'VENUE_LISTER', description: 'List your sports facility' },
  { label: 'Academy Owner', value: 'ACADEMY_OWNER', description: 'Manage your academy' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser, setToken } = useAuthStore();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PLAYER' as UserRole,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || undefined,
      });
      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
      } else {
        Alert.alert('Registration Failed', res.message || 'Unable to create account');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Registration failed. Please try again.');
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
          <View className="flex-row items-center gap-3 mb-8">
            <View className="w-10 h-10 rounded-xl bg-deep-slate items-center justify-center">
              <Zap size={20} color={COLORS.powerOrange} fill={COLORS.powerOrange} />
            </View>
            <Text className="text-xl font-bold text-deep-slate">PowerMySport</Text>
          </View>

          <Text className="text-2xl font-bold text-foreground mb-1">Create account</Text>
          <Text className="text-muted mb-8">Join thousands of athletes</Text>

          {/* Role Selection */}
          <Text className="text-sm font-medium text-foreground mb-3">I am a...</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role.value}
                onPress={() => setForm((f) => ({ ...f, role: role.value }))}
                className={`flex-row items-center px-4 py-2.5 rounded-xl border ${
                  form.role === role.value
                    ? 'bg-deep-slate border-deep-slate'
                    : 'bg-white border-border'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    form.role === role.value ? 'text-white' : 'text-foreground'
                  }`}
                >
                  {role.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <Input
            label="Full Name"
            placeholder="John Smith"
            value={form.name}
            onChangeText={(v) => update('name', v)}
            autoComplete="name"
            autoCapitalize="words"
            error={errors.name}
            leftIcon={<User size={18} color={COLORS.muted} />}
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
            leftIcon={<Mail size={18} color={COLORS.muted} />}
          />
          <Input
            label="Phone (optional)"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChangeText={(v) => update('phone', v)}
            keyboardType="phone-pad"
            autoComplete="tel"
            leftIcon={<Phone size={18} color={COLORS.muted} />}
          />
          <Input
            label="Password"
            placeholder="Min. 6 characters"
            value={form.password}
            onChangeText={(v) => update('password', v)}
            secureTextEntry
            error={errors.password}
            leftIcon={<Lock size={18} color={COLORS.muted} />}
          />

          <Button onPress={handleRegister} loading={loading} size="lg">
            Create Account
          </Button>

          {/* Login link */}
          <View className="flex-row items-center justify-center mt-6">
            <Text className="text-muted">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text className="text-power-orange font-semibold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

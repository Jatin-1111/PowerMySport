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
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { authApi } from '@/modules/auth/services/auth';
import { COLORS } from '@lib/constants';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      if (res.success) {
        setSent(true);
      } else {
        Alert.alert('Error', res.message || 'Unable to send reset email');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Request failed. Please try again.');
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
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white items-center justify-center mb-8 shadow-sm"
          >
            <ArrowLeft size={20} color={COLORS.foreground} />
          </TouchableOpacity>

          {sent ? (
            <View className="items-center py-12">
              <View className="w-20 h-20 rounded-full bg-turf-green/15 items-center justify-center mb-6">
                <CheckCircle size={40} color={COLORS.turfGreen} />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-2 text-center">
                Check your inbox
              </Text>
              <Text className="text-muted text-center mb-8 leading-relaxed">
                We've sent a password reset link to{' '}
                <Text className="font-semibold text-foreground">{email}</Text>
              </Text>
              <Button variant="outline" size="lg" onPress={() => router.replace('/(auth)/login')}>
                Back to Sign In
              </Button>
            </View>
          ) : (
            <>
              <Text className="text-2xl font-bold text-foreground mb-1">Forgot password?</Text>
              <Text className="text-muted mb-8 leading-relaxed">
                Enter your email and we'll send you a link to reset your password.
              </Text>

              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError('');
                }}
                keyboardType="email-address"
                autoComplete="email"
                error={error}
                leftIcon={<Mail size={18} color={COLORS.muted} />}
              />

              <Button onPress={handleSubmit} loading={loading} size="lg">
                Send Reset Link
              </Button>

              <View className="flex-row items-center justify-center mt-6">
                <Text className="text-muted">Remember your password? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text className="text-power-orange font-semibold">Sign in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

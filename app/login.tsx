import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react-native';
import { COLORS, API_BASE_URL } from '@/lib/config';
import { setAuthSession, getAuthSession } from '@/lib/storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Offline fallback accounts from .env
const LOCAL_ACCOUNTS = [
  { username: 'admin', password: '$Hr@786', role: 'admin' as const },
  { username: 'ashiq', password: 'Ashiq@786', role: 'surveyor' as const },
  { username: 'didar', password: 'Didar@786', role: 'surveyor' as const },
  { username: 'ahmad', password: 'Ahmad@786', role: 'surveyor' as const },
  { username: 'mahmud', password: 'Mahmud@786', role: 'surveyor' as const }
];

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in, redirect to dashboard
    getAuthSession().then(session => {
      if (session && session.isLoggedIn) {
        router.replace('/(tabs)');
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('ত্রুটি', 'ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন');
      return;
    }

    // Check connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('কানেকশন নেই', 'লগইন করার জন্য ইন্টারনেট সংযোগ প্রয়োজন। আপনার মোবাইল ডাটা বা ওয়াই-ফাই চালু করুন।');
      return;
    }

    setLoading(true);
    const normalizedUsername = username.trim().toLowerCase();

    try {
      // Attempt online authentication with Next.js backend
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        username: normalizedUsername,
        password: password,
      }, {
        timeout: 8000 // 8 seconds timeout
      });

      if (response.data && response.data.success) {
        const role = normalizedUsername === 'admin' ? 'admin' : 'surveyor';
        
        // Fetch and cache initial surveys database dump for local-first use
        try {
          const surveysRes = await axios.get(`${API_BASE_URL}/api/surveys?limit=3000`, { timeout: 12000 });
          if (surveysRes.data && surveysRes.data.success) {
            const { saveCachedSurveys } = require('@/lib/storage');
            saveCachedSurveys(surveysRes.data.data);
          }
        } catch (e: any) {
          console.log('Failed to pull initial surveys dump:', e.message);
        }

        await setAuthSession({
          username: normalizedUsername,
          role,
          isLoggedIn: true,
        });
        setLoading(false);
        router.replace('/(tabs)');
        return;
      } else {
        setLoading(false);
        Alert.alert('লগইন ব্যর্থ', 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
      }
    } catch (error: any) {
      setLoading(false);
      console.log('Online login failed:', error.message);
      if (error.response && error.response.status === 401) {
        Alert.alert('লগইন ব্যর্থ', 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
      } else {
        Alert.alert('সার্ভার ত্রুটি', 'সার্ভার সংযোগে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>মাকতাব সার্ভে সিস্টেম</Text>
            <Text style={styles.subtitle}>আফটার স্কুল মাকতাব - লগইন করুন</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ইউজারনেম</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="আপনার ইউজারনেম দিন"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>পাসওয়ার্ড</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={COLORS.primary} />
                  ) : (
                    <Eye size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View style={styles.btnContent}>
                  <Lock size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.loginBtnText}>লগইন করুন</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              সিস্টেম সম্পর্কিত তথ্যের জন্য এডমিনের সাথে যোগাযোগ করুন।
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logoImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  form: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
});

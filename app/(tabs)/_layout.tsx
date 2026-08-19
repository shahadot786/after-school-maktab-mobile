import React, { useState, useEffect } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { Home, PlusCircle, Settings, LayoutDashboard } from 'lucide-react-native';
import { COLORS } from '@/lib/config';
import { getAuthSession } from '@/lib/storage';

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  const segments = useSegments();

  // Reload admin state whenever active segments change to ensure instant role update on login/logout
  useEffect(() => {
    getAuthSession().then(session => {
      if (session && session.isLoggedIn && session.role === 'admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
  }, [segments]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.submit,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: COLORS.white,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 16,
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ড্যাশবোর্ড',
          headerShown: false,
          tabBarLabel: 'হোম',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'বিশ্লেষণ ড্যাশবোর্ড',
          headerShown: false,
          tabBarLabel: 'বিশ্লেষণ',
          href: isAdmin ? '/dashboard' : null,
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'নতুন সার্ভে ফর্ম',
          tabBarLabel: 'নতুন সার্ভে',
          tabBarIcon: ({ color, size }) => (
            <PlusCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'সেটিংস',
          tabBarLabel: 'সেটিংস',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

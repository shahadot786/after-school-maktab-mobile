import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import {
  CloudUpload,
  Wifi,
  WifiOff,
  Trash2,
  CheckCircle2,
  User,
  LogOut,
  Settings,
  Database,
} from 'lucide-react-native';
import { COLORS } from '@/lib/config';
import {
  getOfflineQueue,
  removeFromOfflineQueue,
  Survey,
  getAuthSession,
  clearAuthSession,
  saveCachedSurveys,
} from '@/lib/storage';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

export default function SettingsScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<Survey[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Profile state
  const [username, setUsername] = useState('—');
  const [role, setRole] = useState('—');

  const loadQueue = () => {
    const offlineQueue = getOfflineQueue();
    setQueue(offlineQueue);
  };

  const loadProfile = async () => {
    const session = await getAuthSession();
    if (session) {
      setUsername(session.username);
      setRole(session.role === 'admin' ? 'এডমিন' : 'সার্ভেয়ার');
    }
  };

  useEffect(() => {
    loadQueue();
    loadProfile();

    // Check connectivity on load
    NetInfo.fetch().then(state => {
      setIsOnline(!!state.isConnected);
    });

    // Monitor network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Sync triggered manually (performs two-way upload and download)
  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('কানেকশন নেই', 'ডাটাসেন্টার সিঙ্ক করার জন্য ইন্টারনেট সংযোগ প্রয়োজন। আপনার মোবাইল ডাটা বা ওয়াই-ফাই চালু করুন।');
      return;
    }

    if (queue.length > 0) {
      Alert.alert('সিঙ্ক শুরু করুন', `আপনি কি ${toBengaliNumber(queue.length)}টি অফলাইন ফর্ম আপলোড এবং ডাটাসেন্টার থেকে সর্বশেষ তথ্য সিঙ্ক করতে চান?`, [
        { text: 'বাতিল', style: 'cancel' },
        { text: 'সিঙ্ক করুন', onPress: startSyncing }
      ]);
    } else {
      Alert.alert('সিঙ্ক শুরু করুন', 'আপনি কি ডাটাসেন্টার থেকে সর্বশেষ তথ্য সিঙ্ক করতে চান?', [
        { text: 'বাতিল', style: 'cancel' },
        { text: 'সিঙ্ক করুন', onPress: startSyncing }
      ]);
    }
  };

  const startSyncing = async () => {
    setSyncing(true);
    let successCount = 0;
    let failCount = 0;
    const total = queue.length;

    // 1. Upload local offline pending data (if any)
    if (total > 0) {
      for (let i = 0; i < total; i++) {
        const survey = queue[i];
        setProgressMsg(`আপলোড হচ্ছে (${toBengaliNumber(i + 1)}/${toBengaliNumber(total)}): ${survey.student_name}...`);

        try {
          const { _id, isOfflinePending, ...payload } = survey;
          const isLocalId = _id && _id.startsWith('local_');

          const url = isLocalId 
            ? `${API_BASE_URL}/api/surveys` 
            : `${API_BASE_URL}/api/surveys/${_id}`;

          const response = isLocalId
            ? await axios.post(url, payload, { timeout: 8000 })
            : await axios.patch(url, payload, { timeout: 8000 });

          if (response.data && response.data.success) {
            if (survey._id) {
              removeFromOfflineQueue(survey._id);
            }
            successCount++;
          } else {
            failCount++;
          }
        } catch (err: any) {
          console.error('Failed to upload survey ID:', survey._id, err.message);
          failCount++;
        }
      }
    }

    // 2. Fetch fresh data from server to cache locally
    setProgressMsg('ডাটাসেন্টার থেকে সর্বশেষ তথ্য নামানো হচ্ছে...');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/surveys?limit=3000`, {
        timeout: 10000
      });
      if (response.data && response.data.success) {
        const remoteSurveys: Survey[] = response.data.data;
        saveCachedSurveys(remoteSurveys);
      }
    } catch (e: any) {
      console.log('Failed to fetch from server during sync:', e.message);
    }

    setSyncing(false);
    setProgressMsg('');
    loadQueue(); // Refresh queue list

    if (total > 0) {
      if (failCount === 0) {
        Alert.alert('সিঙ্ক সফল', `সবগুলো (${toBengaliNumber(successCount)}টি) অফলাইন ফর্ম আপলোড করা হয়েছে এবং ডাটাসেন্টার থেকে সর্বশেষ তথ্য সিঙ্ক করা হয়েছে।`);
      } else {
        Alert.alert(
          'সিঙ্ক সমাপ্ত',
          `${toBengaliNumber(successCount)}টি ফর্ম আপলোড হয়েছে। ${toBengaliNumber(failCount)}টি ফর্ম আপলোড করতে সমস্যা হয়েছে। ডাটাসেন্টার ডাউনলোড সিঙ্ক সম্পন্ন হয়েছে।`
        );
      }
    } else {
      Alert.alert('সিঙ্ক সফল', 'ডাটাসেন্টার থেকে সর্বশেষ তথ্য সফলভাবে সিঙ্ক করা হয়েছে।');
    }
  };

  const handleDeleteItem = (id: string | undefined, name: string) => {
    if (!id) return;

    Alert.alert('রেকর্ড মুছুন', `আপনি কি অফলাইন রেকর্ডটি (${name}) ড্রাফট থেকে চিরতরে মুছে ফেলতে চান?`, [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'মুছে ফেলুন',
        style: 'destructive',
        onPress: () => {
          removeFromOfflineQueue(id);
          loadQueue();
        }
      }
    ]);
  };

  const handleLogout = () => {
    Alert.alert('লগআউট নিশ্চিত করুন', 'আপনি কি সত্যিই লগআউট করতে চান?', [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'লগআউট',
        style: 'destructive',
        onPress: async () => {
          await clearAuthSession();
          router.replace('/login');
        }
      }
    ]);
  };

  // Helper formatting numbers for view
  const toBengaliNumber = (num: number | string | undefined): string => {
    if (num === undefined) return '';
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  const renderQueueItem = ({ item }: { item: Survey }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.studentName} numberOfLines={1}>{item.student_name}</Text>
          <Text style={styles.scoreText}>স্কোর: {toBengaliNumber(item.score)}</Text>
        </View>
        <Text style={styles.metaText}>শাখা: {item.branch} · তারিখ: {item.survey_date}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDeleteItem(item._id, item.student_name)}
      >
        <Trash2 size={16} color={COLORS.cancel} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Network Status Header Banner */}
      <View style={[styles.networkStatusHeader, { backgroundColor: isOnline ? '#e8f5ee' : '#ffe9e9' }]}>
        {isOnline ? (
          <>
            <Wifi size={18} color={COLORS.recommend} style={{ marginRight: 8 }} />
            <Text style={[styles.networkStatusText, { color: COLORS.recommend }]}>
              ডিভাইসটি বর্তমানে অনলাইন (সংযুক্ত) আছে।
            </Text>
          </>
        ) : (
          <>
            <WifiOff size={18} color={COLORS.cancel} style={{ marginRight: 8 }} />
            <Text style={[styles.networkStatusText, { color: COLORS.cancel }]}>
              ডিভাইসটি অফলাইনে আছে। আপলোড করতে ইন্টারনেট চালু করুন।
            </Text>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>ইউজার প্রোফাইল</Text>
          </View>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>{username[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>{username}</Text>
              <Text style={styles.profileRole}>{role}</Text>
            </View>
          </View>
        </View>

        {/* Sync Settings Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Database size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>ডাটাসেন্টার সিঙ্ক</Text>
          </View>
          <Text style={styles.syncInfoText}>
            ডাটাসেন্টার সিঙ্ক করলে আপনার অফলাইনে পূরণকৃত সব ফর্ম সার্ভারে আপলোড হবে এবং একই সাথে সার্ভার থেকে সব সাম্প্রতিক সার্ভে ডাটা আপনার মোবাইলে ক্যাশড হবে।
          </Text>

          {syncing ? (
            <View style={styles.syncingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 10 }} />
              <Text style={styles.syncProgressText}>{progressMsg}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.syncBtn, !isOnline && styles.syncBtnDisabled]}
              disabled={!isOnline}
              onPress={handleSync}
            >
              <CloudUpload size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.syncBtnText}>ডাটাসেন্টার সিঙ্ক করুন</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Offline Queue Section */}
        <View style={[styles.section, { flex: 1, minHeight: 200 }]}>
          <View style={styles.sectionHeader}>
            <Settings size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>অফলাইন পেন্ডিং ফর্মসমূহ ({toBengaliNumber(queue.length)})</Text>
          </View>

          {queue.length > 0 ? (
            <View style={{ maxHeight: 250 }}>
              <FlatList
                data={queue}
                renderItem={renderQueueItem}
                keyExtractor={(item) => item._id || String(Math.random())}
                nestedScrollEnabled
              />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <CheckCircle2 size={36} color={COLORS.recommend} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyTitle}>সব ডাটা সিনক্রোনাইজড</Text>
              <Text style={styles.emptySubtitle}>সিঙ্ক করার মতো কোনো অফলাইন ফর্ম বাকি নেই।</Text>
            </View>
          )}
        </View>

        {/* Logout Action */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <LogOut size={18} color={COLORS.white} style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>লগআউট করুন</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  networkStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  networkStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileRole: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  syncInfoText: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
    marginBottom: 14,
  },
  syncBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  syncBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  syncBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  syncProgressText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    marginRight: 10,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fff5f5',
    marginLeft: 8,
  },
  logoutBtn: {
    backgroundColor: COLORS.cancel,
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.cancel,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import {
  Search,
  RefreshCw,
  Plus,
  WifiOff,
  MapPin,
  Phone,
  AlertTriangle,
  LogOut,
  Filter,
  X,
} from 'lucide-react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Dropdown } from 'react-native-element-dropdown';
import DatePicker from 'react-native-date-picker';
import { COLORS, BRANCHES, STATUS_LABELS } from '@/lib/config';
import {
  getAuthSession,
  clearAuthSession,
  getCachedSurveys,
  saveCachedSurveys,
  getOfflineQueue,
  Survey,
} from '@/lib/storage';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

export default function DashboardScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<Survey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Local Pagination states
  const [visibleLimit, setVisibleLimit] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<'name' | 'phone' | 'form_no'>('name');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'score_high' | 'score_low'>('newest');
  
  // Date and sheet filters matching web
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);

  // Bottom sheet modal refs
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['70%', '85%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    highRisk: 0,
    midRisk: 0,
    safeCount: 0,
    pending: 0,
  });

  // ── Authentication check ──────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const session = await getAuthSession();
    if (!session || !session.isLoggedIn) {
      router.replace('/login');
    } else {
      setCurrentUser(session.username);
    }
  }, [router]);

  // ── Load local queue and cached surveys ────────────────────────────────────
  const loadLocalData = useCallback(() => {
    const cached = getCachedSurveys();
    const queue = getOfflineQueue();
    setOfflineQueue(queue);
    
    // Merge offline pending surveys (queue) and cached surveys
    // If a survey exists in both, prefer the queue (since it contains offline edits/creates)
    const mergedMap = new Map<string, Survey>();
    cached.forEach(s => {
      if (s._id) mergedMap.set(s._id, s);
    });
    queue.forEach(s => {
      if (s._id) mergedMap.set(s._id, s);
    });
    
    const merged = Array.from(mergedMap.values());
    setAllSurveys(merged);
    setLoading(false);
  }, []);

  // Reload data when screen focused
  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [loadLocalData])
  );

  // On Mount: Listen to network state changes
  useEffect(() => {
    checkAuth();
    loadLocalData();
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        // Fetch latest up to 3000 surveys
        const response = await axios.get(`${API_BASE_URL}/api/surveys?limit=3000`, {
          timeout: 10000,
        });
        if (response.data && response.data.success) {
          saveCachedSurveys(response.data.data);
        }
      }
    } catch (e: any) {
      console.log('Failed to refresh remote surveys:', e.message);
    } finally {
      loadLocalData();
      setVisibleLimit(15);
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      setTimeout(() => {
        setVisibleLimit(prev => prev + 15);
        setLoadingMore(false);
      }, 150);
    }
  };

  const handleLogout = () => {
    Alert.alert('লগআউট', 'আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?', [
      { text: 'বাতিল', style: 'cancel' },
      {
        text: 'লগআউট',
        style: 'destructive',
        onPress: async () => {
          await clearAuthSession();
          router.replace('/login');
        },
      },
    ]);
  };

  // ── Stats Calculation (Local Cache View) ──────────────────────────────────
  useEffect(() => {
    const total = allSurveys.length;
    let highRisk = 0;
    let midRisk = 0;
    let safeCount = 0;
    let pending = 0;

    allSurveys.forEach(s => {
      const score = s.score || 0;
      if (score >= 7) highRisk++;
      else if (score >= 4) midRisk++;
      else safeCount++;

      if (s.status === 'submit') pending++;
    });

    setStats({ total, highRisk, midRisk, safeCount, pending });
  }, [allSurveys]);

  // ── Filter & Sort Logic ───────────────────────────────────────────────────
  const processedList = useMemo(() => {
    let result = allSurveys;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => {
        if (searchType === 'name') {
          return s.student_name?.toLowerCase().includes(q);
        } else if (searchType === 'phone') {
          const ph = s.father_phone || s.mother_phone || '';
          return ph.includes(q);
        } else if (searchType === 'form_no') {
          return s.form_no?.toLowerCase().includes(q);
        }
        return true;
      });
    }

    // Branch Filter
    if (branchFilter) {
      result = result.filter(s => s.branch === branchFilter);
    }

    // Status Filter
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter);
    }

    // Risk Filter
    if (riskFilter) {
      result = result.filter(s => {
        const sc = s.score || 0;
        if (riskFilter === 'high') return sc >= 7;
        if (riskFilter === 'mid') return sc >= 4 && sc < 7;
        if (riskFilter === 'safe') return sc < 4;
        return true;
      });
    }

    // Date From Filter
    if (dateFrom) {
      result = result.filter(s => s.survey_date && s.survey_date >= dateFrom);
    }

    // Date To Filter
    if (dateTo) {
      result = result.filter(s => s.survey_date && s.survey_date <= dateTo);
    }

    // Sorting (Always apply client-side)
    return [...result].sort((a, b) => {
      // Offline pending surveys are ALWAYS kept at the top
      if (a.isOfflinePending && !b.isOfflinePending) return -1;
      if (!a.isOfflinePending && b.isOfflinePending) return 1;

      if (sortBy === 'newest') {
        const da = a.saved_at ? new Date(a.saved_at).getTime() : a.survey_date ? new Date(a.survey_date).getTime() : 0;
        const db = b.saved_at ? new Date(b.saved_at).getTime() : b.survey_date ? new Date(b.survey_date).getTime() : 0;
        return db - da;
      }
      if (sortBy === 'oldest') {
        const da = a.saved_at ? new Date(a.saved_at).getTime() : a.survey_date ? new Date(a.survey_date).getTime() : 0;
        const db = b.saved_at ? new Date(b.saved_at).getTime() : b.survey_date ? new Date(b.survey_date).getTime() : 0;
        return da - db;
      }
      if (sortBy === 'name') {
        return (a.student_name || '').localeCompare(b.student_name || '', 'bn');
      }
      if (sortBy === 'score_high') {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'score_low') {
        return (a.score || 0) - (b.score || 0);
      }
      return 0;
    });
  }, [allSurveys, searchQuery, searchType, branchFilter, riskFilter, statusFilter, dateFrom, dateTo, sortBy]);

  // Bind the flat list to the paginated slice
  useEffect(() => {
    setSurveys(processedList.slice(0, visibleLimit));
    setHasMore(visibleLimit < processedList.length);
  }, [processedList, visibleLimit]);

  // Formatting helpers
  const toBengaliNumber = (num: number | string | undefined): string => {
    if (num === undefined) return '০';
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return COLORS.cancel;
    if (score >= 4) return COLORS.accent;
    return COLORS.recommend;
  };

  const getStatusBadgeColor = (status: string) => {
    return (COLORS as any)[status] || COLORS.submit;
  };

  const showDatePicker = (target: 'from' | 'to') => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setBranchFilter('');
    setRiskFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  // Card component renderer
  const renderItem = ({ item }: { item: Survey }) => {
    const score = item.score || 0;
    const scoreCol = getScoreColor(score);
    const badgeCol = getStatusBadgeColor(item.status);
    const phone = item.father_phone || item.mother_phone;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          if (item.isOfflinePending) {
            Alert.alert('অফলাইন ফর্ম', 'এই ফর্মটি এখনো সিনক্রোনাইজড হয়নি। এটি এডিট করতে সেটিংস ট্যাব ব্যবহার করুন।');
          } else {
            router.push(`/survey/${item._id}`);
          }
        }}
      >
        <View style={styles.cardTop}>
          <View style={[styles.scoreBadge, { backgroundColor: scoreCol }]}>
            <Text style={styles.scoreVal}>{toBengaliNumber(score)}</Text>
            <Text style={styles.scoreLabel}>স্কোর</Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.studentName} numberOfLines={1}>
                {item.student_name}
              </Text>
              {item.isOfflinePending ? (
                <View style={[styles.statusBadge, { backgroundColor: '#e67e22' }]}>
                  <Text style={styles.statusText}>অফলাইন</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: badgeCol }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              {item.branch ? (
                <View style={styles.metaItem}>
                  <MapPin size={12} color={COLORS.accent} style={{ marginRight: 2 }} />
                  <Text style={styles.metaText} numberOfLines={1}>{item.branch}</Text>
                </View>
              ) : null}
              <Text style={styles.metaText}>
                {item.district ? ` · ${item.district}` : ''}
                {item.class ? ` · শ্রেণী: ${item.class}` : ''}
                {item.age ? ` · বয়স: ${toBengaliNumber(item.age)}` : ''}
              </Text>
            </View>

            {phone ? (
              <View style={styles.phoneRow}>
                <Phone size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.phoneText}>{toBengaliNumber(phone)}</Text>
              </View>
            ) : null}

            {item.score_level ? (
              <Text style={[styles.scoreLevelText, { color: scoreCol }]}>
                {item.score_level}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>হোম ড্যাশবোর্ড</Text>
            <Text style={styles.headerSubtitle}>দারিদ্র্য সার্ভে ম্যানেজমেন্ট সিস্টেম</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>অফলাইন মোড — ক্যাশ ডাটা দেখাচ্ছে</Text>
          </View>
        )}
        
        {offlineQueue.length > 0 && (
          <View style={styles.syncBanner}>
            <AlertTriangle size={16} color="#744210" style={{ marginRight: 6 }} />
            <Text style={styles.syncBannerText}>
              {toBengaliNumber(offlineQueue.length)}টি ফর্ম সিঙ্ক করা প্রয়োজন।
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
            <TouchableOpacity 
              style={[styles.statBox, !statusFilter && !riskFilter && styles.statBoxActive]} 
              onPress={() => {
                setStatusFilter('');
                setRiskFilter('');
              }}
            >
              <Text style={styles.statVal}>{toBengaliNumber(stats.total)}</Text>
              <Text style={styles.statLabel}>মোট সার্ভে</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statBox, styles.statPending, statusFilter === 'submit' && styles.statBoxActive]} 
              onPress={() => {
                setStatusFilter('submit');
                setRiskFilter('');
              }}
            >
              <Text style={[styles.statVal, { color: COLORS.primary }]}>{toBengaliNumber(stats.pending)}</Text>
              <Text style={styles.statLabel}>পেন্ডিং</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statBox, styles.statHighRisk, riskFilter === 'high' && styles.statBoxActive]} 
              onPress={() => {
                setRiskFilter('high');
                setStatusFilter('');
              }}
            >
              <Text style={[styles.statVal, { color: COLORS.cancel }]}>{toBengaliNumber(stats.highRisk)}</Text>
              <Text style={styles.statLabel}>উচ্চ ঝুঁকি</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statBox, styles.statMidRisk, riskFilter === 'mid' && styles.statBoxActive]} 
              onPress={() => {
                setRiskFilter('mid');
                setStatusFilter('');
              }}
            >
              <Text style={[styles.statVal, { color: COLORS.accent }]}>{toBengaliNumber(stats.midRisk)}</Text>
              <Text style={styles.statLabel}>মাঝারি ঝুঁকি</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statBox, styles.statSafe, riskFilter === 'safe' && styles.statBoxActive]} 
              onPress={() => {
                setRiskFilter('safe');
                setStatusFilter('');
              }}
            >
              <Text style={[styles.statVal, { color: COLORS.recommend }]}>{toBengaliNumber(stats.safeCount)}</Text>
              <Text style={styles.statLabel}>ঝুঁকিমুক্ত</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Search and Advanced Filter Row */}
      <View style={styles.filterRowContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={COLORS.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              searchType === 'name' ? 'ছাত্রের নাম...' : searchType === 'phone' ? 'ফোন নম্বর...' : 'ফর্ম নং...'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterBtn, (searchQuery || branchFilter || statusFilter || riskFilter || dateFrom || dateTo || sortBy !== 'newest') && styles.filterBtnActive]} 
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Filter size={20} color={(searchQuery || branchFilter || statusFilter || riskFilter || dateFrom || dateTo || sortBy !== 'newest') ? COLORS.white : COLORS.primary} />
          {(searchQuery || branchFilter || statusFilter || riskFilter || dateFrom || dateTo || sortBy !== 'newest') && <View style={styles.filterBadge} />}
        </TouchableOpacity>
      </View>

      {/* Advanced Filters BottomSheet Modal */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: COLORS.cardBg }}
        handleIndicatorStyle={{ backgroundColor: COLORS.primary }}
      >
        <BottomSheetView style={{ flex: 1, paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}>
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>উন্নত ফিল্টারসমূহ</Text>
            <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()}>
              <X size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <BottomSheetScrollView style={styles.bottomSheetScroll} contentContainerStyle={styles.bottomSheetContent}>
            {/* Search Type select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>অনুসন্ধানের ধরণ</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'নাম', value: 'name' },
                  { label: 'ফোন', value: 'phone' },
                  { label: 'ফর্ম নং', value: 'form_no' },
                ]}
                labelField="label"
                valueField="value"
                placeholder="অনুসন্ধানের ধরণ..."
                value={searchType}
                onChange={item => setSearchType(item.value as any)}
                activeColor="#f2fbf6"
              />
            </View>

            {/* Branch select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>শাখা</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'সব শাখা', value: '' },
                  ...BRANCHES.map(b => ({ label: b, value: b })),
                ]}
                labelField="label"
                valueField="value"
                placeholder="সব শাখা..."
                value={branchFilter}
                onChange={item => setBranchFilter(item.value)}
                activeColor="#f2fbf6"
                search
                searchPlaceholder="শাখা খুঁজুন..."
              />
            </View>

            {/* Status select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>স্ট্যাটাস</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'সব স্ট্যাটাস', value: '' },
                  { label: 'সাবমিট', value: 'submit' },
                  { label: 'রিভিউ', value: 'review' },
                  { label: 'সুপারিশ', value: 'recommend' },
                  { label: 'বাতিল', value: 'cancel' },
                ]}
                labelField="label"
                valueField="value"
                placeholder="সব স্ট্যাটাস..."
                value={statusFilter}
                onChange={item => setStatusFilter(item.value)}
                activeColor="#f2fbf6"
              />
            </View>

            {/* Risk level select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>ঝুঁকির মাত্রা</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'সব ঝুঁকি', value: '' },
                  { label: 'উচ্চ ঝুঁকি', value: 'high' },
                  { label: 'মাঝারি', value: 'mid' },
                  { label: 'ঝুঁকিমুক্ত', value: 'safe' },
                ]}
                labelField="label"
                valueField="value"
                placeholder="সব ঝুঁকি..."
                value={riskFilter}
                onChange={item => setRiskFilter(item.value)}
                activeColor="#f2fbf6"
              />
            </View>

            {/* Dates select */}
            <View style={styles.dateRow}>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>তারিখ থেকে</Text>
                <View style={styles.dateInputContainer}>
                  <TouchableOpacity
                    style={styles.dateInputTouchable}
                    onPress={() => showDatePicker('from')}
                  >
                    <Text style={[styles.dateInputText, !dateFrom && { color: COLORS.textLight }]}>
                      {dateFrom ? toBengaliNumber(dateFrom) : 'শুরু তারিখ'}
                    </Text>
                  </TouchableOpacity>
                  {dateFrom ? (
                    <TouchableOpacity style={styles.clearDateBtn} onPress={() => setDateFrom('')}>
                      <X size={14} color={COLORS.textLight} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>তারিখ পর্যন্ত</Text>
                <View style={styles.dateInputContainer}>
                  <TouchableOpacity
                    style={styles.dateInputTouchable}
                    onPress={() => showDatePicker('to')}
                  >
                    <Text style={[styles.dateInputText, !dateTo && { color: COLORS.textLight }]}>
                      {dateTo ? toBengaliNumber(dateTo) : 'শেষ তারিখ'}
                    </Text>
                  </TouchableOpacity>
                  {dateTo ? (
                    <TouchableOpacity style={styles.clearDateBtn} onPress={() => setDateTo('')}>
                      <X size={14} color={COLORS.textLight} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Sort method select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>বাছাই পদ্ধতি (সর্ট)</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'সর্বশেষ', value: 'newest' },
                  { label: 'সর্বপ্রথম', value: 'oldest' },
                  { label: 'নাম (ক-ঞ)', value: 'name' },
                  { label: 'স্কোর (উচ্চ)', value: 'score_high' },
                  { label: 'স্কোর (নিম্ন)', value: 'score_low' },
                ]}
                labelField="label"
                valueField="value"
                placeholder="সর্বশেষ..."
                value={sortBy}
                onChange={item => setSortBy(item.value as any)}
                activeColor="#f2fbf6"
              />
            </View>
          </BottomSheetScrollView>
          
          <View style={styles.bottomSheetFooter}>
            <TouchableOpacity style={styles.bottomSheetResetBtn} onPress={resetFilters}>
              <Text style={styles.bottomSheetResetBtnText}>রিসেট করুন</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomSheetApplyBtn} onPress={() => bottomSheetModalRef.current?.dismiss()}>
              <Text style={styles.bottomSheetApplyBtnText}>প্রয়োগ করুন</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Main surveys List with Infinite Scroll */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={surveys}
          renderItem={renderItem}
          keyExtractor={(item) => item._id || String(Math.random())}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <WifiOff size={40} color={COLORS.accent} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>কোনো রেকর্ড পাওয়া যায়নি</Text>
              <Text style={styles.emptySubtitle}>নতুন ফর্ম পূরণ করতে (+) ট্যাপ করুন।</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/new')}
      >
        <Plus size={24} color={COLORS.white} />
      </TouchableOpacity>

      <DatePicker
        modal
        open={pickerOpen}
        date={pickerTarget ? parseDateString(pickerTarget === 'from' ? dateFrom : dateTo) : new Date()}
        mode="date"
        locale="bn-BD"
        confirmText="নিশ্চিত করুন"
        cancelText="বাতিল"
        title="তারিখ নির্বাচন করুন"
        onConfirm={(date) => {
          setPickerOpen(false);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const formatted = `${yyyy}-${mm}-${dd}`;
          if (pickerTarget === 'from') {
            setDateFrom(formatted);
          } else if (pickerTarget === 'to') {
            setDateTo(formatted);
          }
          setPickerTarget(null);
        }}
        onCancel={() => {
          setPickerOpen(false);
          setPickerTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.accent,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d35400',
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  offlineBannerText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  syncBannerText: {
    color: '#744210',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statsContainer: {
    marginTop: 8,
  },
  statsScroll: {
    paddingRight: 16,
  },
  statBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  statPending: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  statHighRisk: {
    backgroundColor: '#ffebee',
  },
  statMidRisk: {
    backgroundColor: '#fdf8ee',
  },
  statSafe: {
    backgroundColor: '#e8f5ee',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.text,
    marginTop: 2,
  },
  statBoxActive: {
    borderColor: '#c9a84c',
    borderWidth: 2,
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9a84c',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    backgroundColor: COLORS.background,
    height: 40,
    justifyContent: 'center',
    marginTop: 4,
  },
  picker: {
    fontSize: 12,
    color: COLORS.text,
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetDismiss: {
    flex: 1,
  },
  bottomSheetContainer: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  bottomSheetScroll: {
    padding: 16,
  },
  bottomSheetContent: {
    paddingBottom: 20,
  },
  bottomSheetFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  bottomSheetResetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetResetBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomSheetApplyBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetApplyBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterField: {
    marginBottom: 12,
  },
  dropdown: {
    height: 42,
    borderColor: '#d0e3d7',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.background,
    marginTop: 6,
  },
  dropdownPlaceholder: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  dropdownSelectedText: {
    fontSize: 13,
    color: COLORS.text,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    height: 40,
    marginTop: 4,
    paddingRight: 8,
  },
  dateInputTouchable: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dateInputText: {
    fontSize: 13,
    color: COLORS.text,
  },
  clearDateBtn: {
    padding: 4,
  },
  listContainer: {
    padding: 12,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBadge: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scoreVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scoreLabel: {
    fontSize: 9,
    color: COLORS.white,
    opacity: 0.8,
  },
  cardInfo: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 11,
    color: COLORS.text,
  },
  scoreLevelText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  footerLoader: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});

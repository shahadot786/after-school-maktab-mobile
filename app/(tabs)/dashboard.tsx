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
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import {
  Search,
  History,
  TrendingUp,
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
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
  Survey,
  getCachedSurveys,
  getOfflineQueue,
  saveCachedSurveys,
} from '@/lib/storage';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';
import geoData from '@/lib/bangladesh-data.json';

interface EditHistoryLog {
  _id: string;
  surveyId: string;
  formNo: string;
  studentName: string;
  editedBy: string;
  editedAt: string;
  changes: Array<{
    field: string;
    fieldLabel: string;
    oldValue: any;
    newValue: any;
  }>;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);

  // Pagination states
  const [visibleLimit, setVisibleLimit] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalCount: 0,
    highRisk: 0,
    midRisk: 0,
    safeCount: 0,
    pending: 0,
    review: 0,
    recommend: 0,
    cancel: 0,
  });

  // Filters State (Web Dashboard 1:1)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'phone' | 'form_no'>('name');
  const [studentType, setStudentType] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [thanaFilter, setThanaFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'score_high' | 'score_low'>('newest');

  // Date picker states
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);

  // Modal History Drawer states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<EditHistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  // Bottom sheet modal refs
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['75%', '90%'], []);

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

  // ── Authentication Check ──────────────────────────────────────────────────
  useEffect(() => {
    getAuthSession().then(session => {
      if (!session || !session.isLoggedIn || session.role !== 'admin') {
        Alert.alert('অননুমোদিত অ্যাক্সেস', 'বিশ্লেষণ ড্যাশবোর্ড ব্যবহারের জন্য এডমিন লগইন প্রয়োজন।');
        router.replace('/(tabs)');
      }
    });
  }, []);

  // ── Load local queue and cached surveys ────────────────────────────────────
  const loadLocalData = useCallback(() => {
    const cached = getCachedSurveys();
    const queue = getOfflineQueue();
    
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

  useEffect(() => {
    loadLocalData();
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

  // ── Fetch Edit History Logs ────────────────────────────────────────────────
  const fetchEditHistory = useCallback(async (targetPage: number, append = false) => {
    if (targetPage === 1) {
      setHistoryLoading(true);
    } else {
      setHistoryLoadingMore(true);
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/history?page=${targetPage}&limit=15`, { timeout: 8000 });
      if (response.data && response.data.success) {
        const logs: EditHistoryLog[] = response.data.data;
        const totalPages = response.data.pagination?.totalPages || 1;

        setHistoryHasMore(targetPage < totalPages);
        if (append) {
          setHistoryData(prev => [...prev, ...logs]);
        } else {
          setHistoryData(logs);
        }
      }
    } catch (e: any) {
      console.log('Failed to fetch history logs:', e.message);
      Alert.alert('ত্রুটি', 'ইতিহাস লোড করতে সমস্যা হয়েছে।');
    } finally {
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
    }
  }, []);

  const openHistoryDrawer = () => {
    setHistoryOpen(true);
    setHistoryPage(1);
    setExpandedHistory({});
    fetchEditHistory(1, false);
  };

  const loadMoreHistory = () => {
    if (!historyLoadingMore && historyHasMore && !historyLoading) {
      const nextPage = historyPage + 1;
      setHistoryPage(nextPage);
      fetchEditHistory(nextPage, true);
    }
  };

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Stats Calculation (Local Cache View) ──────────────────────────────────
  useEffect(() => {
    let highRisk = 0;
    let midRisk = 0;
    let safeCount = 0;
    let pending = 0;
    let review = 0;
    let recommend = 0;
    let cancel = 0;

    allSurveys.forEach(s => {
      const score = s.score || 0;
      if (score >= 7) highRisk++;
      else if (score >= 4) midRisk++;
      else safeCount++;

      if (s.status === 'submit') pending++;
      else if (s.status === 'review') review++;
      else if (s.status === 'recommend') recommend++;
      else if (s.status === 'cancel') cancel++;
    });

    setStats({
      totalCount: allSurveys.length,
      highRisk,
      midRisk,
      safeCount,
      pending,
      review,
      recommend,
      cancel,
    });
  }, [allSurveys]);

  // ── Filter Logic ───────────────────────────────────────────────────
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

    // studentType filter
    if (studentType) {
      result = result.filter(s => s.student_type === studentType);
    }

    // branchFilter
    if (branchFilter) {
      result = result.filter(s => s.branch === branchFilter);
    }

    // districtFilter
    if (districtFilter) {
      result = result.filter(s => s.district === districtFilter);
    }

    // thanaFilter
    if (thanaFilter) {
      result = result.filter(s => s.thana === thanaFilter);
    }

    // genderFilter
    if (genderFilter) {
      result = result.filter(s => s.gender === genderFilter);
    }

    // classFilter
    if (classFilter) {
      result = result.filter(s => s.class === classFilter);
    }

    // riskFilter
    if (riskFilter) {
      result = result.filter(s => {
        const sc = s.score || 0;
        if (riskFilter === 'high') return sc >= 7;
        if (riskFilter === 'mid') return sc >= 4 && sc < 7;
        if (riskFilter === 'safe') return sc < 4;
        return true;
      });
    }

    // statusFilter
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter);
    }

    // Date From
    if (dateFrom) {
      result = result.filter(s => s.survey_date && s.survey_date >= dateFrom);
    }

    // Date To
    if (dateTo) {
      result = result.filter(s => s.survey_date && s.survey_date <= dateTo);
    }

    return result;
  }, [
    allSurveys,
    searchQuery,
    searchType,
    studentType,
    branchFilter,
    districtFilter,
    thanaFilter,
    genderFilter,
    classFilter,
    riskFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  // ── Sorting Logic ──────────────────────────────────────────────────────────
  const sortedSurveys = useMemo(() => {
    return [...processedList].sort((a, b) => {
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
  }, [processedList, sortBy]);

  // Paginate and update visible list
  useEffect(() => {
    setSurveys(sortedSurveys.slice(0, visibleLimit));
    setHasMore(visibleLimit < sortedSurveys.length);
    setTotalCount(sortedSurveys.length);
  }, [sortedSurveys, visibleLimit]);

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

  // Helpers
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

  const resetFilters = () => {
    setSearchQuery('');
    setStudentType('');
    setBranchFilter('');
    setDistrictFilter('');
    setThanaFilter('');
    setGenderFilter('');
    setClassFilter('');
    setRiskFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  // Upazilas based on selected district
  const selectedDistrictData = geoData.find(d => d.bn_name === districtFilter);
  const upazilas = selectedDistrictData ? selectedDistrictData.upazilas : [];

  const districtDropdownData = useMemo(() => {
    return [{ label: 'সব জেলা', value: '' }, ...geoData.map(d => ({ label: d.bn_name, value: d.bn_name }))];
  }, []);

  const thanaDropdownData = useMemo(() => {
    return [
      { label: 'সব থানা', value: '' },
      ...upazilas.map(u => {
        const name = typeof u === 'string' ? u : u.bn_name;
        return { label: name, value: name };
      })
    ];
  }, [upazilas]);

  // Renders individual survey item card
  const renderSurveyItem = ({ item }: { item: Survey }) => {
    const scoreVal = item.score || 0;
    const scoreCol = getScoreColor(scoreVal);
    const badgeCol = getStatusBadgeColor(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/survey/${item._id}`)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.scoreBadge, { backgroundColor: scoreCol }]}>
            <Text style={styles.scoreVal}>{toBengaliNumber(scoreVal)}</Text>
            <Text style={styles.scoreLabel}>স্কোর</Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.studentName} numberOfLines={1}>
                {item.student_name}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: badgeCol }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[item.status] || item.status}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText} numberOfLines={1}>
                #{item.form_no} · {item.student_type} · {item.branch}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {item.gender} · {item.class} শ্রেণী · {item.district} / {item.thana}
              </Text>
            </View>

            <View style={styles.bottomStatsRow}>
              <Text style={styles.incomeText}>
                মাসিক আয়: {toBengaliNumber(item.monthly_income?.toLocaleString())} ৳
              </Text>
              {item.score_level ? (
                <Text style={[styles.scoreLevelText, { color: scoreCol }]}>
                  {item.score_level}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Edit History Log Card
  const renderHistoryItem = ({ item }: { item: EditHistoryLog }) => {
    const isExpanded = !!expandedHistory[item._id];
    const date = new Date(item.editedAt);
    const dateStr = date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.historyCard}>
        <TouchableOpacity style={styles.historyHeader} onPress={() => toggleHistoryExpand(item._id)}>
          <View style={{ flex: 1 }}>
            <View style={styles.historyNameRow}>
              <Text style={styles.historyStudent}>{item.studentName}</Text>
              <Text style={styles.historyFormNo}>#{item.formNo}</Text>
            </View>
            <View style={styles.historyMetaRow}>
              <View style={styles.historyMetaItem}>
                <User size={12} color={COLORS.textLight} style={{ marginRight: 4 }} />
                <Text style={styles.historyMetaText}>{item.editedBy}</Text>
              </View>
              <View style={styles.historyMetaItem}>
                <Clock size={12} color={COLORS.textLight} style={{ marginRight: 4 }} />
                <Text style={styles.historyMetaText}>{dateStr} ({timeStr})</Text>
              </View>
            </View>
          </View>
          <View style={{ paddingLeft: 8 }}>
            {isExpanded ? <ChevronUp size={20} color={COLORS.primary} /> : <ChevronDown size={20} color={COLORS.primary} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.historyChangesBody}>
            <Text style={styles.changesTitle}>পরিবর্তিত তথ্যের তালিকা ({toBengaliNumber(item.changes.length)}টি):</Text>
            {item.changes.map((ch, idx) => (
              <View key={idx} style={styles.changeRow}>
                <Text style={styles.changeField}>{ch.fieldLabel}:</Text>
                <View style={styles.changeValues}>
                  <Text style={styles.oldValue} numberOfLines={1}>{String(ch.oldValue ?? 'খালি')}</Text>
                  <Text style={styles.changeArrow}>→</Text>
                  <Text style={styles.newValue} numberOfLines={1}>{String(ch.newValue ?? 'খালি')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.headerTitle}>বিশ্লেষণ ড্যাশবোর্ড</Text>
          <Text style={styles.headerSubtitle}>উন্নত ফিল্টার ও ডাটাসেট বিশ্লেষণ</Text>
        </View>

        <TouchableOpacity style={styles.historyBtn} onPress={openHistoryDrawer}>
          <History size={18} color={COLORS.white} style={{ marginRight: 6 }} />
          <Text style={styles.historyBtnText}>ইতিহাস</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Cards Row */}
      <View style={styles.statsSummaryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsSummaryScroll}>
          <TouchableOpacity 
            style={[styles.statSummaryBox, (!statusFilter && !riskFilter) && styles.statSummaryBoxActive]} 
            onPress={() => {
              setStatusFilter('');
              setRiskFilter('');
            }}
          >
            <Text style={styles.statSummaryVal}>{toBengaliNumber(totalCount)}</Text>
            <Text style={styles.statSummaryLabel}>ফিল্টারড</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statSummaryBox, styles.statHigh, riskFilter === 'high' && styles.statSummaryBoxActive]} 
            onPress={() => {
              setRiskFilter('high');
              setStatusFilter('');
            }}
          >
            <Text style={[styles.statSummaryVal, { color: COLORS.cancel }]}>{toBengaliNumber(stats.highRisk)}</Text>
            <Text style={styles.statSummaryLabel}>উচ্চ ঝুঁকি</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statSummaryBox, styles.statMid, riskFilter === 'mid' && styles.statSummaryBoxActive]} 
            onPress={() => {
              setRiskFilter('mid');
              setStatusFilter('');
            }}
          >
            <Text style={[styles.statSummaryVal, { color: COLORS.accent }]}>{toBengaliNumber(stats.midRisk)}</Text>
            <Text style={styles.statSummaryLabel}>মাঝারি ঝুঁকি</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statSummaryBox, styles.statSafe, riskFilter === 'safe' && styles.statSummaryBoxActive]} 
            onPress={() => {
              setRiskFilter('safe');
              setStatusFilter('');
            }}
          >
            <Text style={[styles.statSummaryVal, { color: COLORS.recommend }]}>{toBengaliNumber(stats.safeCount)}</Text>
            <Text style={styles.statSummaryLabel}>ঝুঁকিমুক্ত</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statSummaryBox, (!searchQuery && !studentType && !branchFilter && !districtFilter && !thanaFilter && !genderFilter && !classFilter && !riskFilter && !statusFilter && !dateFrom && !dateTo) && styles.statSummaryBoxActive]} 
            onPress={resetFilters}
          >
            <Text style={styles.statSummaryVal}>{toBengaliNumber(stats.totalCount)}</Text>
            <Text style={styles.statSummaryLabel}>মোট ডাটা</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search and Advanced Filter Row */}
      <View style={styles.filterRowContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={COLORS.textLight} style={{ marginRight: 6 }} />
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
          style={[styles.filterBtn, (searchQuery || studentType || branchFilter || districtFilter || thanaFilter || genderFilter || classFilter || riskFilter || statusFilter || dateFrom || dateTo || sortBy !== 'newest') && styles.filterBtnActive]} 
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Filter size={20} color={(searchQuery || studentType || branchFilter || districtFilter || thanaFilter || genderFilter || classFilter || riskFilter || statusFilter || dateFrom || dateTo || sortBy !== 'newest') ? COLORS.white : COLORS.primary} />
          {(searchQuery || studentType || branchFilter || districtFilter || thanaFilter || genderFilter || classFilter || riskFilter || statusFilter || dateFrom || dateTo || sortBy !== 'newest') && <View style={styles.filterBadge} />}
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
            <Text style={styles.bottomSheetTitle}>উন্নত বিশ্লেষণ ফিল্টারসমূহ</Text>
            <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()}>
              <X size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <BottomSheetScrollView style={styles.bottomSheetScroll} contentContainerStyle={styles.bottomSheetContent}>
            {/* Row 1: Search Type select */}
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

            {/* Row 2: District and Thana select */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterLabel}>জেলা</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={districtDropdownData}
                  labelField="label"
                  valueField="value"
                  placeholder="জেলা..."
                  value={districtFilter}
                  onChange={item => {
                    setDistrictFilter(item.value);
                    setThanaFilter('');
                  }}
                  activeColor="#f2fbf6"
                  search
                  searchPlaceholder="জেলা খুঁজুন..."
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterLabel}>থানা/উপজেলা</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={thanaDropdownData}
                  labelField="label"
                  valueField="value"
                  placeholder="থানা..."
                  value={thanaFilter}
                  onChange={item => setThanaFilter(item.value)}
                  activeColor="#f2fbf6"
                  search
                  searchPlaceholder="থানা খুঁজুন..."
                />
              </View>
            </View>

            {/* Row 3: Class & Branch select */}
            <View style={styles.row}>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>শ্রেণি</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'সব শ্রেণি', value: '' },
                    ...['প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম'].map(c => ({ label: c, value: c }))
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="সব শ্রেণি..."
                  value={classFilter}
                  onChange={item => setClassFilter(item.value)}
                  activeColor="#f2fbf6"
                />
              </View>

              <View style={[styles.filterField, { flex: 1 }]}>
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
            </View>

            {/* Row 4: Gender & Student Type select */}
            <View style={styles.row}>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>লিঙ্গ</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'সব', value: '' },
                    { label: 'ছাত্র (ছেলে)', value: 'ছেলে' },
                    { label: 'ছাত্রী (মেয়ে)', value: 'মেয়ে' },
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="সব..."
                  value={genderFilter}
                  onChange={item => setGenderFilter(item.value)}
                  activeColor="#f2fbf6"
                />
              </View>

              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>ছাত্র ধরন</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'সব ধরন', value: '' },
                    { label: 'নতুন ছাত্র', value: 'নতুন ছাত্র' },
                    { label: 'পুরাতন ছাত্র', value: 'পুরাতন ছাত্র' },
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="সব ধরন..."
                  value={studentType}
                  onChange={item => setStudentType(item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
            </View>

            {/* Row 5: Status & Risk select */}
            <View style={styles.row}>
              <View style={[styles.filterField, { flex: 1 }]}>
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

              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>ঝুঁকি</Text>
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
            </View>

            {/* Row 6: Dates select */}
            <View style={styles.row}>
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

            {/* Row 7: Sort Select */}
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>বাছাই পদ্ধতি (সর্ট)</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={[
                  { label: 'সর্বশেষ সংরক্ষিত', value: 'newest' },
                  { label: 'সর্বপ্রথম সংরক্ষিত', value: 'oldest' },
                  { label: 'নাম অনুযায়ী (ক-ঞ)', value: 'name' },
                  { label: 'স্কোর (উচ্চ → নিম্ন)', value: 'score_high' },
                  { label: 'স্কোর (নিম্ন → উচ্চ)', value: 'score_low' },
                ]}
                labelField="label"
                valueField="value"
                placeholder="সর্বশেষ সংরক্ষিত..."
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

      {/* Surveys List with Infinite Scroll */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedSurveys}
          renderItem={renderSurveyItem}
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
              <AlertTriangle size={32} color={COLORS.accent} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>কোনো রেকর্ড পাওয়া যায়নি</Text>
            </View>
          }
        />
      )}

      {/* ── Edit History Drawer Modal ────────────────────────────────────── */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setHistoryOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <History size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.modalTitle}>এডিট ইতিহাস log</Text>
                <Text style={styles.modalSubtitle}>ডাটাবাস এডিট সমূহের ইতিহাস</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setHistoryOpen(false)}>
              <X size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* List */}
          {historyLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={historyData}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.modalListContent}
              onEndReached={loadMoreHistory}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                historyLoadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>কোনো এডিট ইতিহাস পাওয়া যায়নি</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.accent,
    marginTop: 2,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  historyBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsSummaryContainer: {
    backgroundColor: COLORS.primary,
    paddingBottom: 8,
  },
  statsSummaryScroll: {
    paddingHorizontal: 16,
  },
  statSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  statHigh: {
    backgroundColor: '#ffebee',
  },
  statMid: {
    backgroundColor: '#fdf8ee',
  },
  statSafe: {
    backgroundColor: '#e8f5ee',
  },
  statSummaryVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  statSummaryLabel: {
    fontSize: 9,
    color: COLORS.text,
    marginTop: 1,
  },
  statSummaryBoxActive: {
    borderColor: '#c9a84c',
    borderWidth: 2,
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c9a84c',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 6,
    height: 38,
    paddingHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  pickerContainer: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 6,
    height: 38,
    justifyContent: 'center',
    marginTop: 4,
  },
  picker: {
    color: COLORS.text,
    fontSize: 12,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 6,
    height: 38,
    marginTop: 4,
    paddingRight: 6,
  },
  dateInputTouchable: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dateInputText: {
    fontSize: 12,
    color: COLORS.text,
  },
  clearDateBtn: {
    padding: 4,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 25 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bottomSheetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  bottomSheetScroll: {
    padding: 14,
  },
  bottomSheetContent: {
    paddingBottom: 20,
  },
  bottomSheetFooter: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  bottomSheetResetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 6,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetResetBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  bottomSheetApplyBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetApplyBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  filterField: {
    marginBottom: 10,
  },
  dropdown: {
    height: 38,
    borderColor: '#d0e3d7',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
    marginTop: 4,
  },
  dropdownPlaceholder: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  dropdownSelectedText: {
    fontSize: 12,
    color: COLORS.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  listContainer: {
    padding: 10,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBadge: {
    width: 46,
    height: 46,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  scoreVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scoreLabel: {
    fontSize: 8,
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
    marginBottom: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    flex: 1,
    marginRight: 6,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: 'bold',
  },
  metaRow: {
    marginBottom: 2,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  bottomStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  incomeText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.text,
  },
  scoreLevelText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  footerLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  // Modal / History Drawer styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    height: 56,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  modalSubtitle: {
    fontSize: 10,
    color: COLORS.accent,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalListContent: {
    padding: 12,
  },
  historyCard: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: '#dde8f5',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8faff',
  },
  historyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyStudent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 6,
  },
  historyFormNo: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyMetaText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  historyChangesBody: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#dde8f5',
    backgroundColor: COLORS.cardBg,
  },
  changesTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  changeField: {
    fontSize: 11,
    color: COLORS.textLight,
    width: '35%',
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '65%',
    gap: 4,
  },
  oldValue: {
    fontSize: 10,
    color: COLORS.cancel,
    textDecorationLine: 'line-through',
    maxWidth: '42%',
    textAlign: 'right',
  },
  changeArrow: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  newValue: {
    fontSize: 10,
    color: COLORS.recommend,
    fontWeight: '600',
    maxWidth: '42%',
    textAlign: 'left',
  },
});

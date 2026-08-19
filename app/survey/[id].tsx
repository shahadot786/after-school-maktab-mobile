import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { ChevronLeft, MapPin, User, Award, ShieldAlert, Phone, Edit } from 'lucide-react-native';
import { COLORS, STATUS_LABELS } from '@/lib/config';
import { getCachedSurveys, Survey } from '@/lib/storage';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

export default function SurveyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSurvey = async () => {
      setLoading(true);
      
      // 1. Try local cache first for instant load
      const cached = getCachedSurveys();
      const localSurvey = cached.find(s => s._id === id);
      
      if (localSurvey) {
        setSurvey(localSurvey);
      }

      // 2. Fetch fresh copy from server if online
      try {
        const netState = await NetInfo.fetch();
        if (netState.isConnected) {
          const response = await axios.get(`${API_BASE_URL}/api/surveys/${id}`, { timeout: 4000 });
          if (response.data && response.data.success) {
            setSurvey(response.data.data);
          }
        }
      } catch (err: any) {
        console.log('Failed to fetch survey from server, showing local version:', err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadSurvey();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!survey) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>সার্ভে রিপোর্টটি পাওয়া যায়নি।</Text>
      </View>
    );
  }

  // Formatting helpers
  const toBengaliNumber = (num: number | string | undefined): string => {
    if (num === undefined) return '';
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return COLORS.cancel;
    if (score >= 4) return COLORS.accent;
    return COLORS.recommend;
  };

  const score = survey.score || 0;
  const scoreCol = getScoreColor(score);

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Report Header Card */}
        <View style={styles.reportHeaderCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>আফটার স্কুল মাকতাব</Text>
              <Text style={styles.subtitle}>দারিদ্র্য যাচাই সার্ভে রিপোর্ট</Text>
              <Text style={styles.branchName}>{survey.branch}</Text>
            </View>
            <View style={[styles.scoreCircle, { borderColor: scoreCol }]}>
              <Text style={[styles.scoreVal, { color: scoreCol }]}>{toBengaliNumber(score)}</Text>
              <Text style={[styles.scoreLabel, { color: scoreCol }]}>স্কোর</Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          {/* Metadata Grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaCellLabel}>ফর্ম নম্বর:</Text>
              <Text style={styles.metaCellVal}>{survey.form_no}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaCellLabel}>সার্ভের তারিখ:</Text>
              <Text style={styles.metaCellVal}>{survey.survey_date}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaCellLabel}>সার্ভে পরিচালনাকারী:</Text>
              <Text style={styles.metaCellVal}>{survey.surveyor}</Text>
            </View>
          </View>

          {/* Status Banner */}
          {survey.status && (
            <View style={[styles.statusBanner, { backgroundColor: scoreCol }]}>
              <Text style={styles.statusBannerText}>
                অবস্থা: {STATUS_LABELS[survey.status]} ({survey.score_level})
              </Text>
            </View>
          )}
        </View>

        {/* Section 1: Personal Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>ব্যক্তিগত তথ্য</Text>
          </View>
          <View style={styles.sectionBody}>
            <InfoRow label="পূর্ণ নাম" value={survey.student_name} />
            <InfoRow label="বয়স" value={survey.age ? `${toBengaliNumber(survey.age)} বছর` : ''} />
            <InfoRow label="লিঙ্গ" value={survey.gender} />
            <InfoRow label="ছাত্রের ধরন" value={survey.student_type} />
            <InfoRow label="শ্রেণী" value={survey.class} />
            <InfoRow label="মাকতাবে বছর" value={survey.years ? `${toBengaliNumber(survey.years)} বছর` : ''} />
            <InfoRow label="মাকতাবে পারফরম্যান্স" value={survey.student_performance} />
          </View>
        </View>

        {/* Section 2: Address */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>ঠিকানা</Text>
          </View>
          <View style={styles.sectionBody}>
            <InfoRow label="জেলা" value={survey.district} />
            <InfoRow label="থানা/উপজেলা" value={survey.thana} />
            <InfoRow label="বিস্তারিত ঠিকানা" value={survey.address} />
          </View>
        </View>

        {/* Section 3: Family Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Award size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>পারিবারিক ও আর্থিক তথ্য</Text>
          </View>
          <View style={styles.sectionBody}>
            <InfoRow label="পিতার নাম" value={survey.father_name} />
            <InfoRow label="পিতার মোবাইল" value={survey.father_phone ? toBengaliNumber(survey.father_phone) : ''} />
            <InfoRow label="পিতার পেশা" value={survey.father_job === 'অন্যান্য' ? survey.father_job_other : survey.father_job} />
            <InfoRow label="মাতার অবস্থা" value={survey.mother_status} />
            <InfoRow label="মাতার মোবাইল" value={survey.mother_phone ? toBengaliNumber(survey.mother_phone) : ''} />
            <InfoRow label="পরিবার সদস্য" value={survey.family_size ? `${toBengaliNumber(survey.family_size)} জন` : ''} />
            <InfoRow label="উপার্জনকারী" value={survey.earners ? `${toBengaliNumber(survey.earners)} জন` : ''} />
            <InfoRow label="মাসিক আয়" value={survey.monthly_income ? `${toBengaliNumber(survey.monthly_income.toLocaleString())} ৳` : ''} />
            <InfoRow label="বাড়ির ধরন" value={survey.house_label} />
            <InfoRow label="ঋণগ্রস্ত" value={survey.debt_label} />
          </View>
        </View>

        {/* Section 4: Tags problems/recs */}
        <View style={styles.rowGrid}>
          <View style={[styles.section, styles.tagBox]}>
            <Text style={styles.tagBoxTitle}>চিহ্নিত সমস্যাসমূহ</Text>
            <View style={styles.tagsContainer}>
              {survey.problems && survey.problems.length > 0 ? (
                survey.problems.map(prob => (
                  <View key={prob} style={styles.problemTag}>
                    <Text style={styles.problemTagText}>{prob}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyTagsText}>কোনো সমস্যা চিহ্নিত করা হয়নি</Text>
              )}
            </View>
          </View>
          <View style={[styles.section, styles.tagBox]}>
            <Text style={styles.tagBoxTitle}>সুপারিশসমূহ</Text>
            <View style={styles.tagsContainer}>
              {survey.recommendations && survey.recommendations.length > 0 ? (
                survey.recommendations.map(rec => (
                  <View key={rec} style={styles.recTag}>
                    <Text style={styles.recTagText}>{rec}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyTagsText}>কোনো সুপারিশ পাওয়া যায়নি</Text>
              )}
            </View>
          </View>
        </View>

        {/* Section 5: Other support */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShieldAlert size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>শিশু ও অন্যান্য সহায়তা</Text>
          </View>
          <View style={styles.sectionBody}>
            <InfoRow label="শিশু কি কাজ করে?" value={survey.child_work} />
            {survey.child_work_details ? <InfoRow label="কাজের বিবরণ" value={survey.child_work_details} /> : null}
            <InfoRow label="অন্য সংস্থার সাহায্য?" value={survey.other_help} />
            {survey.other_help_org ? <InfoRow label="সংস্থার নাম" value={survey.other_help_org} /> : null}
            <InfoRow label="পরিদর্শন করা হয়েছে?" value={survey.visited} />
          </View>
        </View>

        {/* Recommender */}
        {(survey.recommender_name || survey.recommender_identity) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>সুপারিশকারী তথ্য</Text>
            </View>
            <View style={styles.sectionBody}>
              <InfoRow label="সুপারিশকারীর নাম" value={survey.recommender_name} />
              <InfoRow label="পরিচয় / পদবী" value={survey.recommender_identity} />
            </View>
          </View>
        )}

        {/* Remarks */}
        {survey.remarks && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>পর্যবেক্ষণ / মন্তব্য</Text>
            <View style={styles.remarksBox}>
              <Text style={styles.remarksText}>"{survey.remarks}"</Text>
            </View>
          </View>
        )}

        {/* Print Signatures representation */}
        <View style={styles.signaturesRow}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>সার্ভেকারীর স্বাক্ষর ও তারিখ</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>মাকতাব প্রধানের স্বাক্ষর</Text>
          </View>
        </View>

      </ScrollView>

      {/* Header back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <ChevronLeft size={24} color={COLORS.white} />
      </TouchableOpacity>

      {/* Header edit button */}
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => router.push(`/edit/${id}`)}
      >
        <Edit size={20} color={COLORS.white} />
      </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.cancel,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60, // Leave space for back button
    paddingBottom: 40,
  },
  reportHeaderCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  branchName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginTop: 4,
  },
  scoreCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreVal: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 6,
  },
  metaCellLabel: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  metaCellVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  statusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  statusBannerText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sectionBody: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#fcfcfc',
  },
  rowLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    width: '40%',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
    width: '60%',
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  tagBox: {
    flex: 1,
    minHeight: 120,
  },
  tagBoxTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  problemTag: {
    backgroundColor: '#fffdf6',
    borderWidth: 1,
    borderColor: '#faecd0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  problemTagText: {
    fontSize: 11,
    color: '#b7791f',
    fontWeight: '600',
  },
  recTag: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recTagText: {
    fontSize: 11,
    color: '#389e0d',
    fontWeight: '600',
  },
  emptyTagsText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  remarksBox: {
    backgroundColor: '#fffdf6',
    borderWidth: 1,
    borderColor: '#faecd0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  remarksText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 20,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.textLight,
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

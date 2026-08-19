import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Dropdown } from 'react-native-element-dropdown';
import DatePicker from 'react-native-date-picker';
import { FileText, Save, Trash2, Send, Check } from 'lucide-react-native';
import SearchableSelect from '@/components/SearchableSelect';
import geoData from '@/lib/bangladesh-data.json';
import {
  COLORS,
  SURVEYORS,
  BRANCHES,
  JOBS,
  PROBLEMS,
  RECS,
} from '@/lib/config';
import {
  getSurveyDraft,
  saveSurveyDraft,
  clearSurveyDraft,
  addToOfflineQueue,
  getCachedSurveys,
  saveCachedSurveys,
  Survey,
} from '@/lib/storage';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';

// ── Reusable Form Layout Components ──────────────────────────────────────────
const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionNumber}>{num}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const RadioGroup = ({
  options,
  value,
  onChange,
}: {
  options: string[] | [string, string][];
  value: string;
  onChange: (val: string) => void;
}) => (
  <View style={styles.radioGroup}>
    {options.map((opt) => {
      const label = Array.isArray(opt) ? opt[1] : opt;
      const keyVal = Array.isArray(opt) ? opt[0] : opt;
      const isSelected = value === keyVal;

      return (
        <TouchableOpacity
          key={keyVal}
          style={[styles.radioButton, isSelected && styles.radioSelectedButton]}
          onPress={() => onChange(keyVal)}
        >
          <Text style={[styles.radioText, isSelected && styles.radioSelectedText]}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const CheckboxGroup = ({
  options,
  selectedValues,
  onChange,
}: {
  options: string[];
  selectedValues: string[];
  onChange: (val: string) => void;
}) => (
  <View style={styles.checkboxGroup}>
    {options.map((opt) => {
      const isSelected = selectedValues.includes(opt);

      return (
        <TouchableOpacity
          key={opt}
          style={[styles.checkboxItem, isSelected && styles.checkboxItemSelected]}
          onPress={() => onChange(opt)}
        >
          <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxSelected]}>
            {isSelected && <Check size={12} color={COLORS.white} />}
          </View>
          <Text style={[styles.checkboxText, isSelected && styles.checkboxTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default function NewSurveyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Survey>>({
    form_no: '',
    survey_date: new Date().toISOString().split('T')[0],
    surveyor: '',
    branch: '',
    status: 'submit',
    student_type: '',
    student_name: '',
    age: undefined,
    gender: '',
    class: '',
    years: undefined,
    student_performance: '',
    district: '',
    thana: '',
    address: '',
    father_name: '',
    father_phone: '',
    father_job: '',
    father_job_other: '',
    mother_status: '',
    mother_phone: '',
    family_size: undefined,
    earners: undefined,
    monthly_income: undefined,
    house: '',
    land: '',
    debt: '',
    problems: [],
    child_work: '',
    child_work_details: '',
    other_help: '',
    other_help_org: '',
    visited: '',
    remarks: '',
    recommendations: [],
    recommender_name: '',
    recommender_identity: '',
  });

  const [phoneErrors, setPhoneErrors] = useState({ father: '', mother: '' });
  const isInitialMount = useRef(true);

  // ── Load Next Form No & Draft ──────────────────────────────────────────────
  useEffect(() => {
    // Generate fallback temporary Form No
    const tempFormNo = `MK-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // 1. Fetch form no from Next.js server if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        axios.get(`${API_BASE_URL}/api/surveys/next-form-no`, { timeout: 3000 })
          .then(res => {
            if (res.data && res.data.success) {
              setFormData(prev => ({ ...prev, form_no: res.data.form_no }));
            } else {
              setFormData(prev => ({ ...prev, form_no: tempFormNo }));
            }
          })
          .catch(() => setFormData(prev => ({ ...prev, form_no: tempFormNo })));
      } else {
        setFormData(prev => ({ ...prev, form_no: tempFormNo }));
      }
    });

    // 2. Restore Draft if exists
    const draft = getSurveyDraft();
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft }));
    }
  }, []);

  // ── Auto Save Draft ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveSurveyDraft(formData);
  }, [formData]);

  // ── Phone Validation ───────────────────────────────────────────────────────
  const isValidPhone = (v: string) => {
    if (!v) return false;
    const en = v.replace(/[০-৯]/g, d => '0123456789'['০১২৩৪৫৬৭৮৯'.indexOf(d)]);
    return /^01[3-9]\d{8}$/.test(en);
  };

  const validatePhone = (name: 'father' | 'mother', val: string) => {
    if (!val) {
      setPhoneErrors(prev => ({ ...prev, [name]: 'মোবাইল নম্বর দিন' }));
    } else if (!isValidPhone(val)) {
      setPhoneErrors(prev => ({ ...prev, [name]: '১১ ডিজিটের সঠিক নম্বর দিন' }));
    } else {
      setPhoneErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const setVal = (key: keyof Survey, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleInputChange = (key: keyof Survey, value: string) => {
    if (key === 'age' || key === 'years' || key === 'family_size' || key === 'earners' || key === 'monthly_income') {
      const numVal = value === '' ? undefined : parseInt(value);
      setVal(key, numVal);
    } else {
      setVal(key, value);
    }

    if (key === 'father_phone') validatePhone('father', value);
    if (key === 'mother_phone') validatePhone('mother', value);
  };

  const handleCheckboxChange = (group: 'problems' | 'recommendations', val: string) => {
    const cur = formData[group] || [];
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
    setVal(group, next);
  };

  // ── Poverty Score Calculation ──────────────────────────────────────────────
  const scoreFromIncome = (income: number | undefined): number => {
    if (income === undefined) return 0;
    if (income < 3000) return 5;
    if (income < 5000) return 4;
    if (income < 8000) return 3;
    if (income < 12000) return 2;
    return 1;
  };

  const calcScore = (): number => {
    let score = scoreFromIncome(formData.monthly_income);
    
    // House score
    const houseVal = formData.house === '2r' ? 2 : parseInt(formData.house || '0');
    score += houseVal;

    // Debt score
    score += parseInt(formData.debt || '0');

    // Family members vs earners
    const size = formData.family_size || 0;
    const earners = formData.earners || 0;
    if (size >= 6 && earners <= 1) {
      score += 1;
    }

    return Math.min(score, 10);
  };

  const scoreLevel = (s: number): string => {
    if (s >= 7) return 'অত্যন্ত সহায়তা প্রয়োজন';
    if (s >= 4) return 'মাঝারি সহায়তা প্রয়োজন';
    if (s > 0) return 'তুলনামূলক ভালো';
    return '';
  };

  const houseLabel = (v: string): string => {
    return { '3': 'কাঁচা/ছনের ঘর', '2': 'আধা-পাকা', '2r': 'ভাড়া বাসা', '1': 'পাকা ঘর' }[v] || '—';
  };

  const debtLabel = (v: string): string => {
    return { '2': 'অনেক ঋণ', '1': 'কিছুটা ঋণ', '0': 'ঋণ নেই' }[v] || '—';
  };

  // ── Completion Progress ────────────────────────────────────────────────────
  const calcProgress = (): number => {
    const reqKeys: (keyof Survey)[] = [
      'surveyor',
      'student_type',
      'student_name',
      'age',
      'gender',
      'class',
      'years',
      'district',
      'thana',
      'address',
      'father_name',
      'father_phone',
      'father_job',
      'mother_status',
      'mother_phone',
      'family_size',
      'earners',
      'monthly_income',
      'house',
      'land',
      'debt',
      'child_work',
      'other_help',
      'visited',
    ];
    let filled = reqKeys.filter(k => formData[k] !== undefined && formData[k] !== '').length;
    if (formData.problems && formData.problems.length > 0) filled++;
    if (formData.recommendations && formData.recommendations.length > 0) filled++;
    return Math.round((filled / (reqKeys.length + 2)) * 100);
  };

  const isFormValid = (): boolean => {
    const reqKeys: (keyof Survey)[] = [
      'surveyor',
      'student_type',
      'student_name',
      'age',
      'gender',
      'class',
      'years',
      'district',
      'thana',
      'address',
      'father_name',
      'father_phone',
      'father_job',
      'mother_status',
      'mother_phone',
      'family_size',
      'earners',
      'monthly_income',
      'house',
      'land',
      'debt',
      'child_work',
      'other_help',
      'visited',
    ];
    
    const fieldsFilled = reqKeys.every(k => formData[k] !== undefined && formData[k] !== '');
    const arraysFilled = (formData.problems?.length || 0) > 0 && (formData.recommendations?.length || 0) > 0;
    const noErrors = !phoneErrors.father && !phoneErrors.mother;

    return fieldsFilled && arraysFilled && noErrors;
  };

  // ── Form Submitting ────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!isFormValid()) {
      Alert.alert('অসম্পূর্ণ ফর্ম', 'অনুগ্রহ করে সব আবশ্যক (*) ক্ষেত্রগুলো সঠিক তথ্য দিয়ে পূরণ করুন।');
      return;
    }

    Alert.alert('সাবমিট নিশ্চিত করুন', 'আপনি কি নিশ্চিত যে আপনি ফর্মটি সাবমিট করতে চান?', [
      { text: 'বাতিল', style: 'cancel' },
      { text: 'সাবমিট', onPress: performSubmit }
    ]);
  };

  const performSubmit = async () => {
    setLoading(true);
    const score = calcScore();
    const houseVal = formData.house === '2r' ? '2' : formData.house || '0';
    
    // Generate a temporary local ID so we can prepend it correctly to the cached surveys list
    const targetId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const payload: Survey = {
      ...(formData as Survey),
      _id: targetId,
      house: houseVal,
      house_label: houseLabel(formData.house || '0'),
      debt_label: debtLabel(formData.debt || '0'),
      problems_text: formData.problems?.join(', ') || '',
      recommendations_text: formData.recommendations?.join(', ') || '',
      score,
      score_level: scoreLevel(score),
      isOfflinePending: true,
      saved_at: new Date().toISOString(),
    };

    try {
      // Save to offline queue
      addToOfflineQueue(payload);
      
      // Update local dashboard cache
      const cached = getCachedSurveys();
      saveCachedSurveys([payload, ...cached]);

      clearSurveyDraft();
      Alert.alert('সফল', 'সার্ভে তথ্য অফলাইনে সফলভাবে সংরক্ষিত হয়েছে। সিঙ্ক করতে সেটিংস ট্যাব ব্যবহার করুন।');
      router.replace('/(tabs)');
    } catch (e: any) {
      console.log('Failed to save survey locally:', e.message);
      Alert.alert('ত্রুটি', 'লোকাল স্টোরেজে ডাটা সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Alert.alert('ফরম্যাট রিসেট', 'আপনি কি নিশ্চিত যে আপনি ফর্মটি বাতিল করতে চান? ড্রাফট মুছে যাবে।', [
      { text: 'না', style: 'cancel' },
      {
        text: 'হ্যাঁ',
        style: 'destructive',
        onPress: () => {
          clearSurveyDraft();
          router.replace('/(tabs)');
        }
      }
    ]);
  };

  // Form selections references
  const selectedDistrictData = geoData.find(d => d.bn_name === formData.district);
  const upazilas = selectedDistrictData ? selectedDistrictData.upazilas : [];
  
  const score = calcScore();
  const progress = calcProgress();
  const isValid = isFormValid();

  // Helper formatting numbers for view
  const toBengaliNumber = (num: number | string | undefined): string => {
    if (num === undefined) return '';
    return num.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Progress Bar Header */}
        <View style={styles.progressHeader}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>সার্ভে পূরণের অগ্রগতি</Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Section 1: Form Meta */}
          <Section num="১" title="ফর্মের তথ্য">
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>তারিখ *</Text>
                <TouchableOpacity
                  style={styles.dateInputTouchable}
                  onPress={() => setPickerOpen(true)}
                >
                  <Text style={styles.dateInputText}>
                    {formData.survey_date ? toBengaliNumber(formData.survey_date) : 'তারিখ বেছে নিন'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>শাখা *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={BRANCHES.map(b => ({ label: b, value: b }))}
                  labelField="label"
                  valueField="value"
                  placeholder="শাখা বেছে নিন"
                  value={formData.branch}
                  onChange={item => setVal('branch', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>সার্ভে পরিচালনাকারী *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={SURVEYORS.map(n => ({ label: n, value: n }))}
                  labelField="label"
                  valueField="value"
                  placeholder="নাম বেছে নিন"
                  value={formData.surveyor}
                  onChange={item => setVal('surveyor', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>ধরন *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'ছাত্র', value: 'ছাত্র' },
                    { label: 'সাধারণ মানুষ', value: 'সাধারণ মানুষ' },
                    { label: 'নও মুসলিম', value: 'নও মুসলিম' }
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="বেছে নিন"
                  value={formData.student_type}
                  onChange={item => setVal('student_type', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
            </View>
          </Section>

          {/* Section 2: Student Info */}
          <Section num="২" title="ছাত্র/ছাত্রীর ব্যক্তিগত তথ্য">
            <View style={styles.field}>
              <Text style={styles.label}>পূর্ণ নাম *</Text>
              <TextInput
                style={styles.input}
                placeholder="ছাত্র/ছাত্রীর সম্পূর্ণ নাম"
                value={formData.student_name}
                onChangeText={(val) => handleInputChange('student_name', val)}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>বয়স *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="বছর"
                  keyboardType="numeric"
                  value={formData.age !== undefined ? String(formData.age) : ''}
                  onChangeText={(val) => handleInputChange('age', val)}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>লিঙ্গ *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'ছাত্র (ছেলে)', value: 'ছাত্র (ছেলে)' },
                    { label: 'ছাত্রী (মেয়ে)', value: 'ছাত্রী (মেয়ে)' }
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="বেছে নিন"
                  value={formData.gender}
                  onChange={item => setVal('gender', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>শ্রেণী *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={['প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম'].map(c => ({ label: c, value: c }))}
                  labelField="label"
                  valueField="value"
                  placeholder="বেছে নিন"
                  value={formData.class}
                  onChange={item => setVal('class', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>মাকতাবে কত বছর? *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="বছর"
                  keyboardType="numeric"
                  value={formData.years !== undefined ? String(formData.years) : ''}
                  onChangeText={(val) => handleInputChange('years', val)}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>মাকতাবে ছাত্রের পারফরম্যান্স</Text>
              <RadioGroup
                options={['ভালো', 'মধ্যম', 'খারাপ']}
                value={formData.student_performance || ''}
                onChange={(val) => setVal('student_performance', val)}
              />
            </View>
          </Section>

          {/* Section 3: Address */}
          <Section num="৩" title="ঠিকানা">
            <View style={styles.row}>
              <SearchableSelect
                label="জেলা *"
                placeholder="জেলা খুঁজুন..."
                options={geoData}
                value={formData.district || ''}
                onChange={(val) => {
                  setVal('district', val);
                  setVal('thana', '');
                }}
              />
              <SearchableSelect
                label="থানা/উপজেলা *"
                placeholder="থানা খুঁজুন..."
                options={upazilas}
                value={formData.thana || ''}
                onChange={(val) => setVal('thana', val)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>বিস্তারিত ঠিকানা *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="গ্রাম, ডাকঘর, উপজেলা..."
                multiline
                numberOfLines={3}
                value={formData.address}
                onChangeText={(val) => handleInputChange('address', val)}
              />
            </View>
          </Section>

          {/* Section 4: Family Info */}
          <Section num="৪" title="পরিবারের তথ্য">
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>পিতার নাম *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="পিতার নাম"
                  value={formData.father_name}
                  onChangeText={(val) => handleInputChange('father_name', val)}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>পিতার ফোন নম্বর *</Text>
                <TextInput
                  style={[styles.input, phoneErrors.father ? styles.errorInput : null]}
                  placeholder="01XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={formData.father_phone}
                  onChangeText={(val) => handleInputChange('father_phone', val)}
                />
                {phoneErrors.father ? <Text style={styles.errorText}>{phoneErrors.father}</Text> : null}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>পিতার পেশা *</Text>
              <Dropdown
                style={styles.dropdown}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                data={JOBS.map(j => ({ label: j, value: j }))}
                labelField="label"
                valueField="value"
                placeholder="পেশা বেছে নিন"
                value={formData.father_job}
                onChange={item => setVal('father_job', item.value)}
                activeColor="#f2fbf6"
              />
            </View>

            {formData.father_job === 'অন্যান্য' && (
              <View style={styles.field}>
                <Text style={styles.label}>পেশার বিবরণ *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="পেশার বিবরণ লিখুন"
                  value={formData.father_job_other}
                  onChangeText={(val) => handleInputChange('father_job_other', val)}
                />
              </View>
            )}

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>মাতার অবস্থা *</Text>
                <Dropdown
                  style={styles.dropdown}
                  placeholderStyle={styles.dropdownPlaceholder}
                  selectedTextStyle={styles.dropdownSelectedText}
                  data={[
                    { label: 'গৃহিণী', value: 'গৃহিণী' },
                    { label: 'কর্মজীবী', value: 'কর্মজীবী' },
                    { label: 'অসুস্থ', value: 'অসুস্থ' },
                    { label: 'মৃত', value: 'মৃত' }
                  ]}
                  labelField="label"
                  valueField="value"
                  placeholder="বেছে নিন"
                  value={formData.mother_status}
                  onChange={item => setVal('mother_status', item.value)}
                  activeColor="#f2fbf6"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>মাতার ফোন নম্বর *</Text>
                <TextInput
                  style={[styles.input, phoneErrors.mother ? styles.errorInput : null]}
                  placeholder="01XXXXXXXXX"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={formData.mother_phone}
                  onChangeText={(val) => handleInputChange('mother_phone', val)}
                />
                {phoneErrors.mother ? <Text style={styles.errorText}>{phoneErrors.mother}</Text> : null}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>মোট পরিবার সদস্য *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="জন"
                  keyboardType="numeric"
                  value={formData.family_size !== undefined ? String(formData.family_size) : ''}
                  onChangeText={(val) => handleInputChange('family_size', val)}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>উপার্জনকারী সদস্য *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="জন"
                  keyboardType="numeric"
                  value={formData.earners !== undefined ? String(formData.earners) : ''}
                  onChangeText={(val) => handleInputChange('earners', val)}
                />
              </View>
            </View>
          </Section>

          {/* Section 5: Financial State */}
          <Section num="৫" title="পারিবারিক আর্থিক অবস্থা">
            <View style={styles.field}>
              <Text style={styles.label}>মাসিক নির্দিষ্ট আয় (টাকায়) *</Text>
              <TextInput
                style={styles.input}
                placeholder="যেমন: 5000"
                keyboardType="numeric"
                value={formData.monthly_income !== undefined ? String(formData.monthly_income) : ''}
                onChangeText={(val) => handleInputChange('monthly_income', val)}
              />
              {formData.monthly_income !== undefined && (
                <Text style={styles.incomeHint}>
                  আই রেঞ্জ: {formData.monthly_income < 3000 ? '৩,০০০ টাকার কম' : formData.monthly_income < 5000 ? '৩,০০০–৫,০০০ টাকা' : formData.monthly_income < 8000 ? '৫,০০০–৮,০০০ টাকা' : formData.monthly_income < 12000 ? '৮,০০০–১২,০০০ টাকা' : '১২,০০০+ টাকা'}
                </Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>বাড়ির ধরন *</Text>
              <RadioGroup
                options={[
                  ['3', 'কাঁচা/ছনের ঘর'],
                  ['2', 'আধা-পাকা'],
                  ['2r', 'ভাড়া বাসা'],
                  ['1', 'পাকা ঘর'],
                ]}
                value={formData.house || ''}
                onChange={(val) => setVal('house', val)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>জমি বা সম্পদ আছে? *</Text>
              <RadioGroup
                options={['কোনো জমি নেই', 'সামান্য জমি', 'পর্যাপ্ত জমি']}
                value={formData.land || ''}
                onChange={(val) => setVal('land', val)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>পরিবার কি ঋণগ্রস্ত? *</Text>
              <RadioGroup
                options={[
                  ['2', 'হ্যাঁ, অনেক ঋণ'],
                  ['1', 'কিছুটা ঋণ'],
                  ['0', 'না, ঋণ নেই'],
                ]}
                value={formData.debt || ''}
                onChange={(val) => setVal('debt', val)}
              />
            </View>
          </Section>

          {/* Section 6: Problems */}
          <Section num="৬" title="শিক্ষার্থীর সমস্যা">
            <View style={styles.field}>
              <Text style={styles.label}>কী কী সমস্যা আছে? (কমপক্ষে ১টি সিলেক্ট করুন) *</Text>
              <CheckboxGroup
                options={PROBLEMS}
                selectedValues={formData.problems || []}
                onChange={(val) => handleCheckboxChange('problems', val)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>শিশু কি কাজ করে? *</Text>
              <RadioGroup
                options={['হ্যাঁ', 'মাঝে মাঝে', 'না']}
                value={formData.child_work || ''}
                onChange={(val) => setVal('child_work', val)}
              />
            </View>

            {(formData.child_work === 'হ্যাঁ' || formData.child_work === 'মাঝে মাঝে') && (
              <View style={styles.field}>
                <Text style={styles.label}>কী কাজ করে? *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="কাজের বিবরণ লিখুন"
                  value={formData.child_work_details}
                  onChangeText={(val) => handleInputChange('child_work_details', val)}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>অন্য সংস্থার সহায়তা পাচ্ছে? *</Text>
              <RadioGroup
                options={['হ্যাঁ', 'না']}
                value={formData.other_help || ''}
                onChange={(val) => setVal('other_help', val)}
              />
            </View>

            {formData.other_help === 'হ্যাঁ' && (
              <View style={styles.field}>
                <Text style={styles.label}>সংস্থার নাম *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="সংস্থার নাম লিখুন"
                  value={formData.other_help_org}
                  onChangeText={(val) => handleInputChange('other_help_org', val)}
                />
              </View>
            )}
          </Section>

          {/* Section 7: Observations */}
          <Section num="৭" title="পর্যবেক্ষণ ও সুপারিশ">
            <View style={styles.field}>
              <Text style={styles.label}>পরিবার পরিদর্শন করা হয়েছে? *</Text>
              <RadioGroup
                options={['হ্যাঁ, পরিদর্শন করা হয়েছে', 'না, শুধু ফর্ম পূরণ']}
                value={formData.visited || ''}
                onChange={(val) => setVal('visited', val)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>সুপারিশসমূহ (কমপক্ষে ১টি সিলেক্ট করুন) *</Text>
              <CheckboxGroup
                options={RECS}
                selectedValues={formData.recommendations || []}
                onChange={(val) => handleCheckboxChange('recommendations', val)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>পর্যবেক্ষণ / মন্তব্য (ঐচ্ছিক)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="পরিবারের সার্বিক অবস্থা লিখুন..."
                multiline
                numberOfLines={4}
                value={formData.remarks}
                onChangeText={(val) => handleInputChange('remarks', val)}
              />
            </View>
          </Section>

          {/* Section 8: Recommender (Optional) */}
          <Section num="৮" title="সুপারিশকারী তথ্য (ঐচ্ছিক)">
            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>সুপারিশকারীর নাম</Text>
                <TextInput
                  style={styles.input}
                  placeholder="মাওলানা আব্দুল হান্নান..."
                  value={formData.recommender_name}
                  onChangeText={(val) => handleInputChange('recommender_name', val)}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>পরিচয়</Text>
                <TextInput
                  style={styles.input}
                  placeholder="মাক্কি মসজিদের ইমাম..."
                  value={formData.recommender_identity}
                  onChangeText={(val) => handleInputChange('recommender_identity', val)}
                />
              </View>
            </View>
          </Section>

          {/* Score Level Cards Preview */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreHeader}>দারিদ্র্য স্ট্যাটাস / স্কোর</Text>
            <Text style={styles.scoreNumber}>{toBengaliNumber(score)}/১০</Text>
            <Text style={[styles.scoreLevel, { color: score >= 7 ? COLORS.cancel : score >= 4 ? COLORS.accent : COLORS.recommend }]}>
              {scoreLevel(score)}
            </Text>
          </View>
          
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleReset}
          >
            <Trash2 size={18} color={COLORS.text} style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>বাতিল</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
            disabled={loading || !isValid}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Send size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>সাবমিট করুন</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <DatePicker
        modal
        open={pickerOpen}
        date={formData.survey_date ? new Date(formData.survey_date) : new Date()}
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
          setVal('survey_date', `${yyyy}-${mm}-${dd}`);
        }}
        onCancel={() => {
          setPickerOpen(false);
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
  progressHeader: {
    backgroundColor: COLORS.cardBg,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
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
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 8,
  },
  sectionNumber: {
    backgroundColor: COLORS.accent,
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sectionBody: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: COLORS.text,
  },
  readOnlyInput: {
    opacity: 0.7,
    backgroundColor: '#eceff1',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  errorInput: {
    borderColor: COLORS.cancel,
  },
  errorText: {
    color: COLORS.cancel,
    fontSize: 11,
    marginTop: 4,
  },
  dropdown: {
    height: 44,
    borderColor: '#d0e3d7',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: COLORS.text,
  },
  dateInputTouchable: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  dateInputText: {
    fontSize: 14,
    color: COLORS.text,
  },
  incomeHint: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  radioButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    backgroundColor: COLORS.background,
  },
  radioSelectedButton: {
    backgroundColor: '#e8f5ee',
    borderColor: COLORS.primary,
  },
  radioText: {
    fontSize: 13,
    color: COLORS.text,
  },
  radioSelectedText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  checkboxGroup: {
    gap: 8,
    marginTop: 4,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    backgroundColor: COLORS.background,
  },
  checkboxItemSelected: {
    backgroundColor: '#e8f5ee',
    borderColor: COLORS.primary,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxSelected: {
    backgroundColor: COLORS.primary,
  },
  checkboxText: {
    fontSize: 13,
    color: COLORS.text,
  },
  checkboxTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  scoreContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreHeader: {
    fontSize: 11,
    color: COLORS.white,
    opacity: 0.8,
    marginBottom: 6,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  scoreLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
  },
  footerActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

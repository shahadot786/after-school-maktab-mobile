import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Search, ChevronDown, X } from 'lucide-react-native';
import { COLORS } from '@/lib/config';

interface Option {
  id?: string | number;
  bn_name?: string;
  [key: string]: any;
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  options: (string | Option)[];
  value: string;
  onChange: (value: string) => void;
}

export default function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: SearchableSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Normalize options to a list of strings
  const stringOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') return opt;
      return opt.bn_name || '';
    }).filter(Boolean);
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return stringOptions;
    const q = searchQuery.toLowerCase().trim();
    return stringOptions.filter(opt => opt.toLowerCase().includes(q));
  }, [stringOptions, searchQuery]);

  const handleSelect = (val: string) => {
    onChange(val);
    setSearchQuery('');
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selectButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.selectButtonText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <ChevronDown size={18} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{placeholder}</Text>
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setModalVisible(false);
              }}
              style={styles.closeButton}
            >
              <X size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchBarContainer}>
            <Search size={18} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="খুঁজুন..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {/* List */}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item, index) => `${item}_${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  value === item && styles.selectedOptionItem,
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === item && styles.selectedOptionText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>কোনো ফলাফল পাওয়া যায়নি</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectButtonText: {
    fontSize: 14,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.textLight,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  closeButton: {
    padding: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: '#d0e3d7',
    borderRadius: 8,
    margin: 12,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    borderRadius: 4,
    marginBottom: 2,
  },
  selectedOptionItem: {
    backgroundColor: '#e8f5ee',
  },
  optionText: {
    fontSize: 15,
    color: COLORS.text,
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
});

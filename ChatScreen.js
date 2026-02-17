import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, TextInput, Keyboard, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FONT, BorderRadius, Spacing, Shadows } from './theme';
import { supabase } from './supabase';
import TimeCalculator from './TimeCalculator';

// Базовий URL для зображень таблиць
// Використовується коли URL починається з /images/tables/
// Потрібно створити bucket "tables" в Supabase Storage і завантажити туди зображення
const IMAGE_BASE_URL = 'https://klqxadvtvxvizgdjmegx.supabase.co/storage/v1/object/public/tables/';

export default function ChatScreen({ route, navigation }) {
  const [view, setView] = useState('documents'); // documents | sections | content
  const [documents, setDocuments] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({}); // Track expanded sections

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Time calculator state
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    console.log('Loading documents...');
    setLoading(true);
    const { data, error } = await supabase
      .from('guide_documents')
      .select('*')
      .order('order_num');
    console.log('Raw Supabase response:', { data, error });
    if (!error && data) {
      setDocuments(data);
    } else {
      console.log('Error loading documents:', error);
      setDocuments([]);
    }
    setLoading(false);
  };

  // Search function with debounce
  const performSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    const searchTerm = query.trim();

    // Search in title and content using ILIKE
    const { data, error } = await supabase
      .from('guide_sections')
      .select('id, title, content, document_id, guide_documents(title_short, title)')
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .limit(15);

    if (!error && data) {
      // Process results to create excerpts
      const results = data.map(section => {
        let excerpt = '';
        const content = section.content || '';
        const title = section.title || '';

        // Find the search term position in content
        const contentLower = content.toLowerCase();
        const searchTermLower = searchTerm.toLowerCase();
        const pos = contentLower.indexOf(searchTermLower);

        if (pos !== -1) {
          // Get context around the match (50 chars before and 150 after)
          const start = Math.max(0, pos - 50);
          const end = Math.min(content.length, pos + searchTerm.length + 150);
          excerpt = (start > 0 ? '...' : '') +
                    content.substring(start, end) +
                    (end < content.length ? '...' : '');
        } else if (title.toLowerCase().includes(searchTermLower)) {
          // If match is in title, show beginning of content
          excerpt = content.substring(0, 150) + (content.length > 150 ? '...' : '');
        }

        return {
          id: section.id,
          title: section.title,
          excerpt,
          documentId: section.document_id,
          documentTitle: section.guide_documents?.title_short || 'Документ'
        };
      });

      setSearchResults(results);
    }

    setIsSearching(false);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSearchResultClick = async (result) => {
    // Find the document
    const doc = documents.find(d => d.id === result.documentId);
    if (doc) {
      // Navigate to the document
      setSelectedDoc(doc);

      // Load sections and find the target section
      const { data, error } = await supabase
        .from('guide_sections')
        .select('*')
        .eq('document_id', doc.id)
        .order('order_num');

      if (!error && data) {
        // Build subsections map
        const sectionMap = new Map(data.map(s => [s.id, s]));

        // Load root sections with subsections
        const rootSections = data.filter(s => s.parent_id === null);
        const sectionsWithSubsections = rootSections.map(section => {
          const subsections = data.filter(s => s.parent_id === section.id);
          return { ...section, subsections };
        });

        setSections(sectionsWithSubsections);

        // Find the target section and expand path to it
        const targetSection = data.find(s => s.id === result.id);
        if (targetSection) {
          // Expand all parent sections
          const newExpanded = {};
          let current = targetSection;
          while (current.parent_id) {
            newExpanded[current.parent_id] = true;
            current = sectionMap.get(current.parent_id);
          }
          setExpandedSections(newExpanded);

          // Check if section has children - show sections view, otherwise show content
          const hasChildren = data.some(s => s.parent_id === targetSection.id);
          if (!hasChildren) {
            setSelectedSection(targetSection);
            setView('content');
          } else {
            setView('sections');
          }
        } else {
          setView('sections');
        }
      }
    }

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    Keyboard.dismiss();
  };

  const loadSections = async (docId) => {
    console.log('Loading sections for doc:', docId);
    const { data, error } = await supabase
      .from('guide_sections')
      .select('*')
      .eq('document_id', docId)
      .is('parent_id', null)
      .order('order_num');
    console.log('Sections loaded:', data?.length || 0, error);
    if (!error && data) {
      // Load subsections for each section
      const sectionsWithSubsections = await Promise.all(
        data.map(async (section) => {
          const { data: subsections } = await supabase
            .from('guide_sections')
            .select('*')
            .eq('parent_id', section.id)
            .order('order_num');
          return { ...section, subsections: subsections || [] };
        })
      );
      setSections(sectionsWithSubsections);
      setExpandedSections({});
    } else {
      console.log('Error loading sections:', error);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleDocumentClick = (doc) => {
    setSelectedDoc(doc);
    loadSections(doc.id);
    setView('sections');
    setSelectedSection(null);
  };

  const handleSectionClick = (section) => {
    // If section has subsections, toggle expand
    if (section.subsections && section.subsections.length > 0) {
      toggleSection(section.id);
    } else if (section.content) {
      // Section has content - show it
      setSelectedSection(section);
      setView('content');
    }
  };

  const handleBack = () => {
    if (view === 'content') {
      setView('sections');
      setSelectedSection(null);
    } else if (view === 'sections') {
      setView('documents');
      setSelectedDoc(null);
      setSections([]);
    }
  };

  const getTitle = () => {
    if (view === 'documents') return '';
    if (view === 'sections') return selectedDoc?.title_short || '';
    if (view === 'content') return selectedSection?.title || 'Зміст';
    return '';
  };

  const renderDocument = ({ item: doc }) => (
    <TouchableOpacity style={styles.docCard} onPress={() => handleDocumentClick(doc)}>
      <Ionicons name="book-outline" size={28} color={Colors.textTertiary} />
      <View style={styles.docInfo}>
        <Text style={styles.docTitle}>{doc.title_short}</Text>
        <Text style={styles.docSubtitle}>{doc.title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item: result }) => (
    <TouchableOpacity
      style={styles.searchResultCard}
      onPress={() => handleSearchResultClick(result)}
    >
      <Text style={styles.searchResultDoc}>{result.documentTitle}</Text>
      <Text style={styles.searchResultTitle}>{result.title}</Text>
      {result.excerpt ? (
        <Text style={styles.searchResultExcerpt} numberOfLines={3}>{result.excerpt}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const renderDocumentsView = () => (
    <View style={{ flex: 1 }}>
      {/* Time calculator button */}
      <View style={styles.calcButtonContainer}>
        <TouchableOpacity
          style={styles.calcButton}
          onPress={() => setShowCalculator(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color="#555860" />
          <Text style={styles.calcButtonText}>Авіаційний калькулятор</Text>
        </TouchableOpacity>
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Пошук по документах..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search results or documents list */}
      {showSearchResults ? (
        <View style={{ flex: 1 }}>
          {isSearching ? (
            <View style={styles.searchingContainer}>
              <Text style={styles.searchingText}>Пошук...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.searchResultsList}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>Нічого не знайдено</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );

  const renderSubsection = (subsection) => (
    <TouchableOpacity
      style={styles.subsectionCard}
      onPress={() => {
        setSelectedSection(subsection);
        setView('content');
      }}
    >
      <Text style={styles.subsectionTitle}>{subsection.title}</Text>
    </TouchableOpacity>
  );

  const renderSection = ({ item: section }) => {
    const isExpanded = expandedSections[section.id];
    const hasSubsections = section.subsections && section.subsections.length > 0;
    const hasContent = section.content && section.content.length > 0;

    return (
      <View style={styles.sectionWrapper}>
        <TouchableOpacity
          style={styles.sectionCard}
          onPress={() => handleSectionClick(section)}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {section.title}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && hasSubsections && (
          <View style={styles.subsectionsList}>
            {section.subsections.map((sub, i) => (
              <View key={sub.id || i}>
                {renderSubsection(sub)}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Парсинг контенту з підтримкою зображень таблиць
  const parseContent = (content) => {
    if (!content) return [];

    const elements = [];
    const lines = content.split('\n');
    let currentParagraph = [];
    let inTable = false;
    let tableLines = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n');
        if (text.trim()) {
          elements.push({ type: 'text', content: text });
        }
        currentParagraph = [];
      }
    };

    const flushTable = () => {
      if (tableLines.length > 0) {
        const tableText = tableLines.join('\n');
        // Перевіряємо чи це посилання на зображення таблиці: ![table](url)
        const imgMatch = tableText.match(/!\[table\]\(([^)]+)\)/);
        if (imgMatch) {
          elements.push({ type: 'image', url: imgMatch[1] });
        } else {
          // Звичайна markdown таблиця - показуємо як текст (поки не конвертовано)
          elements.push({ type: 'table-text', content: tableText });
        }
        tableLines = [];
        inTable = false;
      }
    };

    for (const line of lines) {
      // Перевірка на посилання на зображення таблиці
      if (line.includes('![table](')) {
        flushParagraph();
        const imgMatch = line.match(/!\[table\]\(([^)]+)\)/);
        if (imgMatch) {
          elements.push({ type: 'image', url: imgMatch[1] });
        }
        continue;
      }

      // Перевірка на markdown таблицю
      if (line.startsWith('|') && line.endsWith('|')) {
        flushParagraph();
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(line);
        continue;
      }

      // Не таблиця
      if (inTable) {
        flushTable();
      }

      // Порожній рядок = новий параграф
      if (line.trim() === '') {
        flushParagraph();
        continue;
      }

      currentParagraph.push(line);
    }

    // Flush remaining content
    flushParagraph();
    flushTable();

    return elements;
  };

  // Рендеринг елемента контенту
  const renderContentElement = (element, index) => {
    if (element.type === 'image') {
      // Підтримка base64 (data:), http(s) URL, та локальних шляхів
      let imageUrl = element.url;
      if (!element.url.startsWith('http') && !element.url.startsWith('data:')) {
        imageUrl = IMAGE_BASE_URL + element.url.replace('/images/tables/', '');
      }
      return (
        <View key={index} style={styles.tableImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.tableImage}
            resizeMode="contain"
          />
        </View>
      );
    }

    if (element.type === 'table-text') {
      // Markdown таблиця як текст (до конвертації)
      return (
        <View key={index} style={styles.tableTextContainer}>
          <Text style={styles.tableText}>{element.content}</Text>
        </View>
      );
    }

    // Звичайний текст з форматуванням
    const formattedText = element.content
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Видаляємо ** для bold
      .replace(/\[([^\]]+)\]\(#(\d+)\)/g, '$1'); // Видаляємо посилання

    return (
      <Text key={index} style={styles.contentText}>{formattedText}</Text>
    );
  };

  const renderContent = () => {
    if (!selectedSection?.content) return null;

    const elements = parseContent(selectedSection.content);

    return (
      <View style={styles.contentContainer}>
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollContent}>
          {elements.map((el, idx) => renderContentElement(el, idx))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {view !== 'documents' && (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{getTitle()}</Text>
          {view === 'documents' && <View style={styles.placeholder} />}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      ) : view === 'documents' ? (
        renderDocumentsView()
      ) : view === 'sections' ? (
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.contentWrapper}>
          {renderContent()}
        </View>
      )}

      {/* Time Calculator Modal */}
      <TimeCalculator
        visible={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    minWidth: 60,
  },
  backText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  title: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 60,
  },
  list: {
    padding: Spacing.md,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginVertical: 4,
  },
  docInfo: {
    flex: 1,
    marginLeft: 12,
  },
  docTitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  docSubtitle: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  sectionWrapper: {
    marginBottom: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  sectionCardWithContent: {
    backgroundColor: '#F8F9FA',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    flex: 1,
  },
  sectionTitleWithContent: {
    color: Colors.primary,
  },
  subsectionsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: '#FAFAFA',
  },
  subsectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    marginLeft: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subsectionTitle: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  contentText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  // Table image styles
  tableImageContainer: {
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tableImage: {
    width: '100%',
    minHeight: 100,
    maxHeight: 600,
  },
  tableTextContainer: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textTertiary,
    marginTop: 12,
  },
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 4,
  },
  searchResultsList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchResultDoc: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400',
    color: '#6366F1',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchResultTitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: '#111827',
    marginBottom: 4,
  },
  searchResultExcerpt: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 18,
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  searchingText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textTertiary,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textTertiary,
  },
  // Time calculator button
  calcButtonContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9DBDE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B0B3B8',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    width: '80%',
    gap: 10,
  },
  calcButtonText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400',
    color: '#555860',
  },
});

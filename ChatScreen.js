import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FONT, BorderRadius, Spacing, Shadows } from './theme';
import { supabase } from './supabase';

export default function ChatScreen({ route, navigation }) {
  const [view, setView] = useState('documents'); // documents | sections | content
  const [documents, setDocuments] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({}); // Track expanded sections

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
    if (view === 'documents') return 'Керівні документи';
    if (view === 'sections') return selectedDoc?.title_short || 'Керівні документи';
    if (view === 'content') return selectedSection?.title || 'Відповідь';
    return 'Керівні документи';
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

  const renderContent = () => {
    if (!selectedSection?.content) return null;
    return (
      <View style={styles.contentContainer}>
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollContent}>
          <Text style={styles.contentText}>{selectedSection.content}</Text>
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
        <FlatList
          data={documents}
          renderItem={renderDocument}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
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
});

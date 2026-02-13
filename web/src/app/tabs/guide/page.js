'use client';
import { useEffect, useState } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoDocumentTextOutline, IoChevronDownOutline, IoAirplane } from 'react-icons/io5';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

export default function GuidePage() {
  const [view, setView] = useState('documents'); // documents | sections | content | in_development
  const [documents, setDocuments] = useState([]);
  const [sections, setSections] = useState([]); // Current level sections being displayed
  const [sectionTree, setSectionTree] = useState(null); // Full tree for document
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState([]);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guide_documents')
      .select('*')
      .order('order_num');
    if (!error && data) setDocuments(data);
    setLoading(false);
  };

  const loadSectionsTree = async (docId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guide_sections')
      .select('*')
      .eq('document_id', docId)
      .order('order_num');

    if (!error && data) {
      // Build tree structure
      const rootSections = data.filter(s => s.parent_id === null);
      const sectionMap = new Map(data.map(s => [s.id, s]));

      // Recursive function to get children
      const getChildren = (parentId) => {
        return data
          .filter(s => s.parent_id === parentId)
          .map(s => ({
            ...s,
            children: getChildren(s.id)
          }));
      };

      const tree = rootSections.map(section => ({
        ...section,
        children: getChildren(section.id)
      }));

      setSectionTree(tree);
      setSections(tree);
    }
    setLoading(false);
  };

  const handleDocumentClick = async (doc) => {
    setSelectedDoc(doc);
    setBreadcrumb([{ title: doc.title_short, id: null }]);

    // Check if this is ПВП ДАУ (id=1) - it has sections
    if (doc.id === 1) {
      loadSectionsTree(doc.id);
      setView('sections');
    } else {
      // Other documents show "В розробці"
      setView('in_development');
    }
    setExpandedSections(new Set());
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSectionClick = (section, depth = 0) => {
    const hasChildren = section.children && section.children.length > 0;

    if (hasChildren) {
      // Expand/collapse this section
      toggleSection(section.id);
    } else {
      // Show content
      setSelectedSection(section);
      setView('content');
    }
  };

  const handleBack = () => {
    if (view === 'content') {
      setView('sections');
      setSelectedSection(null);
    } else if (view === 'sections' || view === 'in_development') {
      setView('documents');
      setSelectedDoc(null);
      setSections([]);
      setSectionTree(null);
      setBreadcrumb([]);
    }
  };

  const getSectionNumber = (title) => {
    const match = title.match(/^([IVXLCDM]+)\.\s*(.*)/);
    if (match) {
      return { num: match[1], name: match[2] };
    }
    // Try numeric pattern
    const numMatch = title.match(/^(\d+)\.\s*(.*)/);
    if (numMatch) {
      return { num: numMatch[1], name: numMatch[2] };
    }
    return { num: '', name: title };
  };

  const renderSection = (section, depth = 0) => {
    const isExpanded = expandedSections.has(section.id);
    const hasChildren = section.children && section.children.length > 0;
    const { num, name } = getSectionNumber(section.title);

    return (
      <div key={section.id} style={{ marginLeft: depth * 16 }}>
        <div
          onClick={() => handleSectionClick(section, depth)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px',
            background: '#FFFFFF',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            marginBottom: 6,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
        >
          {num && (
            <span style={{
              fontSize: 13,
              fontWeight: 400,
              color: '#6366F1',
              marginRight: 8,
              minWidth: 24
            }}>
              {num}
            </span>
          )}
          <span style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 400,
            color: '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {name || section.title}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ marginTop: 6 }}>
            {section.children.map(child => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getHeaderText = () => {
    if (view === 'documents') return 'Керівні документи';
    if (view === 'sections' || view === 'in_development') return selectedDoc?.title_short || 'Керівні документи';
    if (view === 'content') return selectedSection?.title || 'Зміст';
    return 'Керівні документи';
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        {view !== 'documents' && (
          <button className={s.topBarBack} onClick={handleBack}>
            <IoChevronBackOutline size={24} />
          </button>
        )}
        <div className={s.topBarTitle}>
          {getHeaderText()}
        </div>
        {view === 'documents' && <div style={{ width: 32 }} />}
      </div>

      {loading ? (
        <div className={s.loadingWrap}>
          <div className={s.spinner} />
          <div className={s.loadingText}>Завантаження...</div>
        </div>
      ) : view === 'documents' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDocumentClick(doc)}
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                padding: '16px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
              }}
            >
              <IoDocumentTextOutline size={24} color="#6B7280" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 400, color: '#111827' }}>
                  {doc.title_short}
                </div>
                <div style={{ fontSize: 13, fontWeight: 400, color: '#6B7280', marginTop: 2 }}>
                  {doc.title}
                </div>
              </div>
              <IoChevronForwardOutline size={20} color="#9CA3AF" />
            </div>
          ))}
        </div>
      ) : view === 'in_development' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          textAlign: 'center'
        }}>
          <IoAirplane size={80} color="#9CA3AF" style={{ marginBottom: 24 }} />
          <div style={{ fontSize: 18, fontWeight: 400, color: '#6B7280' }}>
            В розробці
          </div>
        </div>
      ) : view === 'sections' ? (
        <div style={{ paddingBottom: 20 }}>
          {sections.length === 0 ? (
            <div className={s.emptyText}>Розділів ще немає</div>
          ) : (
            sections.map(section => renderSection(section))
          )}
        </div>
      ) : (
        <div className={s.card} style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {selectedSection?.content || ''}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState, useMemo } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoDocumentTextOutline, IoChevronDownOutline } from 'react-icons/io5';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';

export default function GuidePage() {
  const [view, setView] = useState('documents');
  const [documents, setDocuments] = useState([]);
  const [sectionTree, setSectionTree] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const sectionMap = new Map();
      data.forEach(s => sectionMap.set(s.id, { ...s, children: [] }));

      // Link children to parents
      data.forEach(s => {
        if (s.parent_id && sectionMap.has(s.parent_id)) {
          sectionMap.get(s.parent_id).children.push(sectionMap.get(s.id));
        }
      });

      // Get root sections (no parent)
      const tree = data
        .filter(s => s.parent_id === null)
        .map(s => sectionMap.get(s.id))
        .filter(Boolean);

      setSectionTree(tree);
    }
    setLoading(false);
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

  const handleDocumentClick = (doc) => {
    setSelectedDoc(doc);
    loadSectionsTree(doc.id);
    setView('sections');
    setExpandedSections(new Set());
  };

  const handleSectionClick = (section) => {
    const hasChildren = section.children && section.children.length > 0;

    if (hasChildren) {
      toggleSection(section.id);
    } else {
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
      setSectionTree([]);
    }
  };

  const parseSectionTitle = (title) => {
    // Try Roman numeral pattern first: I., II., III., etc.
    const romanMatch = title.match(/^([IVXLCDM]+)\.\s*(.+)/);
    if (romanMatch) {
      return { num: romanMatch[1], name: romanMatch[2].trim(), isRoman: true };
    }
    // Try numeric pattern: 1., 2., etc.
    const numMatch = title.match(/^(\d+)\.\s*(.+)/);
    if (numMatch) {
      return { num: numMatch[1], name: numMatch[2].trim(), isRoman: false };
    }
    // No number
    return { num: null, name: title, isRoman: false };
  };

  // Memoized render function for sections
  const SectionItem = ({ section, depth = 0 }) => {
    const isExpanded = expandedSections.has(section.id);
    const hasChildren = section.children && section.children.length > 0;
    const { num, name, isRoman } = parseSectionTitle(section.title);

    return (
      <div key={`section-${section.id}`} style={{ marginLeft: depth * 12 }}>
        <div
          onClick={() => handleSectionClick(section)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '11px 12px',
            background: '#FFFFFF',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            marginBottom: 4,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3B82F6'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#E5E7EB'}
        >
          {num !== null && (
            <span style={{
              fontSize: isRoman ? 14 : 13,
              fontWeight: 400,
              color: isRoman ? '#1F2937' : '#6B7280',
              marginRight: 8,
              minWidth: 20,
              textAlign: 'center'
            }}>
              {num}
            </span>
          )}
          <span style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 400,
            color: '#111827'
          }}>
            {name}
          </span>
          {hasChildren ? (
            <IoChevronDownOutline
              size={14}
              color="#9CA3AF"
              style={{
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            />
          ) : (
            <IoChevronForwardOutline size={14} color="#9CA3AF" />
          )}
        </div>

        {hasChildren && isExpanded && (
          <div style={{ marginTop: 4 }}>
            {section.children.map(child => (
              <SectionItem key={`section-${child.id}`} section={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const getHeaderText = () => {
    if (view === 'documents') return 'Керівні документи';
    if (view === 'sections') return selectedDoc?.title_short || 'Керівні документи';
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
              key={`doc-${doc.id}`}
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
      ) : view === 'sections' ? (
        <div style={{ paddingBottom: 20, overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
          {sectionTree.length === 0 ? (
            <div className={s.emptyText}>Розділів ще немає</div>
          ) : (
            sectionTree.map(section => (
              <SectionItem key={`section-${section.id}`} section={section} depth={0} />
            ))
          )}
        </div>
      ) : (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
          <div className={s.card} style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 400, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {selectedSection?.content || ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

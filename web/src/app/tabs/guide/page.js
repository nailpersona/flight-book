'use client';
import { useEffect, useState, useRef } from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoDocumentTextOutline, IoChevronDownOutline, IoAirplane, IoSearchOutline, IoCloseOutline, IoTimeOutline } from 'react-icons/io5';
import { supabase } from '../../../lib/supabase';
import s from '../../../components/shared.module.css';
import TimeCalculator from '../../../components/TimeCalculator';

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

  // Time calculator state
  const [showCalculator, setShowCalculator] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchInputRef.current && !searchInputRef.current.closest('.search-container')?.contains(e.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guide_documents')
      .select('*')
      .eq('is_visible', true)   // Тільки видимі документи
      .order('order_num');
    if (!error && data) setDocuments(data);
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

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim().length >= 2) {
      setShowSearchResults(true);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearchResultClick = async (result) => {
    // Find the document
    const doc = documents.find(d => d.id === result.documentId);
    if (doc) {
      // Navigate to the document
      setSelectedDoc(doc);
      setBreadcrumb([{ title: doc.title_short, id: null }]);

      if (doc.id === 1 || doc.id === 3) {
        // Load sections and find the target section
        const { data, error } = await supabase
          .from('guide_sections')
          .select('*')
          .eq('document_id', doc.id)
          .order('order_num');

        if (!error && data) {
          // Build tree structure
          const sectionMap = new Map(data.map(s => [s.id, s]));

          const getChildren = (parentId) => {
            return data
              .filter(s => s.parent_id === parentId)
              .map(s => ({
                ...s,
                children: getChildren(s.id)
              }));
          };

          const rootSections = data.filter(s => s.parent_id === null);
          const tree = rootSections.map(section => ({
            ...section,
            children: getChildren(section.id)
          }));

          setSectionTree(tree);
          setSections(tree);

          // Find the target section and expand path to it
          const targetSection = data.find(s => s.id === result.id);
          if (targetSection) {
            // Expand all parent sections
            const parentsToExpand = new Set();
            let current = targetSection;
            while (current.parent_id) {
              parentsToExpand.add(current.parent_id);
              current = sectionMap.get(current.parent_id);
            }
            setExpandedSections(parentsToExpand);

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
      } else {
        setView('in_development');
      }
    }

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Get all parent IDs for a section to expand them
  const getPathToSection = (sectionId, sections) => {
    const path = [];
    let current = sections.find(s => s.id === sectionId);
    while (current) {
      path.unshift(current.id);
      current = sections.find(s => s.children?.some(c => c.id === current.id));
    }
    return path;
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

    // Check if this document has sections (ПВП ДАУ id=1, КЛПВ id=3)
    if (doc.id === 1 || doc.id === 3) {
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
    if (view === 'documents') return '';
    if (view === 'sections' || view === 'in_development') return selectedDoc?.title_short || '';
    if (view === 'content') return selectedSection?.title || 'Зміст';
    return '';
  };

  // Handle internal section links
  const handleSectionLink = async (sectionId) => {
    const { data, error } = await supabase
      .from('guide_sections')
      .select('*, guide_documents!inner(id)')
      .eq('id', sectionId)
      .single();

    if (!error && data) {
      // Find parent document
      const doc = documents.find(d => d.id === data.document_id);
      if (doc) {
        setSelectedDoc(doc);
        setBreadcrumb([{ title: doc.title_short, id: null }]);

        // Load sections tree for this document
        const { data: sectionsData } = await supabase
          .from('guide_sections')
          .select('*')
          .eq('document_id', doc.id)
          .order('order_num');

        if (sectionsData) {
          const rootSections = sectionsData.filter(s => s.parent_id === null);
          const sectionMap = new Map(sectionsData.map(s => [s.id, s]));

          const getChildren = (parentId) => {
            return sectionsData
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

          // Expand path to target section
          const parentsToExpand = new Set();
          let current = data;
          while (current.parent_id) {
            parentsToExpand.add(current.parent_id);
            current = sectionMap.get(current.parent_id);
          }
          setExpandedSections(parentsToExpand);

          // Show content
          setSelectedSection(data);
          setView('content');
        }
      }
    }
  };

  // Render content with markdown-like formatting and links
  const renderContent = (content) => {
    if (!content) return null;

    // Split by lines for processing
    const lines = content.split('\n');
    const elements = [];
    let currentParagraph = [];
    let inTable = false;
    let tableRows = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n');
        elements.push(
          <p key={`p-${elements.length}`} style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {renderInlineFormatting(text)}
          </p>
        );
        currentParagraph = [];
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        elements.push(
          <div key={`table-${elements.length}`} style={{
            overflowX: 'auto',
            marginBottom: 12,
            border: '1px solid #E5E7EB',
            borderRadius: 8
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13
            }}>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx} style={{
                  borderBottom: rowIdx < tableRows.length - 1 ? '1px solid #E5E7EB' : 'none',
                  background: rowIdx === 0 ? '#F9FAFB' : '#FFFFFF'
                }}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} style={{
                      padding: '8px 12px',
                      borderRight: cellIdx < row.length - 1 ? '1px solid #E5E7EB' : 'none',
                      fontWeight: rowIdx === 0 ? 400 : 400,
                      textAlign: 'center',
                      minWidth: 60
                    }}>
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const renderInlineFormatting = (text) => {
      // Handle section links: [text](#section-id)
      const parts = [];
      let lastIndex = 0;

      // Pattern for section links
      const linkPattern = /\[([^\]]+)\]\(#(\d+)\)/g;
      let match;

      while ((match = linkPattern.exec(text)) !== null) {
        // Add text before link
        if (match.index > lastIndex) {
          parts.push(renderBoldAndItalic(text.substring(lastIndex, match.index)));
        }

        // Add link
        const linkText = match[1];
        const sectionId = parseInt(match[2]);
        parts.push(
          <span
            key={`link-${match.index}`}
            onClick={() => handleSectionLink(sectionId)}
            style={{
              color: '#3B82F6',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            {linkText}
          </span>
        );
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(renderBoldAndItalic(text.substring(lastIndex)));
      }

      return parts.length > 0 ? parts : text;
    };

    const renderBoldAndItalic = (text) => {
      const parts = [];
      let lastIndex = 0;

      // Pattern for bold: **text**
      const boldPattern = /\*\*([^*]+)\*\*/g;
      let match;

      while ((match = boldPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(
          <strong key={`bold-${match.index}`} style={{ fontWeight: 400 }}>
            {match[1]}
          </strong>
        );
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts.length > 0 ? parts : text;
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for table row (starts and ends with |)
      if (line.startsWith('|') && line.endsWith('|')) {
        flushParagraph();
        inTable = true;

        // Skip separator rows (|---|---|)
        if (line.match(/^\|[-\s|:]+\|$/)) {
          continue;
        }

        // Parse table cells
        const cells = line.split('|')
          .slice(1, -1)
          .map(cell => cell.trim());
        tableRows.push(cells);
        continue;
      }

      // Not a table line
      if (inTable) {
        flushTable();
      }

      // Empty line = paragraph break
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
          {/* Time calculator button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setShowCalculator(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#D9DBDE',
                borderRadius: 12,
                border: '1px solid #B0B3B8',
                padding: '12px 14px',
                cursor: 'pointer',
                width: '80%',
                color: '#555860',
                fontSize: 15,
                fontWeight: 400,
              }}
            >
              <IoTimeOutline size={18} color="#555860" />
              Авіаційний калькулятор
            </button>
          </div>

          {/* Search input */}
          <div className="search-container" style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderRadius: 16,
              border: '1px solid rgba(0, 0, 0, 0.06)',
              padding: '12px 16px',
              gap: 12,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            }}>
              <IoSearchOutline size={20} color="#9CA3AF" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                placeholder="Пошук по документах..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  fontWeight: 400,
                  color: '#111827',
                  background: 'transparent',
                }}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  style={{
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.05)',
                    padding: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 8,
                  }}
                >
                  <IoCloseOutline size={18} color="#6B7280" />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showSearchResults && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid rgba(0, 0, 0, 0.06)',
                marginTop: 8,
                maxHeight: 400,
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                zIndex: 100,
              }}>
                {isSearching ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 14, fontWeight: 400 }}>
                    Пошук...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => handleSearchResultClick(result)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #F3F4F6',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: '#6366F1',
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {result.documentTitle}
                      </div>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 400,
                        color: '#111827',
                        marginBottom: 4,
                      }}>
                        {result.title}
                      </div>
                      {result.excerpt && (
                        <div style={{
                          fontSize: 13,
                          fontWeight: 400,
                          color: '#6B7280',
                          lineHeight: 1.4,
                        }}>
                          {result.excerpt}
                        </div>
                      )}
                    </div>
                  ))
                ) : searchQuery.trim().length >= 2 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 14, fontWeight: 400 }}>
                    Нічого не знайдено
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Documents list */}
          <div style={{ marginTop: 6 }}>
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
                  marginBottom: 10,
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
          <div style={{ fontSize: 14, fontWeight: 400, color: '#111827', lineHeight: 1.6 }}>
            {renderContent(selectedSection?.content || '')}
          </div>
        </div>
      )}

      {/* Time Calculator */}
      <TimeCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </div>
  );
}

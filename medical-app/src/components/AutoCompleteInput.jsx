
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const AutoCompleteInput = ({ value, onChange, options, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Filter options based on input
    if (!value) {
      setFilteredOptions(options);
    } else {
      const lower = value.toLowerCase();
      setFilteredOptions(options.filter(opt => opt.toLowerCase().includes(lower)));
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
  };

  return (
    <div className="mb-4" ref={wrapperRef} style={{ position: 'relative' }}>
      {label && <label className="text-sm text-muted mb-1 block">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{ width: '100%', paddingRight: '30px' }}
        />
        <ChevronDown 
          size={16} 
          style={{ 
            position: 'absolute', 
            right: '10px', 
            top: '50%', 
            transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
            transition: 'transform 0.2s',
            color: 'var(--text-secondary)',
            pointerEvents: 'none'
          }} 
        />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          marginTop: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 100,
          boxShadow: 'var(--shadow-lg)'
        }}>
          {filteredOptions.map((opt) => (
            <div
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: opt === value ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                color: opt === value ? 'var(--primary)' : 'inherit',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--background)'}
              onMouseLeave={(e) => e.target.style.background = opt === value ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoCompleteInput;

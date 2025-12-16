import { useEffect, useRef, useState } from 'react';
import styles from './AddressAutocomplete.module.css';

/**
 * AddressAutocomplete component
 * Tìm kiếm địa chỉ hành chính từ provinces.open-api.vn (API v1 - chưa sát nhập)
 * Tìm kiếm: tỉnh, quận/huyện, phường/xã
 * Gợi ý theo cấp độ từ chi tiết đến tổng quát
 */
export default function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder, provinces = [] }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Helper function để remove diacritics (bỏ dấu)
  const removeDiacritics = (str) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Search địa chỉ trong provinces data (local search)
  const searchAddressSuggestions = (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (!provinces.length) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const queryNormalized = removeDiacritics(query);
    const results = [];

    // Search through all levels: province -> district -> ward
    provinces.forEach((province) => {
      const provinceNormalized = removeDiacritics(province.name);

      province.districts?.forEach((district) => {
        const districtNormalized = removeDiacritics(district.name);

        district.wards?.forEach((ward) => {
          const wardNormalized = removeDiacritics(ward.name);
          const fullAddress = `${ward.name}, ${district.name}, ${province.name}`;
          const fullAddressNormalized = removeDiacritics(fullAddress);

          // Match ward level (chi tiết nhất)
          if (fullAddressNormalized.includes(queryNormalized) || 
              wardNormalized.includes(queryNormalized)) {
            results.push({
              id: `${province.code}-${district.code}-${ward.code}`,
              display: fullAddress,
              ward: ward.name,
              wardCode: ward.code,
              district: district.name,
              districtCode: district.code,
              city: province.name,
              cityCode: province.code,
              level: 'ward',
            });
          }
        });

        // Match district level
        const districtAddress = `${district.name}, ${province.name}`;
        const districtAddressNormalized = removeDiacritics(districtAddress);
        
        if (districtAddressNormalized.includes(queryNormalized) || 
            districtNormalized.includes(queryNormalized)) {
          results.push({
            id: `${province.code}-${district.code}`,
            display: districtAddress,
            ward: '',
            wardCode: '',
            district: district.name,
            districtCode: district.code,
            city: province.name,
            cityCode: province.code,
            level: 'district',
          });
        }
      });

      // Match province level
      if (provinceNormalized.includes(queryNormalized)) {
        results.push({
          id: `${province.code}`,
          display: province.name,
          ward: '',
          wardCode: '',
          district: '',
          districtCode: '',
          city: province.name,
          cityCode: province.code,
          level: 'city',
        });
      }
    });

    // Remove duplicates by id
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.id, item])).values()
    );

    setSuggestions(uniqueResults.slice(0, 15)); // Limit 15 results
    setShowSuggestions(true);
    setLoading(false);
  };

  const handleSelectSuggestion = (suggestion) => {
    onChange(suggestion.display);
    setShowSuggestions(false);
    onAddressSelect?.(suggestion);
  };

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchAddressSuggestions(value);
      setShowSuggestions(true);
    }, 200); // 200ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, provinces]); // Re-run khi provinces data thay đổi

  // Close suggestions when click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.wrapper} ref={inputRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder || 'Nhập địa chỉ chi tiết...'}
        className={styles.input}
      />
      
      {showSuggestions && (loading || suggestions.length > 0) && (
        <div className={styles.dropdown}>
          {loading && suggestions.length === 0 && (
            <div className={styles.item}>
              <span className={styles.loading}>Đang tìm kiếm...</span>
            </div>
          )}
          
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={styles.item}
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <svg
                className={styles.icon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{suggestion.display}</span>
            </div>
          ))}
        </div>
      )}
      
      {showSuggestions && !loading && suggestions.length === 0 && value.length >= 3 && (
        <div className={styles.dropdown}>
          <div className={styles.item}>
            <span className={styles.empty}>Không tìm thấy địa chỉ phù hợp</span>
          </div>
        </div>
      )}
    </div>
  );
}

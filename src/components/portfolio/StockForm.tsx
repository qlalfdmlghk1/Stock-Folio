import { useState, useCallback, useEffect, useRef } from 'react';
import type { PortfolioStock, StockFormData, Market } from '@/types/stock';
import { searchKrxStocks } from '@/services/krxApi';
import type { KrxSearchResult } from '@/services/krxApi';
import { useDebounce } from '@/hooks/useDebounce';

/** 필드별 인라인 에러 타입 */
interface FieldErrors {
  symbol?: string;
  name?: string;
  quantity?: string;
  avgPrice?: string;
}

interface StockFormProps {
  market: Market;
  /** 수정 모드일 때 기존 종목 데이터 */
  editingStock?: PortfolioStock;
  onSubmit: (data: StockFormData) => void;
  onCancel: () => void;
}

/**
 * 종목 등록/수정 폼
 * [의사결정] 한국 주식은 종목명 검색 → 자동완성 → 종목코드 자동 입력
 * [의사결정] 디바운스 300ms 적용 — API 호출 최소화
 */
export default function StockForm({
  market,
  editingStock,
  onSubmit,
  onCancel,
}: StockFormProps) {
  const [symbol, setSymbol] = useState(editingStock?.symbol ?? '');
  const [name, setName] = useState(editingStock?.name ?? '');
  const [quantity, setQuantity] = useState(editingStock?.quantity.toString() ?? '');
  const [avgPrice, setAvgPrice] = useState(editingStock?.avgPrice.toString() ?? '');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // 한국 주식 종목명 검색 자동완성
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KrxSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const isEdit = !!editingStock;

  // 검색 중 여부: 디바운스 대기 중이거나 아직 결과가 도착하지 않은 상태
  const isSearching = market === 'KR' && searchQuery.length >= 1 && debouncedQuery !== lastSearchedQuery;

  // [의사결정] 디바운스된 검색어가 변경되면 API 호출
  useEffect(() => {
    if (market !== 'KR' || !debouncedQuery || debouncedQuery.length < 1) {
      return;
    }

    let cancelled = false;

    searchKrxStocks(debouncedQuery).then((results) => {
      if (!cancelled) {
        setSearchResults(results);
        setShowDropdown(results.length > 0);
        setLastSearchedQuery(debouncedQuery);
      }
    });

    return () => { cancelled = true; };
  }, [debouncedQuery, market]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** 검색 결과에서 종목 선택 시 종목코드 + 종목명 자동 입력 */
  function handleSelectStock(result: KrxSearchResult) {
    setSymbol(result.symbol);
    setName(result.name);
    setSearchQuery(result.name);
    setShowDropdown(false);
    setFieldErrors((prev) => ({ ...prev, symbol: undefined, name: undefined }));
  }

  /** [예외처리] 종목 코드 유효성 — 시장별 형식 검증 */
  const validateSymbol = useCallback((value: string): string | undefined => {
    if (!value.trim()) return '종목 코드를 입력하세요.';
    if (market === 'US' && !/^[A-Za-z]{1,5}$/.test(value.trim())) {
      return '미국 주식 심볼은 영문 1~5자리입니다. (예: AAPL, MSFT)';
    }
    if (market === 'KR' && !/^\d{6}$/.test(value.trim())) {
      return '한국 주식 종목코드는 숫자 6자리입니다. (예: 005930, 000660)';
    }
    return undefined;
  }, [market]);

  /** 심볼 입력 변경 핸들러 — 입력 시 즉각 인라인 피드백 */
  function handleSymbolChange(value: string) {
    setSymbol(value);
    const err = validateSymbol(value);
    setFieldErrors((prev) => ({ ...prev, symbol: err }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errors: FieldErrors = {};

    const symbolErr = validateSymbol(symbol);
    if (symbolErr) errors.symbol = symbolErr;
    if (!name.trim()) errors.name = '종목명을 입력하세요.';

    const qty = Number(quantity);
    if (!quantity || qty <= 0 || !Number.isInteger(qty)) {
      errors.quantity = '수량은 1 이상의 정수를 입력하세요.';
    }
    const price = Number(avgPrice);
    if (!avgPrice || price <= 0) {
      errors.avgPrice = '매입가는 0보다 큰 값을 입력하세요.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit({
      symbol: market === 'US' ? symbol.trim().toUpperCase() : symbol.trim(),
      name: name.trim(),
      quantity: qty,
      avgPrice: price,
      market,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {isEdit ? '종목 수정' : '종목 등록'}
      </h3>

      <div className="space-y-4">
        {/* 한국 주식: 종목명 검색 자동완성 */}
        {market === 'KR' && !isEdit && (
          <div ref={dropdownRef} className="relative">
            <label className="mb-1 block text-sm text-gray-400">종목명 검색</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // 검색어를 지우면 선택한 종목도 초기화
                if (!e.target.value) {
                  setSymbol('');
                  setName('');
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="종목명을 입력하세요 (예: 삼성)"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500"
            />
            {isSearching && (
              <p className="mt-1 text-xs text-gray-500">검색 중...</p>
            )}

            {/* 자동완성 드롭다운 */}
            {showDropdown && searchResults.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                {searchResults.map((result) => (
                  <li key={result.symbol}>
                    <button
                      type="button"
                      onClick={() => handleSelectStock(result)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-200 transition hover:bg-gray-700"
                    >
                      <span className="font-medium">{result.name}</span>
                      <span className="text-xs text-gray-500">{result.symbol} · {result.market}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 종목 코드 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            {market === 'KR' ? '종목 코드' : '종목 코드 (Symbol)'}
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            placeholder={market === 'KR' ? '예: 005930, 000660' : '예: AAPL, MSFT, GOOGL'}
            disabled={isEdit}
            readOnly={market === 'KR' && !isEdit && !!symbol}
            className={`w-full rounded-lg border bg-gray-800 px-4 py-2.5 text-gray-100 ${market === 'US' ? 'uppercase' : ''} placeholder:text-gray-600 outline-none focus:border-blue-500 disabled:opacity-50 ${
              market === 'KR' && symbol ? 'text-blue-400' : ''
            } ${fieldErrors.symbol ? 'border-red-500' : 'border-gray-700'}`}
          />
          {fieldErrors.symbol && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.symbol}</p>
          )}
        </div>

        {/* 종목명 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">종목명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder={market === 'KR' ? '예: 삼성전자' : '예: Apple Inc.'}
            readOnly={market === 'KR' && !isEdit && !!name}
            className={`w-full rounded-lg border bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500 ${
              market === 'KR' && name ? 'text-blue-400' : ''
            } ${fieldErrors.name ? 'border-red-500' : 'border-gray-700'}`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
          )}
        </div>

        {/* 수량 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">수량 (주)</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setFieldErrors((prev) => ({ ...prev, quantity: undefined }));
            }}
            placeholder="0"
            min="1"
            step="1"
            className={`w-full rounded-lg border bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500 ${
              fieldErrors.quantity ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {fieldErrors.quantity && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.quantity}</p>
          )}
        </div>

        {/* 매입가 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            매입가 ({market === 'US' ? 'USD' : 'KRW'})
          </label>
          <input
            type="number"
            value={avgPrice}
            onChange={(e) => {
              setAvgPrice(e.target.value);
              setFieldErrors((prev) => ({ ...prev, avgPrice: undefined }));
            }}
            placeholder="0"
            min="0"
            step={market === 'US' ? '0.01' : '1'}
            className={`w-full rounded-lg border bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500 ${
              fieldErrors.avgPrice ? 'border-red-500' : 'border-gray-700'
            }`}
          />
          {fieldErrors.avgPrice && (
            <p className="mt-1 text-xs text-red-400">{fieldErrors.avgPrice}</p>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            {isEdit ? '수정' : '등록'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-700 py-2.5 font-medium text-gray-300 transition hover:bg-gray-800"
          >
            취소
          </button>
        </div>
      </div>
    </form>
  );
}

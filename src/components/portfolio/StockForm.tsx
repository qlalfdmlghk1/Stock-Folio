import { useState, useMemo } from 'react';
import type { PortfolioStock, StockFormData, Market } from '../../types/stock';
import { getAvailableKrxSymbols } from '../../services/mockKrx';
import { AppSelect } from '../ui/AppSelect';
import type { SelectOption, SelectValue } from '../ui/AppSelect/AppSelect.type';

interface StockFormProps {
  market: Market;
  /** 수정 모드일 때 기존 종목 데이터 */
  editingStock?: PortfolioStock;
  onSubmit: (data: StockFormData) => void;
  onCancel: () => void;
}

/**
 * 종목 등록/수정 폼
 * [의사결정] 미국 주식은 심볼 직접 입력, 한국 주식은 Mock 목록에서 선택
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

  const krxSymbols = getAvailableKrxSymbols();
  const isEdit = !!editingStock;

  const krxOptions: SelectOption[] = useMemo(
    () => krxSymbols.map((s) => ({ value: s.symbol, label: `${s.name} (${s.symbol})` })),
    [krxSymbols],
  );

  function handleKrxSelect(value: SelectValue | SelectValue[]) {
    const selectedSymbol = value as string;
    setSymbol(selectedSymbol);
    const found = krxSymbols.find((s) => s.symbol === selectedSymbol);
    if (found) setName(found.name);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // 유효성 검사
    if (!symbol.trim()) {
      setError('종목 코드를 입력하세요.');
      return;
    }
    if (!name.trim()) {
      setError('종목명을 입력하세요.');
      return;
    }
    const qty = Number(quantity);
    if (!quantity || qty <= 0 || !Number.isInteger(qty)) {
      setError('수량은 1 이상의 정수를 입력하세요.');
      return;
    }
    const price = Number(avgPrice);
    if (!avgPrice || price <= 0) {
      setError('매입가는 0보다 큰 값을 입력하세요.');
      return;
    }

    onSubmit({
      symbol: symbol.trim().toUpperCase(),
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
        {/* 종목 코드 */}
        {market === 'KR' ? (
          <div>
            <label className="mb-1 block text-sm text-gray-400">종목 선택</label>
            <AppSelect
              options={krxOptions}
              value={symbol || undefined}
              onChange={handleKrxSelect}
              disabled={isEdit}
              placeholder="선택하세요"
              fullWidth
            />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm text-gray-400">종목 코드 (Symbol)</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="예: AAPL, MSFT, GOOGL"
                disabled={isEdit}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 uppercase placeholder:text-gray-600 outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">종목명</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: Apple Inc."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* 수량 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">수량 (주)</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            min="1"
            step="1"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500"
          />
        </div>

        {/* 매입가 */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            매입가 ({market === 'US' ? 'USD' : 'KRW'})
          </label>
          <input
            type="number"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder="0"
            min="0"
            step={market === 'US' ? '0.01' : '1'}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder:text-gray-600 outline-none focus:border-blue-500"
          />
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

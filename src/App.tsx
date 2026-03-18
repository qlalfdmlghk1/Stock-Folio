import { useState, useCallback } from 'react';
import type { PortfolioStock, StockFormData, Market } from '@/types/stock';
import { usePortfolio } from '@/hooks/usePortfolio';
import StockForm from '@/components/portfolio/StockForm';
import USPortfolioSection from '@/components/portfolio/USPortfolioSection';
import KRPortfolioSection from '@/components/portfolio/KRPortfolioSection';
import TabButton from '@/components/ui/TabButton';
import MarketStatusIndicator from '@/components/ui/MarketStatusIndicator';

function App() {
  const [activeMarket, setActiveMarket] = useState<Market>('US');
  const [showForm, setShowForm] = useState(false);
  const [editingStock, setEditingStock] = useState<PortfolioStock | undefined>();

  const { stocks, add, update, remove } = usePortfolio(activeMarket);

  /** 종목 등록 */
  const handleAdd = useCallback(
    (data: StockFormData) => {
      add(data);
      setShowForm(false);
    },
    [add],
  );

  /** 종목 수정 */
  const handleEdit = useCallback((stock: PortfolioStock) => {
    setEditingStock(stock);
    setShowForm(true);
  }, []);

  /** 종목 수정 제출 */
  const handleUpdate = useCallback(
    (data: StockFormData) => {
      if (editingStock) {
        update(editingStock.id, data);
        setEditingStock(undefined);
        setShowForm(false);
      }
    },
    [editingStock, update],
  );

  /** 종목 삭제 */
  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('이 종목을 삭제하시겠습니까?')) {
        remove(id);
      }
    },
    [remove],
  );

  /** 폼 닫기 */
  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingStock(undefined);
  }, []);

  /** 탭 전환 시 폼 닫기 */
  const handleTabChange = useCallback((market: Market) => {
    setActiveMarket(market);
    setShowForm(false);
    setEditingStock(undefined);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            Stock<span className="text-blue-400">Folio</span>
          </h1>
          <MarketStatusIndicator market={activeMarket} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* 미국/한국 탭 */}
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-900 p-1">
          <TabButton
            active={activeMarket === 'US'}
            onClick={() => handleTabChange('US')}
          >
            미국 주식
          </TabButton>
          <TabButton
            active={activeMarket === 'KR'}
            onClick={() => handleTabChange('KR')}
          >
            한국 주식
          </TabButton>
        </div>

        {/* 종목 등록 버튼 */}
        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              + 종목 등록
            </button>
          </div>
        )}

        {/* 등록/수정 폼 */}
        {showForm && (
          <div className="mb-6">
            <StockForm
              market={activeMarket}
              editingStock={editingStock}
              onSubmit={editingStock ? handleUpdate : handleAdd}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* 포트폴리오 섹션 */}
        {activeMarket === 'US' ? (
          <USPortfolioSection
            stocks={stocks}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : (
          <KRPortfolioSection
            stocks={stocks}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}

export default App;

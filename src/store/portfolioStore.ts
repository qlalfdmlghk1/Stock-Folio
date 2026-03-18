import type { PortfolioStock, StockFormData, Market } from '@/types/stock';

const STORAGE_KEY = 'stockfolio_portfolio';

/** localStorage에서 포트폴리오 데이터를 읽어온다 */
export function loadPortfolio(): PortfolioStock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PortfolioStock[];
  } catch {
    // [트러블슈팅] JSON 파싱 실패 시 빈 배열 반환 — 데이터 손상 방어
    return [];
  }
}

/** localStorage에 포트폴리오 데이터를 저장한다 */
function savePortfolio(stocks: PortfolioStock[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
}

/** 고유 ID 생성 — crypto.randomUUID 지원 시 사용, 미지원 시 타임스탬프 폴백 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 종목 추가 */
export function addStock(data: StockFormData): PortfolioStock {
  const stocks = loadPortfolio();
  const newStock: PortfolioStock = { id: generateId(), ...data };
  stocks.push(newStock);
  savePortfolio(stocks);
  return newStock;
}

/** 종목 수정 */
export function updateStock(id: string, data: Partial<StockFormData>): PortfolioStock | null {
  const stocks = loadPortfolio();
  const index = stocks.findIndex((s) => s.id === id);
  if (index === -1) return null;

  stocks[index] = { ...stocks[index], ...data };
  savePortfolio(stocks);
  return stocks[index];
}

/** 종목 삭제 */
export function removeStock(id: string): boolean {
  const stocks = loadPortfolio();
  const filtered = stocks.filter((s) => s.id !== id);
  if (filtered.length === stocks.length) return false;

  savePortfolio(filtered);
  return true;
}

/** 시장별 종목 필터 */
export function getStocksByMarket(market: Market): PortfolioStock[] {
  return loadPortfolio().filter((s) => s.market === market);
}

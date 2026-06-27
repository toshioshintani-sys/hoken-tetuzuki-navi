import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import rawData from '../data/insurers.json';

type CategoryKey = 'all' | 'nonlife' | 'life' | 'kyosai' | 'mini' | 'agency';
type CompanyCategory = Exclude<CategoryKey, 'all'>;

type Category = {
  key: CategoryKey;
  label: string;
  fg?: string;
  bg?: string;
};

type Procedure = {
  key: string;
  icon: string;
  color: string;
};

type HoursPreset = {
  text: string;
  rows: { day: string; time: string }[];
  open: {
    weekday: number[] | null;
    saturday: number[] | null;
    sunday: number[] | null;
    holiday: number[] | null;
  };
  unknown?: boolean;
};

type Phone = {
  label: string;
  number: string;
};

type Company = {
  id: number;
  name: string;
  kana: string;
  category: CompanyCategory;
  brandColor: string;
  initials: string;
  hoursKey: string;
  host: string;
  officialUrl: string;
  mypageUrl: string;
  phones: Phone[];
  verified: boolean;
};

type InsuranceData = {
  meta: {
    title: string;
    description: string;
    totalCompanies: number;
    countsByCategory: Record<CompanyCategory, number>;
    sources: { name: string; asOf: string; appliesTo: string }[];
    notes: string[];
    iconSkipHosts: string[];
  };
  categories: Category[];
  procedures: Procedure[];
  hoursPresets: Record<string, HoursPreset>;
  memos: Record<CompanyCategory, Record<string, string>>;
  companies: Company[];
};

const data = rawData as InsuranceData;

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8 19.4 5.7v5.1c0 4.8-3.1 8.2-7.4 10.1-4.3-1.9-7.4-5.3-7.4-10.1V5.7L12 2.8Z" />
      <path d="m8.7 12.1 2.2 2.2 4.6-4.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.4 16.4 4.1 4.1" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 3.6h2.8l1.4 3.7-2 1.4a11 11 0 0 0 5.2 5.2l1.4-2 3.7 1.4V16c0 1-.8 1.8-1.8 1.8C11.7 21 3 12.3 3.2 5.5c0-1 .8-1.9 1.9-1.9h1.5Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h9v9" />
      <path d="m17 7-10 10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.6V12l3 1.9" />
    </svg>
  );
}

function getJstSlot(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);

  if (weekday === 'Sun') return { key: 'sunday' as const, minutes: hour * 60 + minute };
  if (weekday === 'Sat') return { key: 'saturday' as const, minutes: hour * 60 + minute };
  return { key: 'weekday' as const, minutes: hour * 60 + minute };
}

function isOpen(company: Company) {
  const preset = data.hoursPresets[company.hoursKey];
  if (!preset || preset.unknown) return false;

  const { key, minutes } = getJstSlot();
  const range = preset.open[key];
  return Boolean(range && range.length >= 2 && range[0] <= minutes && minutes < range[1]);
}

function pickPhone(company: Company, procedureKey: string | null) {
  if (company.phones.length === 0) return null;
  if (procedureKey === '給付金・保険金請求') {
    const claimPhone = company.phones.find((phone) => /保険金|支払|請求|給付/.test(phone.label));
    if (claimPhone) return claimPhone;
  }
  return company.phones[0];
}

function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

function categoryFor(company: Company) {
  return data.categories.find((category) => category.key === company.category)!;
}

function CompanyLogo({ company }: { company: Company }) {
  const skipIcon = !company.host || data.meta.iconSkipHosts.includes(company.host);

  return (
    <div className="company-logo" aria-hidden="true">
      <div className="company-logo__fallback" style={{ backgroundColor: company.brandColor }}>
        {company.initials.split('\n').map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
      {!skipIcon && (
        <img
          src={`https://www.google.com/s2/favicons?sz=128&domain=${company.host}`}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ open, unknown }: { open: boolean; unknown?: boolean }) {
  if (unknown) {
    return <span className="status-badge status-badge--unknown">要確認</span>;
  }
  return (
    <span className={open ? 'status-badge status-badge--open' : 'status-badge'}>
      <span />
      {open ? '営業中' : '時間外'}
    </span>
  );
}

function CompanyItem({
  company,
  selectedProcedure,
  onOpen,
}: {
  company: Company;
  selectedProcedure: string | null;
  onOpen: (company: Company) => void;
}) {
  const category = categoryFor(company);
  const hours = data.hoursPresets[company.hoursKey];
  const open = isOpen(company);
  const hoursUnknown = Boolean(hours.unknown);
  const hasPortal = company.mypageUrl !== company.officialUrl;
  const phone = pickPhone(company, selectedProcedure);
  const procedurePrefix = selectedProcedure ? `「${selectedProcedure}」の窓口` : '代表窓口';
  const helper =
    company.category === 'nonlife' && selectedProcedure === '給付金・保険金請求'
      ? '事故受付は24時間365日対応の場合があります'
      : hoursUnknown
        ? '受付時間は公式サイトでご確認ください'
        : open
          ? 'ただいま受付中です'
          : `営業時間外（${hours.text}）`;

  return (
    <article className="company-item">
      <div className="company-item__brand">
        <CompanyLogo company={company} />
        <div className="company-item__title">
          <h3>{company.name}</h3>
          <p>{company.kana}</p>
        </div>
        <StatusBadge open={open} unknown={hoursUnknown} />
      </div>

      <div className="company-item__meta">
        <span className="category-tag" style={{ color: category.fg, background: category.bg }}>
          {category.label}
        </span>
        <span className="hours-line">
          <ClockIcon />
          {hours.text}
        </span>
        {company.verified && <span className="verified">協会公開データ</span>}
      </div>

      <div className="contact-panel">
        <div>
          <span className="contact-panel__label">
            {procedurePrefix}
            {phone ? `：${phone.label}` : ''}
          </span>
          {phone ? (
            <a className="phone-link" href={telHref(phone.number)}>
              <PhoneIcon />
              {phone.number}
            </a>
          ) : (
            <a className="official-link" href={company.officialUrl} target="_blank" rel="noreferrer">
              公式サイトで番号を確認
              <ExternalIcon />
            </a>
          )}
          <p>{phone ? helper : '電話番号は公式サイト・ご契約書類でご確認ください'}</p>
        </div>
        <button className="detail-button" type="button" onClick={() => onOpen(company)}>
          詳細
        </button>
      </div>

      <div className="company-item__actions">
        <button type="button" className="primary-action" onClick={() => onOpen(company)}>
          詳しい窓口・手続き
        </button>
        <a
          href={hasPortal ? company.mypageUrl : company.officialUrl}
          target="_blank"
          rel="noreferrer"
          className="secondary-action"
        >
          {hasPortal ? 'マイページ' : '公式サイト'}
          <ExternalIcon />
        </a>
      </div>
    </article>
  );
}

function DetailDrawer({
  company,
  selectedProcedure,
  onClose,
}: {
  company: Company | null;
  selectedProcedure: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!company) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [company, onClose]);

  if (!company) return null;

  const category = categoryFor(company);
  const hours = data.hoursPresets[company.hoursKey];
  const open = isOpen(company);
  const hoursUnknown = Boolean(hours.unknown);
  const hasPortal = company.mypageUrl !== company.officialUrl;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${company.name}の詳しい窓口`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div className="drawer-header__brand">
            <CompanyLogo company={company} />
            <div>
              <h2>{company.name}</h2>
              <p>{company.kana}</p>
            </div>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="drawer-tags">
          <span className="category-tag" style={{ color: category.fg, background: category.bg }}>
            {category.label}
          </span>
          <StatusBadge open={open} unknown={hoursUnknown} />
        </div>

        <section className="drawer-section">
          <h3>問い合わせ窓口</h3>
          {company.phones.length > 0 ? (
            <div className="phone-list">
              {company.phones.map((phone) => (
                <a href={telHref(phone.number)} className="phone-row" key={`${phone.label}-${phone.number}`}>
                  <span>
                    <small>{phone.label}</small>
                    <strong>{phone.number}</strong>
                  </span>
                  <PhoneIcon />
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-note">
              <p>ご契約のしおり・証券、または公式サイトで最新の窓口をご確認ください。</p>
              <a href={company.officialUrl} target="_blank" rel="noreferrer">
                公式サイトを開く
                <ExternalIcon />
              </a>
            </div>
          )}
        </section>

        <section className="drawer-section">
          <h3>営業時間（目安）</h3>
          <div className="hours-table">
            {hours.rows.map((row) => {
              return (
                <div className="hours-row" key={`${row.day}-${row.time}`}>
                  <span>{row.day}</span>
                  <strong>{row.time}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="drawer-section">
          <h3>手続き別のご案内</h3>
          <div className="procedure-guide">
            {data.procedures.map((procedure) => {
              const phone = pickPhone(company, procedure.key);
              const active = procedure.key === selectedProcedure;

              return (
                <article className={active ? 'procedure-guide__item is-active' : 'procedure-guide__item'} key={procedure.key}>
                  <div className="procedure-guide__title">
                    <span style={{ borderColor: procedure.color, color: procedure.color }}>{procedure.icon}</span>
                    <strong>{procedure.key}</strong>
                  </div>
                  <p>{data.memos[company.category][procedure.key]}</p>
                  <small>推奨窓口：{phone ? phone.label : '公式サイトでご確認ください'}</small>
                </article>
              );
            })}
          </div>
        </section>

        <div className="drawer-footer">
          {hasPortal ? (
            <>
              <a href={company.mypageUrl} target="_blank" rel="noreferrer" className="primary-action">
                マイページ
                <ExternalIcon />
              </a>
              <a href={company.officialUrl} target="_blank" rel="noreferrer" className="secondary-action">
                公式サイト
                <ExternalIcon />
              </a>
            </>
          ) : (
            <a href={company.officialUrl} target="_blank" rel="noreferrer" className="primary-action">
              公式サイト
              <ExternalIcon />
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);

  const searchedCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return data.companies;
    return data.companies.filter((company) => {
      return company.name.toLowerCase().includes(normalizedQuery) || company.kana.includes(normalizedQuery);
    });
  }, [query]);

  const categoryCounts = useMemo(() => {
    return data.categories.reduce<Record<CategoryKey, number>>((acc, category) => {
      acc[category.key] =
        category.key === 'all'
          ? searchedCompanies.length
          : searchedCompanies.filter((company) => company.category === category.key).length;
      return acc;
    }, {} as Record<CategoryKey, number>);
  }, [searchedCompanies]);

  const visibleCompanies = useMemo(() => {
    return searchedCompanies
      .filter((company) => selectedCategory === 'all' || company.category === selectedCategory)
      .filter((company) => !openOnly || isOpen(company))
      .sort((a, b) => {
        const openDiff = Number(isOpen(b)) - Number(isOpen(a));
        return openDiff || a.id - b.id;
      });
  }, [openOnly, searchedCompanies, selectedCategory]);

  const contextLabel = [
    selectedCategory !== 'all' ? categoryFor({ category: selectedCategory } as Company).label : null,
    selectedProcedure,
    openOnly ? '営業中のみ' : null,
  ]
    .filter(Boolean)
    .join('・');

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="#top" aria-label="保険手続きナビ トップへ">
            <span className="brand__mark">
              <ShieldIcon />
            </span>
            <span>
              <strong>保険手続きナビ</strong>
              <small>各種手続き連絡先一覧</small>
            </span>
          </a>
          <nav className="header-actions" aria-label="補助ナビゲーション">
            <a href="#notice">掲載情報について</a>
            <span className="total-badge">
              <span />
              {data.meta.totalCompanies}社掲載
            </span>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero__grid">
            <div className="hero__copy">
              <h1>保険手続きナビ</h1>
              <p>保険会社の手続き窓口・電話番号・営業時間をまとめて確認</p>
              <form className="search-box" onSubmit={(event) => event.preventDefault()}>
                <span className="search-box__icon">
                  <SearchIcon />
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="会社名で検索"
                  aria-label="会社名で検索"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')}>
                    クリア
                  </button>
                )}
              </form>
              <div className="procedure-bar" aria-label="手続きから探す">
                {data.procedures.map((procedure) => (
                  <button
                    key={procedure.key}
                    type="button"
                    className={selectedProcedure === procedure.key ? 'procedure-chip is-active' : 'procedure-chip'}
                    style={{ '--procedure-color': procedure.color } as CSSProperties}
                    onClick={() => setSelectedProcedure((current) => (current === procedure.key ? null : procedure.key))}
                  >
                    <span>{procedure.icon}</span>
                    {procedure.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero__panel" aria-label="掲載データ概要">
              <div className="panel-stat">
                <strong>{data.meta.totalCompanies}</strong>
                <span>掲載会社数</span>
              </div>
              <div className="panel-grid">
                <span>損保 {data.meta.countsByCategory.nonlife}</span>
                <span>生保 {data.meta.countsByCategory.life}</span>
                <span>共済 {data.meta.countsByCategory.kyosai}</span>
                <span>少短 {data.meta.countsByCategory.mini}</span>
              </div>
              <p>公式サイト・マイページ・電話番号を、手続き目的に合わせて整理しています。</p>
            </div>
          </div>
        </section>

        <section className="filter-strip" aria-label="検索条件">
          <div className="container filter-strip__inner">
            <div className="category-tabs">
              {data.categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={selectedCategory === category.key ? 'category-tab is-active' : 'category-tab'}
                  onClick={() => setSelectedCategory(category.key)}
                >
                  {category.label}
                  <span>{categoryCounts[category.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={openOnly ? 'open-toggle is-active' : 'open-toggle'}
              onClick={() => setOpenOnly((current) => !current)}
              aria-pressed={openOnly}
            >
              <span />
              営業中のみ
            </button>
          </div>
        </section>

        <section className="container results-section">
          <div className="results-heading">
            <div>
              <p>検索結果</p>
              <h2>
                {visibleCompanies.length}件
                {contextLabel && <span> / {contextLabel}</span>}
              </h2>
            </div>
            <div className="legend">
              <span>
                <i className="legend__open" />
                営業中
              </span>
              <span>
                <i />
                時間外
              </span>
            </div>
          </div>

          {visibleCompanies.length > 0 ? (
            <div className="company-list">
              {visibleCompanies.map((company) => (
                <CompanyItem
                  key={company.id}
                  company={company}
                  selectedProcedure={selectedProcedure}
                  onOpen={setActiveCompany}
                />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <h3>該当する保険会社が見つかりませんでした</h3>
              <p>会社名のキーワード、カテゴリ、営業中フィルタを変更してお試しください。</p>
            </div>
          )}
        </section>

        <section className="notice-section" id="notice">
          <div className="container notice-section__inner">
            <div>
              <h2>掲載情報について</h2>
              <p>
                お手続き前に、必ず各社公式サイト・ご契約書類で最新情報をご確認ください。
                営業時間は代表的な目安であり、窓口・商品・手続き内容により異なる場合があります。
              </p>
            </div>
            <ul>
              {data.meta.sources.map((source) => (
                <li key={source.name}>
                  {source.name}（{source.asOf}時点）：{source.appliesTo}
                </li>
              ))}
              <li>共済・少額短期・相談代理店は公式サイトリンク中心、電話番号は未掲載の会社があります。</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <span>保険手続きナビ</span>
          <p>掲載情報は確認補助を目的としたものです。最終的なお手続きは各社公式窓口で行ってください。</p>
        </div>
      </footer>

      <DetailDrawer company={activeCompany} selectedProcedure={selectedProcedure} onClose={() => setActiveCompany(null)} />
    </div>
  );
}

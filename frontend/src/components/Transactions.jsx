import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(iso) {
    if (!iso) return ''
    const [, m, d] = iso.split('-')
    return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

function SearchIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    )
}

function FilterIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
    )
}

function SortArrowsIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 15l5 5 5-5"></path>
            <path d="M7 9l5-5 5 5"></path>
        </svg>
    )
}

export default function Transactions({ txns, credits, categories, selectedCats, onUpdateCategory, onVoid, categoryDefs }) {
    const [view, setView] = useState('expenses') // 'expenses' | 'credits'
    const [selectedCat, setSelectedCat] = useState('all')
    const [search, setSearch] = useState('')
    const [sortCol, setSortCol] = useState('date') // 'date', 'desc', 'category', 'amount'
    const [sortDir, setSortDir] = useState('desc') // 'asc', 'desc'

    // Portal states
    const [editingId, setEditingId] = useState(null)
    const [editRect, setEditRect] = useState(null)

    const allCatNames = useMemo(() => {
        if (!categoryDefs) return []
        return categoryDefs.map(c => c.name)
    }, [categoryDefs])

    const catColorMap = useMemo(() => {
        const m = {}
        if (categoryDefs) categoryDefs.forEach(c => { m[c.name] = c.color })
        return m
    }, [categoryDefs])

    const activeList = view === 'expenses' ? txns : credits

    const filtered = useMemo(() => {
        let list = activeList || []

        // Cat filter
        if (selectedCat !== 'all') {
            list = list.filter(t => (t.category || 'uncategorised') === selectedCat)
        }

        // Search filter
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(t => t.merchant.toLowerCase().includes(q))
        }

        return list
    }, [activeList, selectedCat, search])

    const sorted = useMemo(() => {
        const copy = [...filtered]
        copy.sort((a, b) => {
            let cmp = 0
            switch (sortCol) {
                case 'date': cmp = String(a.date).localeCompare(String(b.date)); break
                case 'desc': cmp = String(a.merchant).localeCompare(String(b.merchant)); break
                case 'category': cmp = String(a.category || '').localeCompare(String(b.category || '')); break
                case 'amount': cmp = a.amount - b.amount; break
                default: cmp = 0
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return copy
    }, [filtered, sortCol, sortDir])

    const total = useMemo(() => {
        return filtered.filter(t => !t.voided).reduce((s, t) => s + t.amount, 0)
    }, [filtered])

    const toggleSort = (col) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortCol(col)
            setSortDir(col === 'date' ? 'desc' : 'asc')
        }
    }

    const handleCatSelect = async (category) => {
        if (!editingId) return
        setEditingId(null)
        setEditRect(null)
        await onUpdateCategory(editingId, category, true)
    }

    const uniqueCats = useMemo(() => {
        if (!categories) return []
        return categories.map(c => c.category)
    }, [categories])

    return (
        <div className="txn-view">
            {/* Top Bar: Toggles + Total */}
            <div className="txn-view-header">
                <div className="txn-view-toggles">
                    <button
                        className={`txn-view-toggle ${view === 'expenses' ? 'active-exp' : ''}`}
                        onClick={() => { setView('expenses'); setSelectedCat('all') }}
                    >
                        Expenses
                    </button>
                    <button
                        className={`txn-view-toggle ${view === 'credits' ? 'active-cred' : ''}`}
                        onClick={() => { setView('credits'); setSelectedCat('all') }}
                    >
                        Income / Credits
                    </button>
                </div>
                <div className="txn-view-total">
                    <div className="txn-view-total-label">
                        {view === 'expenses' ? 'Total Expenses' : 'Total Income'}
                    </div>
                    <div className={`txn-view-total-val ${view === 'expenses' ? 'val-exp' : 'val-cred'}`}>
                        {view === 'credits' ? '+' : '-'}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Category Pills */}
            <div className="txn-pills">
                <button
                    className={`txn-pill ${selectedCat === 'all' ? 'pill-active' : ''}`}
                    onClick={() => setSelectedCat('all')}
                >
                    All
                </button>
                {uniqueCats.map(cat => (
                    <button
                        key={cat}
                        className={`txn-pill ${selectedCat === cat ? 'pill-active' : ''}`}
                        onClick={() => setSelectedCat(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Search + Action Bar */}
            <div className="txn-toolbar">
                <div className="txn-search-box">
                    <SearchIcon />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="txn-toolbar-actions">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '1rem' }}>
                        {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="txn-table-container">
                <table className="txn-table">
                    <thead>
                        <tr>
                            <th onClick={() => toggleSort('date')} className={sortCol === 'date' ? 'sorted' : ''}>
                                DATE {sortCol === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => toggleSort('desc')} className={sortCol === 'desc' ? 'sorted' : ''}>
                                DESCRIPTION {sortCol === 'desc' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => toggleSort('category')} className={sortCol === 'category' ? 'sorted' : ''}>
                                CATEGORY {sortCol === 'category' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => toggleSort('amount')} className={`txt-right ${sortCol === 'amount' ? 'sorted' : ''}`}>
                                AMOUNT {sortCol === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="th-actions"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(t => (
                            <tr key={t.id} className={t.voided ? 'row-voided' : ''}>
                                <td className="td-date">{fmtDate(t.date)}</td>
                                <td className="td-desc" title={t.merchant}>{t.merchant}</td>
                                <td className="td-cat">
                                    {(t.category || 'uncategorised') !== '' && (
                                        <span
                                            className="td-cat-badge"
                                            style={{
                                                borderColor: catColorMap[t.category] || '#3b82f6',
                                                color: catColorMap[t.category] || '#3b82f6',
                                                backgroundColor: `${catColorMap[t.category] || '#3b82f6'}1A` // 10% opacity
                                            }}
                                        >
                                            {t.category || 'uncategorised'}
                                        </span>
                                    )}
                                </td>
                                <td className={`td-amt txt-right ${view === 'credits' ? 'val-cred' : 'val-exp'}`}>
                                    {view === 'credits' ? '+' : '-'}${t.amount.toFixed(2)}
                                </td>
                                <td className="td-actions">
                                    <button
                                        className="row-action-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (editingId === t.id) {
                                                setEditingId(null)
                                                setEditRect(null)
                                            } else {
                                                setEditingId(t.id)
                                                setEditRect(e.currentTarget.getBoundingClientRect())
                                            }
                                        }}
                                        title="Edit Category"
                                    >✎</button>
                                    <button
                                        className={`row-action-btn ${t.voided ? 'void-on' : ''}`}
                                        onClick={() => onVoid(t.id, !t.voided)}
                                        title={t.voided ? 'Unvoid' : 'Void'}
                                    >⊘</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Category Picker Overlay */}
            {editingId && editRect && (
                <CategoryPicker
                    current={sorted.find(t => t.id === editingId)?.category}
                    rect={editRect}
                    categories={allCatNames}
                    onSelect={handleCatSelect}
                    onClose={() => { setEditingId(null); setEditRect(null) }}
                />
            )}
        </div>
    )
}

function CategoryPicker({ current, rect, categories, onSelect, onClose }) {
    const ref = useRef(null)
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')
    const [showNewCat, setShowNewCat] = useState(false)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#6366f1')

    const filtered = categories.filter(c =>
        c !== current && c.includes(query.toLowerCase())
    )

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [onClose])

    useEffect(() => { inputRef.current?.focus() }, [])

    const style = {
        position: 'fixed',
        top: Math.min(rect.bottom + 4, window.innerHeight - 350),
        left: Math.min(rect.right - 200, window.innerWidth - 240),
        zIndex: 9999,
    }

    const handleCreateCategory = async () => {
        const name = newName.trim().toLowerCase()
        if (!name || !newColor) return
        try {
            await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color: newColor }),
            })
            onSelect(name)
        } catch (e) {
            console.error('Failed to create category:', e)
        }
    }

    return createPortal(
        <div className="cat-picker" ref={ref} style={style}>
            <input
                ref={inputRef}
                className="cat-picker-search"
                type="text"
                placeholder="Search category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <div className="cat-picker-list">
                {filtered.map(cat => (
                    <div key={cat} className="cat-picker-item" onClick={() => onSelect(cat)}>
                        <span className="cat-picker-name">{cat}</span>
                    </div>
                ))}
                {filtered.length === 0 && !showNewCat && (
                    <div className="cat-picker-empty">No matches</div>
                )}
            </div>
            {!showNewCat ? (
                <button className="cat-picker-new-btn" onClick={() => setShowNewCat(true)}>
                    + New category
                </button>
            ) : (
                <div className="cat-picker-new-form">
                    <input
                        className="cat-picker-search"
                        type="text"
                        placeholder="Category name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <div className="cat-picker-color-row">
                        <input
                            type="color"
                            value={newColor}
                            onChange={(e) => setNewColor(e.target.value)}
                            className="cat-picker-color-swatch"
                        />
                        <input
                            type="text"
                            className="cat-picker-hex-input"
                            value={newColor}
                            onChange={(e) => {
                                const v = e.target.value
                                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setNewColor(v)
                            }}
                            placeholder="#6366f1"
                            maxLength={7}
                        />
                        <button className="cat-picker-create-btn" onClick={handleCreateCategory}>
                            Create
                        </button>
                        <button className="cat-picker-cancel-btn" onClick={() => setShowNewCat(false)}>
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    )
}

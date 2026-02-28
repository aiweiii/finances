import { useState, useEffect, useCallback } from 'react'
import { fetchTransactions, fetchCreditTransactions, fetchMonthlySummary, fetchCategorySummary, fetchDailySummary, fetchMonthlyCategorySummary, updateTransactionCategory, voidTransaction, fetchCategoryDefs } from './api'
import StatsBar from './components/StatsBar'
import MonthlyChart from './components/MonthlyChart'
import CategoryChart from './components/CategoryChart'
import Transactions from './components/Transactions'
import DailyCalendar from './components/DailyCalendar'
import Toast from './components/Toast'

export default function App() {
    const [activeTab, setActiveTab] = useState('transactions') // 'dashboard' or 'transactions'
    const [month, setMonth] = useState('')
    const [months, setMonths] = useState([])
    const [txns, setTxns] = useState([])
    const [credits, setCredits] = useState([])
    const [monthly, setMonthly] = useState([])
    const [monthlyCats, setMonthlyCats] = useState([])
    const [categories, setCategories] = useState([])
    const [daily, setDaily] = useState([])
    const [selectedCats, setSelectedCats] = useState(new Set())
    const [categoryDefs, setCategoryDefs] = useState([])
    const [toast, setToast] = useState(null)
    const [lastAction, setLastAction] = useState(null)

    useEffect(() => {
        fetchMonthlySummary().then(setMonths)
        fetchMonthlyCategorySummary().then(setMonthlyCats)
        fetchCategoryDefs().then(setCategoryDefs)
    }, [])

    const refreshAll = useCallback(async () => {
        const [t, cr, m, c, d] = await Promise.all([
            fetchTransactions(month),
            fetchCreditTransactions(month),
            fetchMonthlySummary(),
            fetchCategorySummary(month),
            fetchDailySummary(month),
        ])
        setTxns(t || [])
        setCredits(cr || [])
        setMonthly(m || [])
        setCategories(c || [])
        setDaily(d || [])
        setSelectedCats(new Set())
    }, [month])

    useEffect(() => { refreshAll() }, [refreshAll])

    const toggleCat = (cat) => {
        if (cat === 'All') {
            setSelectedCats(new Set())
            return
        }
        setSelectedCats(prev => {
            const next = new Set(prev)
            next.has(cat) ? next.delete(cat) : next.add(cat)
            return next
        })
    }

    useEffect(() => {
        const handler = async (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && lastAction) {
                e.preventDefault()
                await updateTransactionCategory(lastAction.id, lastAction.prevCategory, true)
                setLastAction(null)
                setToast(null)
                refreshAll()
                fetchMonthlyCategorySummary().then(setMonthlyCats)
                fetchCategoryDefs().then(setCategoryDefs)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [lastAction, refreshAll])

    const handleUpdateCategory = async (id, category, remember) => {
        const result = await updateTransactionCategory(id, category, remember)
        setLastAction({ id, prevCategory: result.prev_category, remember })
        setToast(`Changed to "${category}"`)
        refreshAll()
        fetchMonthlyCategorySummary().then(setMonthlyCats)
        fetchCategoryDefs().then(setCategoryDefs)
    }

    const handleVoid = async (id, voided) => {
        await voidTransaction(id, voided)
        refreshAll()
        fetchMonthlyCategorySummary().then(setMonthlyCats)
    }

    return (
        <>
            <header className="main-header">
                <h1>Finance Tracker</h1>
                <select value={month} onChange={e => setMonth(e.target.value)}>
                    <option value="">All Months</option>
                    {months.map(m => (
                        <option key={m.month} value={m.month}>{formatMonth(m.month)}</option>
                    ))}
                </select>
            </header>

            <nav className="main-tabs">
                <button
                    className={`main-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`main-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    Transactions
                </button>
            </nav>

            <main>
                {activeTab === 'dashboard' ? (
                    <>
                        <StatsBar txns={txns} categories={categories} />
                        <section className="charts">
                            <div className="chart-card chart-card-monthly">
                                <h2>Monthly Spending</h2>
                                <MonthlyChart data={monthlyCats} months={monthly} activeMonth={month} categoryDefs={categoryDefs} />
                            </div>
                            <div className="chart-card chart-card-category">
                                <h2>By Category</h2>
                                <CategoryChart data={categories} />
                            </div>
                        </section>
                        <section className="daily-section">
                            <h2>Daily Spending</h2>
                            <DailyCalendar data={daily} month={month} />
                        </section>
                    </>
                ) : (
                    <Transactions
                        txns={txns}
                        credits={credits}
                        categories={categories}
                        selectedCats={selectedCats}
                        onToggleCat={toggleCat}
                        onUpdateCategory={handleUpdateCategory}
                        onVoid={handleVoid}
                        categoryDefs={categoryDefs}
                    />
                )}
            </main>

            {toast && (
                <Toast
                    message={toast}
                    onDismiss={() => { setToast(null); setLastAction(null) }}
                />
            )}
        </>
    )
}

function formatMonth(ym) {
    const [y, m] = ym.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(m, 10) - 1]} ${y}`
}

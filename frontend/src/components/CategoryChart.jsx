import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const CATEGORY_COLORS = {
    food: '#f97316',
    drinks: '#a855f7',
    travel: '#3b82f6',
    transport: '#22c55e',
    groceries: '#eab308',
    lifestyle: '#ec4899',
    subscriptions: '#14b8a6',
    education: '#8b5cf6',
    investment: '#6366f1',
    insurance: '#0ea5e9',
    transfers: '#f43f5e',
    misc: '#64748b',
    uncategorised: '#475569',
}

export default function CategoryChart({ data }) {
    if (!data || data.length === 0) return null

    const sorted = [...data].sort((a, b) => b.total - a.total)
    const labels = sorted.map(d => d.category)
    const values = sorted.map(d => d.total)
    const colors = labels.map(c => CATEGORY_COLORS[c] || '#64748b')

    const chartData = {
        labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6,
        }]
    }

    return (
        <div className="category-layout">
            <div className="category-chart-wrap">
                <Doughnut data={chartData} options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '60%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.label}: $${ctx.parsed.toFixed(2)}`,
                            },
                        },
                    },
                }} />
            </div>
            <div className="category-table">
                {sorted.map(d => (
                    <div key={d.category} className="cat-row">
                        <span className="cat-dot" style={{ background: CATEGORY_COLORS[d.category] || '#64748b' }} />
                        <span className="cat-name">{d.category}</span>
                        <span className="cat-amount">${d.total.toFixed(0)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

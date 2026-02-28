import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export default function DailyCalendar({ data, month }) {
    // Calendar grid data (for square boxes)
    const calendarData = useMemo(() => {
        if (!data || data.length === 0 || !month) return null

        const [year, mon] = month.split('-').map(Number)
        const daysInMonth = new Date(year, mon, 0).getDate()
        const firstDay = new Date(year, mon - 1, 1).getDay()

        const dayMap = {}
        let maxSpend = 0
        data.forEach(d => {
            const day = parseInt(d.date.slice(8))
            dayMap[day] = d.total
            if (d.total > maxSpend) maxSpend = d.total
        })

        const cells = []
        for (let i = 0; i < firstDay; i++) cells.push(null)
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, total: dayMap[d] || 0 })
        }

        return { cells, maxSpend }
    }, [data, month])

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return null

        const labels = data.map(d => month ? d.date.slice(8) : d.date.slice(5))

        return {
            labels,
            datasets: [{
                data: data.map(d => d.total),
                borderColor: '#6c72cb',
                backgroundColor: 'rgba(108, 114, 203, 0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: data.length > 60 ? 0 : 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#6c72cb',
                borderWidth: 1.5,
            }],
        }
    }, [data, month])

    if (!chartData) return <p style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>No daily data</p>

    return (
        <div className="daily-container">
            {/* Calendar grid on the left (only when a month is selected) */}
            {calendarData && (
                <div className="mini-calendar">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="mini-cal-day">{d}</div>
                    ))}
                    {calendarData.cells.map((cell, i) =>
                        cell === null ? (
                            <div key={`b-${i}`} className="mini-cal-cell blank" />
                        ) : (
                            <div
                                key={cell.day}
                                className="mini-cal-cell"
                                style={{ background: cellColor(cell.total, calendarData.maxSpend) }}
                                title={`${cell.day}: $${cell.total.toFixed(2)}`}
                            >
                                <span className="mini-cal-date">{cell.day}</span>
                                {cell.total > 0 && <span className="mini-cal-amt">${cell.total.toFixed(0)}</span>}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Line graph on the right */}
            <div className="daily-line-chart">
                <Line data={chartData} options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: calendarData ? 3 : 8,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `$${ctx.parsed.y.toFixed(2)}`,
                            },
                        },
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: '#8b8fa3',
                                font: { size: 9 },
                                maxTicksLimit: month ? 31 : 15,
                                maxRotation: 0,
                            },
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,.04)' },
                            ticks: {
                                color: '#8b8fa3',
                                font: { size: 9 },
                                callback: v => `$${v}`,
                            },
                        },
                    },
                    interaction: { mode: 'index', intersect: false },
                }} />
            </div>
        </div>
    )
}

function cellColor(total, maxSpend) {
    if (total === 0 || maxSpend === 0) return 'var(--bg-card)'
    const t = Math.min(total / maxSpend, 1)
    const alpha = 0.12 + t * 0.55
    return `rgba(108, 114, 203, ${alpha})`
}

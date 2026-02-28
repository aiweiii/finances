import { useMemo } from 'react'
import { BarChart } from '@mui/x-charts/BarChart'

const DEFAULT_COLORS = {
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

export default function MonthlyChart({ data, months, activeMonth, categoryDefs }) {
    const catColors = useMemo(() => {
        const colors = { ...DEFAULT_COLORS }
        if (categoryDefs) {
            categoryDefs.forEach(c => { colors[c.name] = c.color })
        }
        return colors
    }, [categoryDefs])

    const { xLabels, series } = useMemo(() => {
        if (!data || !months) return { xLabels: [], series: [] }

        const monthLabels = months.map(m => m.month)
        const xLabels = monthLabels.map(formatShortMonth)
        const cats = [...new Set(data.map(d => d.category))]

        const series = cats.map(cat => ({
            data: monthLabels.map(m => {
                const entry = data.find(d => d.month === m && d.category === cat)
                return entry ? entry.total : 0
            }),
            label: cat,
            stack: 'total',
            color: catColors[cat] || '#64748b',
            valueFormatter: (v) => `$${v.toFixed(0)}`,
        }))

        return { xLabels, series }
    }, [data, months, catColors])

    if (xLabels.length === 0) return null

    return (
        <BarChart
            height={260}
            series={series}
            xAxis={[{
                data: xLabels,
                scaleType: 'band',
                tickLabelStyle: { fill: '#a0a4b8', fontSize: 11 },
            }]}
            yAxis={[{
                valueFormatter: v => `$${v}`,
                tickLabelStyle: { fill: '#a0a4b8', fontSize: 11 },
            }]}
            slotProps={{
                legend: {
                    labelStyle: { fill: '#a0a4b8', fontSize: 11 },
                },
            }}
            tooltip={{ trigger: 'item' }}
            sx={{
                // SVG text overrides for axis
                '.MuiChartsAxis-tickLabel tspan': { fill: '#a0a4b8 !important' },
                '.MuiChartsAxis-line': { stroke: '#2a2e3d' },
                '.MuiChartsAxis-tick': { stroke: '#2a2e3d' },
                // Legend text — target all possible class patterns
                '.MuiChartsLegend-series text': { fill: '#a0a4b8 !important' },
                '.MuiChartsLegend-label': { fill: '#a0a4b8 !important' },
                '.MuiChartsLegend-root text': { fill: '#a0a4b8 !important' },
                'text': { fill: '#a0a4b8' },
            }}
        />
    )
}

function formatShortMonth(ym) {
    const [y, m] = ym.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

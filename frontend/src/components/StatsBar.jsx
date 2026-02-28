export default function StatsBar({ txns, categories }) {
    const total = txns.reduce((s, t) => s + t.amount, 0)
    const topCat = categories.length > 0 ? categories[0].category : '—'

    return (
        <section className="stats">
            <div className="stat-card">
                <span className="stat-label">Total Spent</span>
                <span className="stat-value">${total.toFixed(2)}</span>
            </div>
            <div className="stat-card">
                <span className="stat-label">Transactions</span>
                <span className="stat-value">{txns.length}</span>
            </div>
            <div className="stat-card">
                <span className="stat-label">Top Category</span>
                <span className="stat-value">{topCat}</span>
            </div>
        </section>
    )
}

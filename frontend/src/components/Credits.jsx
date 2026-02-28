const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(iso) {
    const [, m, d] = iso.split('-')
    return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

export default function Credits({ txns }) {
    if (!txns || txns.length === 0) return null

    const total = txns.reduce((s, t) => s + t.amount, 0)

    return (
        <section className="table-section credits-section">
            <div className="table-header">
                <h2>Income / Credits</h2>
                <span className="credits-total">+${total.toFixed(2)}</span>
            </div>
            <div className="credits-list">
                {txns.map(t => (
                    <div key={t.id} className="credit-row">
                        <span className="txn-date">{fmtDate(t.date)}</span>
                        <span className="txn-merchant" title={t.merchant}>{t.merchant}</span>
                        <span className="credit-amt">+${t.amount.toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </section>
    )
}

const amount = 37600;
const insightAmount = 8939
const cards = [
    {title: "Total Spent", stats: `$${amount.toLocaleString()}`, insights: ` vs last month`},
    {title: "Transactions", stats: '126', insights: "this period"},
    {title: "Top Category", stats: 'Food', insights: `$${insightAmount.toLocaleString()} spent`},
    {title: "Average Daily Spend", stats: 'Food', insights: `$${insightAmount.toLocaleString()} spent`}
]

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">

            {/* quick stats overview */}
            <div className="max-w-5xl">
                <div className="mb-5">Finance Tracker</div>
                <div className="grid grid-cols-4 gap-5 min-h-30 min-w-200">
                    {cards.map((card) => (
                        <div key={card.title}
                             className="flex flex-col justify-evenly rounded-lg border border-zinc-200 p-3">
                            <div className="text-sm">{card.title}</div>
                            <div className="text-2xl">{card.stats}</div>
                            <div className="text-sm">{card.insights}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* monthly spending breakdown*/}
            <div>

            </div>


        </div>
    );
}

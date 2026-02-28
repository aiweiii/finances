const BASE = '';

export async function fetchTransactions(month) {
    const qs = month ? `?month=${month}` : '';
    const res = await fetch(`${BASE}/api/transactions${qs}`);
    return res.json();
}

export async function fetchCreditTransactions(month) {
    const qs = month ? `?month=${month}` : '';
    const res = await fetch(`${BASE}/api/transactions/credits${qs}`);
    return res.json();
}

export async function fetchMonthlySummary() {
    const res = await fetch(`${BASE}/api/summary/monthly`);
    return res.json();
}

export async function fetchCategorySummary(month) {
    const qs = month ? `?month=${month}` : '';
    const res = await fetch(`${BASE}/api/summary/category${qs}`);
    return res.json();
}

export async function fetchDailySummary(month) {
    const qs = month ? `?month=${month}` : '';
    const res = await fetch(`${BASE}/api/summary/daily${qs}`);
    return res.json();
}

export async function fetchMonthlyCategorySummary() {
    const res = await fetch(`${BASE}/api/summary/monthly-categories`);
    return res.json();
}

export async function updateTransactionCategory(id, category, remember) {
    const res = await fetch(`${BASE}/api/transactions/update-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category, remember }),
    });
    return res.json();
}

export async function voidTransaction(id, voided) {
    const res = await fetch(`${BASE}/api/transactions/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, voided }),
    });
    return res.json();
}

export async function fetchCategoryDefs() {
    const res = await fetch(`${BASE}/api/categories`);
    return res.json();
}

export async function createCategory(name, color) {
    const res = await fetch(`${BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
    });
    return res.json();
}

import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const api = axios.create({
  baseURL: rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : 'http://127.0.0.1:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password })
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me')
  return data
}

export async function fetchLookup(path, query = '', limit = 20) {
  const { data } = await api.get(path, {
    params: {
      query: query || undefined,
      limit,
    },
  })
  return data
}

export async function fetchPayments(params) {
  const { data } = await api.get('/payments', { params })
  return data
}

export async function downloadPaymentsExport(format, params) {
  const response = await api.get(`/payments/export/${format}`, {
    params,
    responseType: 'blob',
  })
  return response
}

export async function fetchPaymentsMeta() {
  const { data } = await api.get('/payments/meta')
  return data
}

export async function fetchPayment(paymentId) {
  const { data } = await api.get(`/payments/${paymentId}`)
  return data
}

export async function fetchBankAccountBalance(bankAccountId) {
  const { data } = await api.get(`/payments/bank-accounts/${bankAccountId}/balance`)
  return data
}

export async function createPayment(payload) {
  const { data } = await api.post('/payments', payload)
  return data
}

export async function updatePayment(paymentId, payload) {
  const { data } = await api.put(`/payments/${paymentId}`, payload)
  return data
}

export async function deletePayment(paymentId, options = {}) {
  await api.delete(`/payments/${paymentId}`, {
    params: {
      delete_counterpart: options.deleteCounterpart || undefined,
    },
  })
}

export async function createPaymentsBatch(items) {
  const { data } = await api.post('/payments/batch', { items })
  return data
}

export function buildPaymentAttachmentUrl(attachmentId) {
  return `${api.defaults.baseURL}/payments/attachments/${attachmentId}/content`
}

export async function fetchCompaniesOverview(params) {
  const { data } = await api.get('/companies/overview', { params })
  return data
}

export async function createCompany(payload) {
  const { data } = await api.post('/companies', payload)
  return data
}

export async function fetchCompany(companyId) {
  const { data } = await api.get(`/companies/${companyId}`)
  return data
}

export async function updateCompany(companyId, payload) {
  const { data } = await api.put(`/companies/${companyId}`, payload)
  return data
}

export async function deleteCompany(companyId) {
  await api.delete(`/companies/${companyId}`)
}

export async function fetchBankAccountsOverview(params) {
  const { data } = await api.get('/bank-accounts/overview', { params })
  return data
}

export async function fetchBanksOverview(params) {
  const { data } = await api.get('/banks/overview', { params })
  return data
}

export async function fetchCompanyBankAccountsLookup(query = '', limit = 20) {
  const { data } = await api.get('/company-bank-accounts', {
    params: {
      query: query || undefined,
      limit,
    },
  })
  return data
}

export async function createBankAccount(payload) {
  const { data } = await api.post('/bank-accounts', payload)
  return data
}

export async function fetchBankAccount(bankAccountId) {
  const { data } = await api.get(`/bank-accounts/${bankAccountId}`)
  return data
}

export async function updateBankAccount(bankAccountId, payload) {
  const { data } = await api.put(`/bank-accounts/${bankAccountId}`, payload)
  return data
}

export async function deleteBankAccount(bankAccountId) {
  await api.delete(`/bank-accounts/${bankAccountId}`)
}

export async function createBank(payload) {
  const { data } = await api.post('/banks', payload)
  return data
}

export async function fetchBank(bankId) {
  const { data } = await api.get(`/banks/${bankId}`)
  return data
}

export async function updateBank(bankId, payload) {
  const { data } = await api.put(`/banks/${bankId}`, payload)
  return data
}

export async function deleteBank(bankId) {
  await api.delete(`/banks/${bankId}`)
}

export async function fetchClientsOverview(params) {
  const { data } = await api.get('/clients/overview', { params })
  return data
}

export async function createClient(payload) {
  const { data } = await api.post('/clients', payload)
  return data
}

export async function fetchClient(clientId) {
  const { data } = await api.get(`/clients/${clientId}`)
  return data
}

export async function updateClient(clientId, payload) {
  const { data } = await api.put(`/clients/${clientId}`, payload)
  return data
}

export async function deleteClient(clientId) {
  await api.delete(`/clients/${clientId}`)
}

export async function fetchCounterpartiesOverview(params) {
  const { data } = await api.get('/counterparties/overview', { params })
  return data
}

export async function createCounterparty(payload) {
  const { data } = await api.post('/counterparties', payload)
  return data
}

export async function fetchCounterparty(counterpartyId) {
  const { data } = await api.get(`/counterparties/${counterpartyId}`)
  return data
}

export async function updateCounterparty(counterpartyId, payload) {
  const { data } = await api.put(`/counterparties/${counterpartyId}`, payload)
  return data
}

export async function deleteCounterparty(counterpartyId) {
  await api.delete(`/counterparties/${counterpartyId}`)
}

export function isAccountTransferRow(row, bankAccount) {
  return (
    row.partyType === 'company' &&
    row.relatedCompany?.bankAccountId &&
    bankAccount?.value &&
    Number(row.relatedCompany.bankAccountId) !== Number(bankAccount.value)
  )
}

export function normalizeLookupText(value) {
  return String(value || '').trim().toLowerCase()
}

export function findCompanyBankAccountOption(companyOption, accountOptions) {
  if (!companyOption) {
    return null
  }

  const companyId = companyOption.companyId ?? companyOption.value
  if (companyId) {
    const matches = accountOptions.filter((option) => Number(option.companyId) === Number(companyId))
    return matches.length === 1 ? matches[0] : null
  }

  const companyName = normalizeLookupText(companyOption.companyName || companyOption.label)
  if (!companyName) {
    return null
  }

  const matches = accountOptions.filter((option) => (
    normalizeLookupText(option.companyName) === companyName ||
    normalizeLookupText(option.label).includes(companyName)
  ))
  return matches.length === 1 ? matches[0] : null
}

export function hasTransferCounterpart(payment) {
  return Boolean(payment?.related_company?.bank_account_id)
}


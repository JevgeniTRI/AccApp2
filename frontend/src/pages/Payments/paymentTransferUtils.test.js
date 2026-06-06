import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findCompanyBankAccountOption,
  hasTransferCounterpart,
  isAccountTransferRow,
} from './paymentTransferUtils.js'

const sourceBankAccount = { value: 10 }
const targetAccount = {
  value: 2,
  companyId: 42,
  companyName: 'Target OÜ',
  label: 'Target OÜ | LHV | EUR | EE123',
  bankAccountId: 2,
}

test('findCompanyBankAccountOption returns the only bank account for a selected company', () => {
  const selectedCompany = { value: 42, label: 'Target OÜ' }

  assert.deepEqual(
    findCompanyBankAccountOption(selectedCompany, [targetAccount]),
    targetAccount,
  )
})

test('findCompanyBankAccountOption refuses ambiguous company accounts', () => {
  const selectedCompany = { value: 42, label: 'Target OÜ' }
  const secondAccount = { ...targetAccount, value: 3, bankAccountId: 3 }

  assert.equal(
    findCompanyBankAccountOption(selectedCompany, [targetAccount, secondAccount]),
    null,
  )
})

test('findCompanyBankAccountOption can resolve by company name when id is absent', () => {
  const selectedCompany = { label: 'Target OÜ' }

  assert.deepEqual(
    findCompanyBankAccountOption(selectedCompany, [targetAccount]),
    targetAccount,
  )
})

test('isAccountTransferRow recognizes a company row with a different target bank account', () => {
  assert.equal(
    isAccountTransferRow(
      { partyType: 'company', relatedCompany: { bankAccountId: 2 } },
      sourceBankAccount,
    ),
    true,
  )
})

test('isAccountTransferRow does not mark same-account or client rows as transfers', () => {
  assert.equal(
    isAccountTransferRow(
      { partyType: 'company', relatedCompany: { bankAccountId: 10 } },
      sourceBankAccount,
    ),
    false,
  )
  assert.equal(
    isAccountTransferRow(
      { partyType: 'clientCounterparty', relatedCompany: { bankAccountId: 2 } },
      sourceBankAccount,
    ),
    false,
  )
})


test('hasTransferCounterpart detects payment detail with counterpart bank account', () => {
  assert.equal(
    hasTransferCounterpart({ related_company: { id: 42, bank_account_id: 2 } }),
    true,
  )
  assert.equal(
    hasTransferCounterpart({ related_company: { id: 42, bank_account_id: null } }),
    false,
  )
})

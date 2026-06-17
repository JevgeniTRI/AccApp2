import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findCompanyBankAccountOption,
  getTransferPaymentDirections,
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

test('getTransferPaymentDirections keeps positive transfer on selected account as incoming', () => {
  assert.deepEqual(
    getTransferPaymentDirections(10),
    { primary: 'incoming', counterpart: 'outgoing' },
  )
})

test('getTransferPaymentDirections keeps negative transfer on selected account as outgoing', () => {
  assert.deepEqual(
    getTransferPaymentDirections(-10),
    { primary: 'outgoing', counterpart: 'incoming' },
  )
})

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


test('hasTransferCounterpart requires an explicit transfer pair link', () => {
  assert.equal(
    hasTransferCounterpart({ transfer_pair_id: 20, related_company: { id: 42, bank_account_id: 2 } }),
    true,
  )
  assert.equal(
    hasTransferCounterpart({ transfer_pair_id: null, related_company: { id: 42, bank_account_id: 2 } }),
    false,
  )
})

test('getTransferPaymentDirections treats positive numeric string as incoming on selected account', () => {
  assert.deepEqual(
    getTransferPaymentDirections('10'),
    { primary: 'incoming', counterpart: 'outgoing' },
  )
})

test('getTransferPaymentDirections treats negative numeric string as outgoing on selected account', () => {
  assert.deepEqual(
    getTransferPaymentDirections('-10'),
    { primary: 'outgoing', counterpart: 'incoming' },
  )
})

test('getTransferPaymentDirections treats zero as incoming on selected account', () => {
  assert.deepEqual(
    getTransferPaymentDirections(0),
    { primary: 'incoming', counterpart: 'outgoing' },
  )
})

test('getTransferPaymentDirections keeps negative decimal as outgoing on selected account', () => {
  assert.deepEqual(
    getTransferPaymentDirections(-10.55),
    { primary: 'outgoing', counterpart: 'incoming' },
  )
})

test('isAccountTransferRow treats matching string and numeric account ids as same account', () => {
  assert.equal(
    isAccountTransferRow(
      { partyType: 'company', relatedCompany: { bankAccountId: '10' } },
      sourceBankAccount,
    ),
    false,
  )
})

test('isAccountTransferRow returns false without selected bank account', () => {
  assert.equal(
    isAccountTransferRow(
      { partyType: 'company', relatedCompany: { bankAccountId: 2 } },
      null,
    ),
    false,
  )
})

test('isAccountTransferRow returns false without related company bank account', () => {
  assert.equal(
    isAccountTransferRow(
      { partyType: 'company', relatedCompany: { bankAccountId: null } },
      sourceBankAccount,
    ),
    false,
  )
})

test('findCompanyBankAccountOption matches company name case-insensitively', () => {
  assert.deepEqual(
    findCompanyBankAccountOption({ label: 'target oü' }, [targetAccount]),
    targetAccount,
  )
})

test('findCompanyBankAccountOption returns null for unknown company text', () => {
  assert.equal(
    findCompanyBankAccountOption({ label: 'Missing OÜ' }, [targetAccount]),
    null,
  )
})

test('hasTransferCounterpart returns false for missing payment detail', () => {
  assert.equal(hasTransferCounterpart(null), false)
})


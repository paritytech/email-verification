'use strict'

const fs = require('fs')
const path = require('path')
const sha3 = require('web3/lib/utils/sha3')

const { address, owner, passwordFile } = require('config')
const web3 = require('./web3')
const hasRequested = require('./has-requested')

const password = fs.readFileSync(passwordFile, {encoding: 'utf8'}).trim()

const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/ProofOfEmail.abi')))
const contract = web3.eth.contract(abi).at(address)

// TODO use `web3._extend` for this
const signAndSendTransaction = (data, password) =>
  new Promise((resolve, reject) => {
    web3._requestManager.sendAsync({
      method: 'personal_sendTransaction',
      params: [data, password]
    }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

const postToContract = (who, emailHash, code) => {
  // The response to the challenge. Because arbitrary-length strings don't play nicely with contracts, we use `sha3(code)`.
  const token = '0x' + sha3(code)
  // Will be stored inside the (public) contract, together with `who` and `emailHash`.
  const tokenHash = '0x' + sha3(token, {encoding: 'hex'})

  if (contract.certified(who)) {
    return Promise.reject(new Error('This address has already been verified.'))
  }

  return hasRequested(who, emailHash)
  .then((hasRequested) => {
    if (!hasRequested) throw new Error('Verification of this address not requested.')

    console.info(`Sending challenge to contract.`)
    return signAndSendTransaction({
      from: owner,
      to: address,
      data: contract.puzzle.getData(who, tokenHash, emailHash)
    }, password)
  })
}

module.exports = postToContract

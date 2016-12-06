'use strict'

const fs = require('fs')
const path = require('path')
const { address, owner, passwordFile } = require('config')
const password = require('fs').readFileSync(passwordFile, {encoding: 'utf8'}).trim()

const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/ProofOfEmail.abi')))
const web3 = require('./web3')
const sha3 = web3.sha3

const contract = web3.eth.contract(abi).at(address)

const hasRequested = (address) =>
  new Promise((resolve, reject) => {
    // TODO it is `Requested(encryptedEmail)` right now.
    contract.Requested({who: address}, {fromBlock: 0, toBlock: 'latest'})
    .watch((err, data) => {
      if (err) return reject(err)
      if (data && data.type === 'mined') {
        // TODO it is `Requested(encryptedEmail)` right now.
        resolve(data.args.who.toLowerCase() === address)
      }
    })
    setTimeout(() => resolve(false), 10000)
  })

// TODO use `web3._extend` for this
const signAndSendTransaction = (data, password) =>
  new Promise((resolve, reject) => {
    web3._requestManager.sendAsync({
      method: 'personal_signAndSendTransaction',
      params: [data, password]
    }, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })

const postToContract = (who, code) => {
  // The response to the challenge. Because arbitrary-length strings don't play nicely with contracts, we use `sha3(code)`.
  const token = sha3(code)
  // Will be stored inside the (public) contract, paired with `who`.
  const tokenHash = sha3(token, {encoding: 'hex'})

  if (contract.certified(who)) {
    return Promise.reject(new Error('This address has already been verified.'))
  }

  return hasRequested(who)
  .then((hasRequested) => {
    if (!hasRequested) throw new Error('Verification of this address not requested.')

    console.info(`Sending challenge to contract.`)
    return signAndSendTransaction({
      from: owner,
      to: address,
      // TODO it is `Puzzled(encryptedEmail, puzzle)` right now.
      data: contract.puzzle.getData(who, tokenHash)
    }, password)
  })
}

module.exports = postToContract

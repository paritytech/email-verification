'use strict'

const fs = require('fs')
const path = require('path')
const { address, owner, passwordFile } = require('config')
const password = require('fs').readFileSync(passwordFile, {encoding: 'utf8'}).trim()

const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/ProofOfEmail.abi')))
const web3 = require('./web3')
const sha3 = web3.sha3

const contract = web3.eth.contract(abi).at(address)

const hasRequested = (address, emailHash) =>
  new Promise((resolve, reject) => {
    const watcher = contract.Requested({who: address, emailHash}, {
      fromBlock: 0, toBlock: 'latest'
    })
    watcher.watch((err, data) => {
      if (err) return reject(err)
      if (data && data.type === 'mined') {
        watcher.stopWatching()
        resolve(data.args.emailHash.toLowerCase() === emailHash &&
          data.args.who.toLowerCase() === address)
      }
    })
    setTimeout(() => {
      watcher.stopWatching()
      resolve(false)
    }, 10000)
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

const postToContract = (who, emailHash, code) => {
  // The response to the challenge. Because arbitrary-length strings don't play nicely with contracts, we use `sha3(code)`.
  const token = sha3(code)
  // Will be stored inside the (public) contract, together with `who` and `emailHash`.
  const tokenHash = sha3(token, {encoding: 'hex'})

  if (contract.certified(who)) {
    return Promise.reject(new Error('This address has already been verified.'))
  }

  return hasRequested(who, '0x' + emailHash)
  .then((hasRequested) => {
    if (!hasRequested) throw new Error('Verification of this address not requested.')

    console.info(`Sending challenge to contract.`)
    return signAndSendTransaction({
      from: owner,
      to: address,
      data: contract.puzzle.getData(who, tokenHash, '0x' + emailHash)
    }, password)
  })
}

module.exports = postToContract

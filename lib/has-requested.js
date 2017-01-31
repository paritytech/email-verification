'use strict'

const fs = require('fs')
const path = require('path')
const co = require('co')
const coder = require('web3/lib/solidity/coder')

const { address } = require('config')
const web3 = require('./web3')
const contractEvent = require('./contract-event')

const abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/ProofOfEmail.abi')))
const contract = web3.eth.contract(abi).at(address)

// In order to find the last `Requested` event for an account efficiently, we need to use the Parity-proprietary `limit` parameter (https://github.com/ethcore/parity/blob/a58fad06a7955247e4f01dd98cd97bab2d82f71f/js/src/jsonrpc/interfaces/eth.js#L933-L937). web3.js filters it out, so we need to make the RPC calls manually.
// todo: move back to web3 once `limit` or some comparable mechanism is in the standard or switch to Parity.js
const hasRequested = co.wrap(function* (who, emailHash) {
  const event = yield contractEvent(contract, abi, 'Requested', [
    '0x' + coder.encodeParam('address', who), // 1st indexed param
    null // 2nd indexed param
  ])

  try {
    const [log] = yield event.getLogs()
    yield event.unsubscribe()
    if (!log) return false

    const _who = coder.decodeParam('address', log.params.who.slice(2))
    const _emailHash = coder.decodeParam('bytes32', log.params.emailHash.slice(2))
    return (
      emailHash.toLowerCase() === _emailHash.toLowerCase() &&
      _who.toLowerCase() === who.toLowerCase()
    )
  } catch (err) {
    yield event.unsubscribe()
    throw err
  }
})

module.exports = hasRequested

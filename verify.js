'use strict'

const co = require('co-express')
const boom = require('boom')
const sha3 = require('web3/lib/utils/sha3')

const web3 = require('./lib/web3')
const storage = require('./lib/storage')
const generateCode = require('./lib/generate-code')
const postToContract = require('./lib/post-to-contract')
const sendEmail = require('./lib/send-email')

module.exports = co(function* (req, res) {
  const email = req.query.email

  const address = req.query.address.toLowerCase()
  if (!web3.isAddress(address)) throw boom.badRequest('Address is invalid.')

  let code
  try {
    code = yield generateCode()
  } catch (err) {
    throw boom.internal('An error occured while generating a code.')
  }

  const anonymized = sha3(email)
  try {
    if (yield storage.has(anonymized)) {
      throw boom.badRequest('This e-mail has already been verified.')
    }
    yield storage.put(anonymized, code)
    console.info(`Hash of e-mail (${anonymized}) put into DB.`)
  } catch (err) {
    if (err.isBoom) throw err
    throw boom.internal('An error occured while querying the database.')
  }

  try {
    const txHash = yield postToContract(address, code)
    console.info(`Challenge sent to contract (tx ${txHash}).`)
  } catch (err) {
    throw boom.internal('An error occured while sending to the contract.')
  }

  try {
    yield sendEmail(email, code)
    console.info(`Verification code sent to ${anonymized}.`)
    return res.status(202).json({
      status: 'ok',
      message: `Verification code sent to ${email}.`
    })
  } catch (err) {
    throw boom.internal('An error occured while sending the e-mail.')
  }
})

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
  if (typeof email !== 'string' || email.indexOf('@') < 0) throw boom.badRequest('E-mail is invalid.')

  const address = req.query.address.toLowerCase()
  if (!web3.isAddress(address)) throw boom.badRequest('Address is invalid.')

  let code
  try {
    code = yield generateCode()
  } catch (err) {
    throw boom.wrap(err, 500, 'An error occured while generating a code')
  }

  const anonymized = '0x' + sha3(email)
  try {
    if (yield storage.has(anonymized)) {
      throw boom.badRequest('This e-mail has already been verified.')
    }
  } catch (err) {
    if (err.isBoom) throw err
    throw boom.wrap(err, 500, 'An error occured while querying the database')
  }

  try {
    const txHash = yield postToContract(address, anonymized, code)
    console.info(`Challenge sent to contract (tx ${txHash}).`)
  } catch (err) {
    console.error(err)
    throw boom.wrap(err, 500, 'An error occured while querying Parity')
  }

  try {
    yield sendEmail(email, code)
    console.info(`Verification code sent to ${anonymized}.`)
  } catch (err) {
    throw boom.wrap(err, 500, 'An error occured while sending the e-mail')
  }

  try {
    yield storage.put(anonymized, code)
    console.info(`Hash of e-mail (${anonymized}) put into DB.`)
  } catch (err) {
    throw boom.wrap(err, 500, 'An error occured while querying the database')
  }

  return res.status(202).json({
    status: 'ok',
    message: `Verification code sent to ${email}.`
  })
})

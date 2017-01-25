'use strict'

const co = require('co-express')
const boom = require('boom')
const sha3 = require('web3/lib/utils/sha3')

const web3 = require('./lib/web3')
const storage = require('./lib/storage')

module.exports = co(function* (req, res) {
  const email = req.query.email
  if (typeof email !== 'string' || email.indexOf('@') < 0) throw boom.badRequest('E-mail is invalid.')
  const anonymized = '0x' + sha3(email)

  const address = req.query.address && req.query.address.toLowerCase()
  if (!web3.isAddress(address)) throw boom.badRequest('Address is invalid.')

  try {
    // todo: check if the specified address is correct, to prevent mass retrieval of this information
    const hasRequested = yield storage.has(anonymized)
    if (!hasRequested) throw boom.notFound('There has not been requested any code for this e-mail.')
    return res.status(200).json({
      status: 'ok',
      message: 'A code has been requested for this e-mail.'
    })
  } catch (err) {
    throw boom.wrap(err, 500, 'An error occured while querying the database')
  }
})

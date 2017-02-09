'use strict'

const co = require('co-express')
const boom = require('boom')
const sha3 = require('web3/lib/utils/sha3')

const web3 = require('./lib/web3')
const hasRequested = require('./lib/has-requested')
const storage = require('./lib/storage')

module.exports = co(function* (req, res) {
  const email = req.query.email
  if (typeof email !== 'string' || email.indexOf('@') < 0) throw boom.badRequest('E-mail is invalid.')
  const anonymized = '0x' + sha3(email)

  const address = req.query.address && req.query.address.toLowerCase()
  if (!web3.isAddress(address)) throw boom.badRequest('Address is invalid.')

  try {
    if (!(yield hasRequested(address, anonymized))) {
      throw boom.badRequest('There is no request with this e-mail & address.')
    }
  } catch (err) {
    if (err.isBoom) throw err
    throw boom.wrap(err, 500, 'An error occured while querying Parity')
  }

  try {
    const hasReceived = yield storage.has(anonymized)
    if (!hasReceived) throw boom.notFound('There has not been sent any code for this e-mail.')
    return res.status(200).json({
      status: 'ok',
      message: 'A code has been sent to this e-mail.'
    })
  } catch (err) {
    throw boom.wrap(err, 500, 'An error occured while querying the database')
  }
})

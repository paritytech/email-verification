'use strict'

const cfg = require('config').mailjet
const mailjet = require('node-mailjet').connect(cfg.key, cfg.secret)

const send = mailjet.post('send')

const sendEmail = (receiver, code) => {
  if (cfg.test) {
    console.info('code: ', code)
    return Promise.resolve('No code has been sent.')
  }
  return send.request({
    FromEmail: cfg.sender,
    FromName: cfg.name,
    Subject: `Parity code "${code}"`,
    'Text-part': `Your Parity e-mail verification code is "${code}".`,
    Recipients: [{Email: receiver}],
    Headers: {'Reply-To': cfg.replyTo}
  })
  .then(() => 'The email has been sent.')
  .catch((err) => {
    // TODO
    console.error('Mailjet error', err)
  })
}

module.exports = sendEmail

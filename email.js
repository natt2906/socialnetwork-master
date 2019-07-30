'use strict';

const nodemailer = require('nodemailer');

module.exports = {
    send: (sender, receiver, email, done) => {

        const DATA = {
            from: 'contact@socialnetwork.com',
            to: email,
            subject: 'You have received a notification!',
            text: `Hey, ${receiver}! You have received a notification from ${sender}.`
        };

        const CONFIG = {
            service: 'gmail',
            auth: {
                user: 'socialnetworkifocop@gmail.com',
                pass: 'IFOCOPRocks'
            }
        };

        const mail = nodemailer.createTransport(CONFIG);

        return mail.sendMail(DATA, done);
    }
};

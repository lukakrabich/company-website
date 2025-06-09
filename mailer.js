
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: 'quared22a@yandex.ru',
    pass: 'lfgfxkpbosfuluno'
  }
});

function sendOrderEmail(to, subject, html) {
  return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: '"Альянс Торг" <quared22a@yandex.ru>',
      to,
      subject,
      html
    }, (err, info) => {
      if (err) {
        console.error('Ошибка отправки письма:', err);
        reject(err);
      } else {
        console.log('Письмо отправлено:', info.response);
        resolve(info);
      }
    });
  });
}

module.exports = { sendOrderEmail };

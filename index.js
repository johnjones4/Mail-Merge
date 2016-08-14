var nodemailer = require('nodemailer');
var config = require('./config');
var fs = require('fs');
var async = require('async');
var parse = require('csv-parse');
var ejs = require('ejs');
var htmlToText = require('html-to-text');
var transporter = nodemailer.createTransport(config.mail.transport);

async.waterfall([
  setupInfo,
  sendEmails
],function(err) {
  if (err) {
    console.error(err);
    process.exit(-1);
  } else {
    process.exit(0);
  }
})

function setupInfo(done) {
  async.parallel({
    'template': function(next) {
      fs.readFile(config.template,{'encoding':'utf8'},next);
    },
    'list': function(next) {
      async.waterfall([
        function(next1) {
          fs.readFile(config.import.filePath,{'encoding':'utf8'},next1);
        },
        function(csvData,next1) {
          parse(csvData,{'columns':true},next1);
        }
      ],next);
    }
  },done);
}

function sendEmails(info,done) {
  var outstanding = info.list.length;
  var doneSend = function() {
    outstanding--;
    if (outstanding <= 0) {
      done();
    }
  }
  var interval = setInterval(function() {
    if (info.list.length > 0) {
      var row = info.list.shift();
      var html = ejs.render(info.template, row);
      var mailData = {
        "from": config.mail.message.from,
        "to": row[config.import.emailColumn],
        "subject": config.mail.message.subject,
        "html": html,
        "text": htmlToText.fromString(html)
      };
      console.log('Sending to: ' + mailData.to);
      if (config.dryRun) {
        console.log('======================================================');
        console.log(mailData);
        doneSend();
      } else {
        transporter.sendMail(mailData,function(err,info) {
          if (err) {
            console.error(err);
          }
          doneSend();
        });
      }
    } else {
      clearInterval(interval);
    }
  },config.sendDelay);
}

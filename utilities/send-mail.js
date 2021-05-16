'use strict'
const nodemailer = require('nodemailer')
const ejs = require('ejs')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const $ = require('cheerio')

const config = {
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}

if (process.env.SMTP_SERVICE != null) {
  config.service = process.env.SMTP_SERVICE
} else {
  config.host = process.env.SMTP_HOST
  config.port = parseInt(process.env.SMTP_PORT)
  config.secure = process.env.SMTP_SECURE !== 'false'
}

const transporter = nodemailer.createTransport(config)
const templateName = process.env.TEMPLATE_NAME ? process.env.TEMPLATE_NAME : 'rainbow'
const noticeTemplate = process.env.MAIL_TEMPLATE_ADMIN ? ejs.compile(process.env.MAIL_TEMPLATE_ADMIN) : ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'notice.ejs'), 'utf8'))
const sendTemplate = process.env.MAIL_TEMPLATE ? ejs.compile(process.env.MAIL_TEMPLATE) : ejs.compile(fs.readFileSync(path.resolve(process.cwd(), 'template', templateName, 'send.ejs'), 'utf8'))

// 提醒站长
exports.notice = (comment) => {
  // 站长自己发的评论不需要通知
  if (comment.get('mail') === process.env.TO_EMAIL ||
    comment.get('mail') === process.env.BLOGGER_EMAIL ||
    comment.get('mail') === process.env.SMTP_USER) {
    return
  }

  const name = comment.get('nick')
  const text = comment.get('comment')
  const url = process.env.SITE_URL + comment.get('url')

  if (!process.env.DISABLE_EMAIL) {
    const SITE_NAME = process.env.SITE_NAME
    const emailSubject = process.env.MAIL_SUBJECT_ADMIN ? eval('`' + process.env.MAIL_SUBJECT_ADMIN + '`') : '👉 咚！「' + SITE_NAME + '」上有新评论了'
    const emailContent = noticeTemplate({
      siteName: SITE_NAME,
      siteUrl: process.env.SITE_URL,
      name: name,
      text: text,
      url: url + '#' + comment.get('objectId')
    })

    const mailOptions = {
      from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>',
      to: process.env.TO_EMAIL || process.env.BLOGGER_EMAIL || process.env.SMTP_USER,
      subject: emailSubject,
      html: emailContent
    }

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.error(error)
      }
      comment.set('isNotified', true)
      comment.set('mailNotified', true)
      comment.save()
      console.log('收到一条评论, 已邮件提醒站长')
    })
  }

  if (process.env.SERVER_KEY != null) {
    const scContent = `
#### ${name} 发表评论：

${text}

#### [\[查看评论\]](${url + '#' + comment.get('objectId')})`
    axios({
      method: 'post',
      url: `https://sc.ftqq.com/${process.env.SERVER_KEY}.send`,
      data: `text=咚！「${process.env.SITE_NAME}」上有新评论了&desp=${scContent}`,
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      }
    })
      .then(function (response) {
        if (response.status === 200 && response.data.errmsg === 'success') {
          comment.set('isNotified', true)
          comment.set('wechatNotified', true)
          console.log('已微信提醒站长')
        } else {
          console.warn('微信提醒失败:', response.data)
        }
      })
      .catch(function (error) {
        console.error('微信提醒失败:', error.message)
      })
  }
  if (process.env.SERVER_TURBO_KEY != null) {
    const scContent = process.env.SERVER_TURBO_MD ? `
#### ${name} 发表评论：

${$(text.replace(/<img.*?src="(.*?)".*?>/g, "![图片]($1)").replace(/<br>/g, "\n")).text().replace(/\n+/g, "\n\n").replace(/\n+$/g, "")}

#### [查看评论](${url + '#' + comment.get('objectId')})` : `
${name} 发表评论：

${$(text.replace(/<img.*?src="(.*?)".*?>/g, "\n图片: $1\n").replace(/<br>/g, "\n")).text().replace(/\n+/g, "\n\n").replace(/\n+$/g, "")}

查看评论: ${url + '#' + comment.get('objectId')}`
    axios({
      method: 'post',
      url: `https://sctapi.ftqq.com/${process.env.SERVER_TURBO_KEY}.send`,
      data: `text=咚！「${process.env.SITE_NAME}」上有新评论了&desp=${scContent}`,
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      }
    })
      .then(function (response) {
        if (response.status === 200 && response.data.code === 0) {
          comment.set('isNotified', true)
          comment.set('wechatNotified', true)
          console.log('已通过Server酱提醒站长')
        } else {
          console.warn('Server酱提醒失败:', response.data)
        }
      })
      .catch(function (error) {
        console.error('Server酱提醒失败:', error.message)
      })
  }
  if (process.env.QMSG_KEY != null) {
    /*
    if (process.env.QQ_SHAKE != null) {
      axios.get(`https://qmsg.zendee.cn:443/send/${process.env.QMSG_KEY}?msg=${encodeURIComponent('[CQ:shake]')}`)
        .then(function (response) {
          if (response.status === 200 && response.data.success === true) {
            console.log('已发送QQ戳一戳')
          } else {
            console.warn('发送QQ戳一戳失败:', response.data)
          }
        })
        .catch(function (error) {
          console.error('发送QQ戳一戳失败:', error.message)
        })
    }
    */
    const content = text.replace(/<img.*?src="(.*?)".*?>/g, "\n[图片]$1\n").replace(/<br>/g, "\n").replace(/\n+/g, "\n").replace(/\n+$/g, "").replace(/(<p>)|(<\/p>)/g, '')
    const scContent = `@face=119@您的 ${process.env.SITE_NAME} 上有新评论了！
@face=183@${name} 发表评论：

@face=77@@face=77@@face=77@@face=77@@face=77@
${content}
@face=76@@face=76@@face=76@@face=76@@face=76@

@face=169@${url + '#' + comment.get('objectId')}`
    axios.get(`https://qmsg.zendee.cn:443/send/${process.env.QMSG_KEY}?msg=${encodeURIComponent(scContent)}`)
      .then(function (response) {
        if (response.status === 200 && response.data.success === true) {
          comment.set('isNotified', true)
          comment.set('qqNotified', true)
          console.log('已QQ提醒站长')
        } else {
          console.warn('QQ提醒失败:', response.data)
        }
      })
      .catch(function (error) {
        console.error('QQ提醒失败:', error.message)
      })
  }

}

// 发送邮件通知他人
exports.send = (currentComment, parentComment) => {
  // 站长被 @ 不需要提醒
  if (parentComment.get('mail') === process.env.TO_EMAIL ||
    parentComment.get('mail') === process.env.BLOGGER_EMAIL ||
    parentComment.get('mail') === process.env.SMTP_USER) {
    return
  }
  const PARENT_NICK = parentComment.get('nick')
  const SITE_NAME = process.env.SITE_NAME
  const emailSubject = process.env.MAIL_SUBJECT ? eval('`' + process.env.MAIL_SUBJECT + '`') : '👉 叮咚！「' + SITE_NAME + '」上有人@了你'
  const emailContent = sendTemplate({
    siteName: SITE_NAME,
    siteUrl: process.env.SITE_URL,
    pname: parentComment.get('nick'),
    ptext: parentComment.get('comment'),
    name: currentComment.get('nick'),
    text: currentComment.get('comment'),
    url: process.env.SITE_URL + currentComment.get('url') + '#' + currentComment.get('pid')
  })
  const mailOptions = {
    from: '"' + process.env.SENDER_NAME + '" <' + process.env.SMTP_USER + '>',
    to: parentComment.get('mail'),
    subject: emailSubject,
    html: emailContent
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error(error)
    }
    currentComment.set('isNotified', true)
    currentComment.save()
    console.log(currentComment.get('nick') + ' @了' + parentComment.get('nick') + ', 已通知.')
  })
}

// 该方法可验证 SMTP 是否配置正确
exports.verify = function () {
  console.log('....')
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error)
    }
    console.log('Server is ready to take our messages')
  })
}

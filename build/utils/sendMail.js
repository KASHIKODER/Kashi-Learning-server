"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const nodemailer_1 = __importDefault(require("nodemailer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendMail = async (options) => {
    const transporter = nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        service: process.env.SMTP_SERVICE,
        auth: {
            user: process.env.SMTP_MAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });
    const { email, subject, template, data, html } = options;
    let finalHtml;
    if (html) {
        // ✅ Already rendered HTML (like in your Razorpay controller)
        finalHtml = html;
    }
    else if (template) {
        // ✅ If template is provided, render it from mails folder
        const templatePath = path_1.default.join(__dirname, "../mails", template);
        finalHtml = await ejs_1.default.renderFile(templatePath, data || {});
    }
    else {
        throw new Error("Either html or template must be provided to sendMail()");
    }
    const mailOptions = {
        from: process.env.SMTP_MAIL,
        to: email,
        subject,
        html: finalHtml,
    };
    await transporter.sendMail(mailOptions);
};
exports.default = sendMail;
//# sourceMappingURL=sendMail.js.map
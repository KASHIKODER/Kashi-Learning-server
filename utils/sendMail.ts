require("dotenv").config();
import nodemailer, { Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";

interface EmailOptions {
  email: string;
  subject: string;
  template?: string; // ✅ make it optional (since sometimes we send direct HTML)
  data?: { [key: string]: any };
  html?: string; // ✅ allow directly passing rendered HTML
}

const sendMail = async (options: EmailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_MAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const { email, subject, template, data, html } = options;

  let finalHtml: string;

  if (html) {
    // ✅ Already rendered HTML (like in your Razorpay controller)
    finalHtml = html;
  } else if (template) {
    // ✅ If template is provided, render it from mails folder
    const templatePath = path.join(__dirname, "../mails", template);
    finalHtml = await ejs.renderFile(templatePath, data || {});
  } else {
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

export default sendMail;

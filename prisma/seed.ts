// Placeholder content. Edit here, or later in the CMS (/admin). Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { getSeedAdminCredentials } from '../src/server/seed-admin';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  if (await prisma.setting.count()) { console.log('Already seeded. Skipping.'); return; }
  const admin = getSeedAdminCredentials(process.env);
  const S = (key: string, value: object | string | number) => prisma.setting.create({ data: { key, value } });
  await S('site', { name: 'S Learning', tagline: 'Learn new skills. Unlock new opportunities.', support_email: 'support@example.com', phone: '+233 00 000 0000',
    address: 'Your business address, City, Country', hours: 'Mon-Fri, 8am-5pm GMT', whatsapp_url: 'https://whatsapp.com/channel/REPLACE_ME',
    video_url: '', video_poster: '', logo_url: '', stat_learners: '10,000+', stat_courses: '50+', stat_countries: '2' });
  // PRICES are placeholders in minor units (5000 = GHS 50.00 / NGN 50.00). Edit them in the CMS > Settings.
  await S('activation_fee', { GH: 5000, NG: 500000 });
  await S('referral_reward', { GH: 1000, NG: 100000 });
  await S('course_reward', { GH: 500, NG: 50000 });
  await S('min_withdrawal', { GH: 500, NG: 50000 });
  await S('withdrawal_review_above', { GH: 100000, NG: 10000000 });
  await S('withdrawal_fee_percent', 1.5);
  await S('payout_methods', { GH: ['MTN Mobile Money', 'Telecel Cash', 'AirtelTigo Money', 'Bank transfer'], NG: ['Bank transfer'] });
  await S('task_deadline_hours', 72);
  await S('reviews', [1, 2, 3].map(i => ({ name: 'Learner ' + i, country: i % 2 ? 'GH' : 'NG', rating: 5, text: 'Replace with a genuine learner review.' })));

  const cats = ['Cooking and Food', 'Business and Money', 'Technology', 'Health and Wellness', 'Farming', 'Languages'];
  const created = [];
  for (const [i, name] of cats.entries()) created.push(await prisma.category.create({ data: { name, description: `Short description for ${name}.`, sort: i } }));
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  for (let i = 1; i <= 12; i++) {
    await prisma.course.create({ data: {
      categoryId: created[i % 6].id, title: `Sample eBook ${i}`, author: 'Author name', description: 'Short description of this eBook. Replace with real content.',
      minutes: 40, level: levels[i % 3], rewardEligible: i % 2 === 0, enrolments: 100 - i * 5, learnPoints: ['Learning outcome one', 'Learning outcome two', 'Learning outcome three'], skills: 'Skill one, Skill two',
      lessons: { create: [1, 2, 3, 4].map(j => ({ title: `Lesson ${j}: Placeholder title`, kind: 'text', minutes: 10, preview: j === 1, sort: j,
        content: 'This is placeholder lesson text.\n\nReplace it in the CMS with your own content, or switch the lesson type to video or PDF.' })) } } });
  }
  for (const [title, body] of [['Did you know?', 'Replace this with a short fact, tip, or campaign message.'], ['Small steps add up', 'Fifteen minutes of study a day is over 90 hours in a year.'], ['Study tip', 'Finish a course to earn a certificate and unlock its reward, where eligible.']])
    await prisma.fact.create({ data: { title, body } });
  const note = '(Placeholder text. Replace with content reviewed by a qualified professional before launch.)';
  for (const [slug, title, body] of [
    ['faq', 'Frequently asked questions', `**How do I get started?**\nCreate an account, verify your email, then activate your account.\n\n**How do withdrawals work?**\nChoose a payout method available in your country. Times depend on payment providers.\n\n${note}`],
    ['privacy', 'Privacy Policy', `Explain what personal data you collect, why, how long you keep it, and how people can contact you.\n\n${note}`],
    ['terms', 'Terms and Conditions', `Explain the rules for using the platform, accounts, activation, rewards and withdrawals.\n\n${note}`],
    ['refund', 'Refund Policy', `Explain when activation fees can or cannot be refunded.\n\n${note}`],
    ['help', 'Help Centre', `Describe common problems and how to contact support.\n\n${note}`]])
    await prisma.page.create({ data: { slug, title, body } });
  await prisma.user.create({ data: { memberId: 'ADMIN001', username: admin.username, email: admin.email, fullName: 'Administrator',
    country: 'GH', phone: '+233000000000', passwordHash: await bcrypt.hash(admin.password, 12), role: 'admin', status: 'activated', eligible: true, emailVerified: true, deadlineAt: new Date() } });
  console.log('Seeded. Admin login:', admin.username);
}
main().finally(() => prisma.$disconnect());

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const privateDir = path.join(uploadRoot, 'private');
const publicDir = path.join(uploadRoot, 'public');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Pressbooks (BCCampus, MSU, Boise State, Oregon State, Iowa State...) serves downloads through CloudFront,
// which rejects bare requests. A normal browser header set is required or every PDF comes back as HTML.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const browserHeaders = (url: string) => ({
  'User-Agent': BROWSER_UA,
  Referer: new URL(url).origin + '/',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
});

const books = [
  {
    title: 'Project Management',
    author: 'Adrienne Watt',
    description: 'An introduction to the shared project lifecycle: initiation, planning, execution, control, and closeout.',
    source: 'https://opentextbc.ca/projectmanagement/',
    pdf: 'https://archive.org/download/2014ProjectManagement/2014_project-management.pdf',
    cover: 'https://covers.openlibrary.org/b/olid/OL26434237M-L.jpg?default=false',
    coverName: 'real-project-management-openlibrary',
    license: 'CC BY 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 180,
    points: ['Understand the project lifecycle', 'Plan scope, schedules, resources, and budgets', 'Monitor work and close projects effectively'],
    skills: 'Project planning, scheduling, budgeting, risk management',
  },
  {
    title: 'Introduction to Business',
    author: 'Lawrence J. Gitman, Carl McDaniel, Amit Shah, Monique Reece, Linda Koffel, Bethann Talsma, and James C. Hyatt',
    description: 'A foundational business text covering business environments, economics, entrepreneurship, management, marketing, and finance.',
    source: 'https://openstax.org/details/books/introduction-business',
    pdf: 'https://archive.org/download/openstax-introduction-to-business/IntroductionToBusiness-OP_8D04gAa.pdf',
    cover: 'https://archive.org/services/img/openstax-introduction-to-business',
    coverName: 'real-introduction-to-business',
    license: 'CC BY 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 900,
    points: ['Describe how business and economic environments work', 'Explain entrepreneurship and core business functions', 'Recognize foundations of management, marketing, and finance'],
    skills: 'Business fundamentals, entrepreneurship, management, marketing, finance',
  },
  {
    title: 'Business Ethics',
    author: 'Stephen M. Byars and Kurt Stanberry',
    description: 'How ethical reasoning applies to real business decisions: stakeholders, corporate responsibility, fair trade, and the role of government and culture.',
    source: 'https://openstax.org/details/books/business-ethics',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/business-ethics_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/business_ethics_card.svg',
    coverName: 'real-business-ethics',
    license: 'CC BY-NC-SA 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 600,
    points: ['Apply ethical frameworks to business situations', 'Explain corporate social responsibility and stakeholder interests', 'Recognise misconduct and ethical risk'],
    skills: 'Business ethics, decision making, corporate governance, compliance',
  },
  {
    title: 'Principles of Management',
    author: 'David S. Bright, Anastasia H. Cortes, et al.',
    description: 'The foundations of managing people and organisations: planning, organising, leading, controlling, and the skills managers need to build high-performing teams.',
    source: 'https://openstax.org/details/books/principles-management',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles-management_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles_of_management_book_card.svg',
    coverName: 'real-principles-of-management',
    license: 'CC BY-NC-SA 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 780,
    points: ['Describe the main functions of management', 'Explain motivation, teams, and organisational culture', 'Apply planning and control tools to real problems'],
    skills: 'Management, leadership, team building, performance management',
  },
  {
    title: 'Principles of Marketing',
    author: 'OpenStax',
    description: 'A practical walkthrough of marketing fundamentals: customer value, segmentation, pricing, distribution, promotion, and digital and social marketing.',
    source: 'https://openstax.org/details/books/principles-marketing',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles-marketing_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles.marketing.web.card.svg',
    coverName: 'real-principles-of-marketing',
    license: 'CC BY-NC-SA 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 720,
    points: ['Build a marketing plan around customer needs', 'Explain segmentation, targeting, and positioning', 'Use digital and social channels effectively'],
    skills: 'Marketing, market research, branding, digital marketing, sales',
  },
  {
    title: 'Principles of Finance',
    author: 'OpenStax',
    description: 'An introduction to finance for non-specialists: financial objectives, money and time, risk and return, stocks and bonds, and capital budgeting.',
    source: 'https://openstax.org/details/books/principles-finance',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/Principles_of_Finance_2e_-_WEB_.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles_of_finance_2e_web_card.svg',
    coverName: 'real-principles-of-finance',
    license: 'CC BY-NC-SA 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 720,
    points: ['Explain core financial objectives and decisions', 'Understand the time value of money and risk', 'Evaluate investment and financing options'],
    skills: 'Finance, budgeting, financial analysis, investing',
  },
  {
    title: 'Organizational Behavior',
    author: 'OpenStax',
    description: 'How people behave in organisations: personality, motivation, group dynamics, communication, leadership, and managing change.',
    source: 'https://openstax.org/details/books/organizational-behavior',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/organizational-behavior_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/organizational_behavior_book_card.svg',
    coverName: 'real-organizational-behavior',
    license: 'CC BY-NC-SA 4.0',
    category: 'Business and Money',
    language: 'English',
    duration: 600,
    points: ['Explain individual and group behaviour at work', 'Use motivation and communication theories', 'Manage conflict, power, and change'],
    skills: 'Organisational behaviour, communication, leadership, conflict resolution',
  },
  {
    title: 'College Success Concise',
    author: 'Amy Baldwin',
    description: 'Study skills for adult learners: time management, note-taking, reading, memory, wellbeing, money, and planning the next step.',
    source: 'https://openstax.org/details/books/college-success-concise',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/college-success-concise_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/college_success_concise_web_card.svg',
    coverName: 'real-college-success-concise',
    license: 'CC BY-NC-SA 4.0',
    category: null,
    language: 'English',
    duration: 180,
    points: ['Plan study time and set learning goals', 'Take better notes and read for understanding', 'Manage stress, money, and your learning plan'],
    skills: 'Study skills, time management, note-taking, goal setting',
  },
  {
    title: 'Introduction to Python Programming',
    author: 'Udayan Das, Aubrey Lawson, Chris Mayfield, Narges Norouzi',
    description: 'A hands-on first course in programming with Python: variables, control flow, functions, lists, files, and object-oriented basics.',
    source: 'https://openstax.org/details/books/introduction-python-programming',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/Introduction_to_Python_Programming-WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/introduction_to_python_programming_web_card.svg',
    coverName: 'real-introduction-to-python-programming',
    license: 'CC BY-NC-SA 4.0',
    category: 'Technology',
    language: 'English',
    duration: 600,
    points: ['Write and run Python programs', 'Use conditionals, loops, functions, and collections', 'Read and write files and model simple objects'],
    skills: 'Python, programming fundamentals, problem solving, automation',
  },
  {
    title: 'Introduction to Computer Science',
    author: 'OpenStax',
    description: 'The big picture of computing: hardware and software, networks, data and databases, the internet, and the social impact of technology.',
    source: 'https://openstax.org/details/books/introduction-computer-science',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/Introduction_To_Computer_Science_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/introduction_to_computer_science_web_card.svg',
    coverName: 'real-introduction-to-computer-science',
    license: 'CC BY-NC-SA 4.0',
    category: 'Technology',
    language: 'English',
    duration: 600,
    points: ['Explain how computers, software, and networks work', 'Understand data, databases, and the internet', 'Recognise privacy, security, and social issues'],
    skills: 'Computer science basics, IT literacy, networks, data',
  },
  {
    title: 'Principles of Data Science',
    author: 'OpenStax',
    description: 'A practical introduction to working with data: collecting and cleaning data, statistics, visualisation, and communicating findings.',
    source: 'https://openstax.org/details/books/principles-data-science',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/Principles-of-Data-Science-WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/principles_of_data_science_web_card.svg',
    coverName: 'real-principles-of-data-science',
    license: 'CC BY-NC-SA 4.0',
    category: 'Technology',
    language: 'English',
    duration: 540,
    points: ['Ask good questions and collect useful data', 'Summarise and visualise data accurately', 'Present findings clearly and honestly'],
    skills: 'Data analysis, statistics, data visualisation, reporting',
  },
  {
    title: 'Introduction to Intellectual Property',
    author: 'OpenStax',
    description: 'How copyright, trademarks, patents, and trade secrets work, and how creators and small businesses can protect their work.',
    source: 'https://openstax.org/details/books/introduction-intellectual-property',
    pdf: 'https://assets.openstax.org/oscms-prodcms/media/documents/introduction-intellectual-property_-_WEB.pdf',
    cover: 'https://assets.openstax.org/oscms-prodcms/media/documents/introduction_to_intellectual_property_web_card.svg',
    coverName: 'real-introduction-to-intellectual-property',
    license: 'CC BY-NC-SA 4.0',
    category: 'Technology',
    language: 'English',
    duration: 300,
    points: ['Tell apart copyright, trademarks, patents, and trade secrets', 'Register and license your own work', 'Avoid infringement and use open licences'],
    skills: 'Intellectual property, licensing, creative business, law basics',
  },
  // ── Languages (Open Textbook Library / Pressbooks, CC BY 4.0) ──
  {
    title: 'Let\'s Chat! Arabic',
    author: 'Boise State University',
    description: 'A conversational first-year Arabic workbook: greetings, introductions, family, daily life, and culture, with audio-supported dialogue practice.',
    source: 'https://boisestate.pressbooks.pub/pathwaysarabic/',
    pdf: 'https://boisestate.pressbooks.pub/pathwaysarabic/open/download?type=pdf',
    cover: 'https://boisestate.pressbooks.pub/app/uploads/sites/59/2022/10/Black-and-White-Minimal-Cityscape-Architecture-Book-Cover-2.png',
    coverName: 'real-lets-chat-arabic',
    category: 'Languages',
    language: 'Arabic',
    duration: 300,
    points: ['Introduce yourself and hold a basic conversation', 'Use everyday vocabulary for home, school, and family', 'Recognise Arabic script and common expressions'],
    skills: 'Arabic, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
  {
    title: 'Elementary Arabic I',
    author: 'Ayman Mohamed, Sadam Issa, et al. (Michigan State University)',
    description: 'An open introductory Arabic course covering the alphabet, pronunciation, reading, and the grammar needed for simple everyday exchanges.',
    source: 'https://openbooks.lib.msu.edu/arb101/',
    pdf: 'https://openbooks.lib.msu.edu/arb101/open/download?type=pdf',
    cover: 'https://openbooks.lib.msu.edu/app/uploads/sites/65/2021/12/Elementary-Arabic-1.jpg',
    coverName: 'real-elementary-arabic-1',
    category: 'Languages',
    language: 'Arabic',
    duration: 360,
    points: ['Read and write the Arabic alphabet', 'Build core vocabulary and simple sentences', 'Handle greetings and basic transactions'],
    skills: 'Arabic, reading, writing, grammar',
    license: 'CC BY 4.0',
  },
  {
    title: "Let's Chat! Spanish",
    author: 'Boise State University',
    description: 'A communicative Spanish workbook for beginners: greetings, daily life, family, travel, and cultural notes, with speaking and listening practice.',
    source: 'https://boisestate.pressbooks.pub/pathwaysspanish/',
    pdf: 'https://boisestate.pressbooks.pub/pathwaysspanish/open/download?type=pdf',
    cover: 'https://boisestate.pressbooks.pub/app/uploads/sites/56/2022/04/8-1.png',
    coverName: 'real-lets-chat-spanish',
    category: 'Languages',
    language: 'Spanish',
    duration: 300,
    points: ['Greet people and introduce yourself in Spanish', 'Use present-tense verbs and everyday vocabulary', 'Read and write short Spanish texts'],
    skills: 'Spanish, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
  {
    title: 'Let\'s Chat! French',
    author: 'Boise State University',
    description: 'A communicative French workbook for beginners: everyday situations, verb basics, cultural notes, and speaking activities.',
    source: 'https://boisestate.pressbooks.pub/pathwaysfrench/',
    pdf: 'https://boisestate.pressbooks.pub/pathwaysfrench/open/download?type=pdf',
    cover: 'https://boisestate.pressbooks.pub/app/uploads/sites/58/2022/10/6.png',
    coverName: 'real-lets-chat-french',
    category: 'Languages',
    language: 'French',
    duration: 300,
    points: ['Hold a simple conversation in French', 'Use core verbs and everyday vocabulary', 'Understand French-speaking cultures'],
    skills: 'French, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
  {
    title: 'Let\'s Chat! German',
    author: 'Boise State University',
    description: 'A beginner German workbook built around real conversation: introductions, daily routines, travel, and cultural context.',
    source: 'https://boisestate.pressbooks.pub/pathwaysgerman/',
    pdf: 'https://boisestate.pressbooks.pub/pathwaysgerman/open/download?type=pdf',
    cover: 'https://boisestate.pressbooks.pub/app/uploads/sites/60/2022/10/7.png',
    coverName: 'real-lets-chat-german',
    category: 'Languages',
    language: 'German',
    duration: 300,
    points: ['Introduce yourself and ask simple questions', 'Use present-tense German with common verbs', 'Talk about work, family, and travel'],
    skills: 'German, conversation, grammar, vocabulary',
    license: 'CC BY 4.0',
  },
  {
    title: 'Bate-Papo: Beginning Portuguese',
    author: 'University of Washington',
    description: 'An open introductory Portuguese course for real conversation: greetings, daily routines, travel, and Brazilian culture.',
    source: 'https://uw.pressbooks.pub/batepapo/',
    pdf: 'https://uw.pressbooks.pub/batepapo/open/download?type=pdf',
    cover: 'https://uw.pressbooks.pub/app/uploads/sites/12/2019/06/Bate-Papo-COVER-_IMG.jpg',
    coverName: 'real-bate-papo-portuguese',
    category: 'Languages',
    language: 'Portuguese',
    duration: 300,
    points: ['Greet people and introduce yourself in Portuguese', 'Use everyday vocabulary and present-tense verbs', 'Understand Brazilian culture and expression'],
    skills: 'Portuguese, conversation, listening, vocabulary',
    license: 'CC BY 4.0',
  },
  // ── Farming and agriculture (Pressbooks / Open Textbook Library) ──
  {
    title: 'Introduction to Permaculture',
    author: 'Andrew Millison, Oregon State University',
    description: 'Design farming and garden systems that work with nature: site analysis, water, soil building, plant and animal systems, and practical design exercises.',
    source: 'https://open.oregonstate.education/permaculture/',
    pdf: 'https://open.oregonstate.education/permaculture/open/download?type=pdf',
    cover: 'https://open.oregonstate.education/app/uploads/sites/38/2026/04/OER-Archived-Textbook-Cover-Introduction-to-Permaculture-Pressbooks.png',
    coverName: 'real-introduction-to-permaculture',
    category: 'Farm',
    language: 'English',
    duration: 240,
    points: ['Analyse a site for climate, water, and soil', 'Design productive, low-input growing systems', 'Integrate plants, water, and animals sustainably'],
    skills: 'Permaculture, sustainable farming, garden design, soil health',
    license: 'CC BY 4.0',
  },
  {
    title: 'Rain or Shine: Soil and Water Conservation',
    author: 'Oklahoma State University',
    description: 'Practical soil and water management for smallholders: reading soil, controlling runoff, building water storage, and planning for dry seasons.',
    source: 'https://open.library.okstate.edu/rainorshine/',
    pdf: 'https://open.library.okstate.edu/rainorshine/open/download?type=pdf',
    cover: 'https://open.library.okstate.edu/app/uploads/sites/4/2019/06/Rain-or-Shine-June-2017-1.png',
    coverName: 'real-rain-or-shine',
    category: 'Farm',
    language: 'English',
    duration: 210,
    points: ['Assess soil texture, structure, and fertility', 'Reduce erosion with simple on-farm techniques', 'Collect and store water for the dry season'],
    skills: 'Soil conservation, water harvesting, erosion control, irrigation',
    license: 'CC BY 4.0',
  },
  {
    title: 'Crop Improvement and Weather Forecasting',
    author: 'Iowa State University',
    description: 'How crops are improved for yield, pests, and climate stress, plus the basics of using weather information to plan planting and harvests.',
    source: 'https://iastate.pressbooks.pub/cropimprovement/',
    pdf: 'https://iastate.pressbooks.pub/cropimprovement/open/download?type=pdf',
    cover: 'https://iastate.pressbooks.pub/app/uploads/sites/93/2023/06/cropimprovement-cover.png',
    coverName: 'real-crop-improvement',
    category: 'Farm',
    language: 'English',
    duration: 180,
    points: ['Explain how plant breeding improves crops', 'Understand drought and pest resistance', 'Use weather forecasts to guide farm decisions'],
    skills: 'Crop production, plant breeding, weather, climate resilience',
    license: 'CC BY 4.0',
  },
  {
    title: 'Principles of Animal Nutrition',
    author: 'Oregon State University',
    description: 'Feeding livestock well: nutrients, digestion, feed evaluation, and ration planning for poultry, goats, cattle, and other farm animals.',
    source: 'https://open.oregonstate.education/animalnutrition/',
    pdf: 'https://open.oregonstate.education/animalnutrition/open/download?type=pdf',
    cover: 'https://open.oregonstate.education/app/uploads/sites/310/2025/12/OER-Textbook-Cover-Animal-Nutrition.png',
    coverName: 'real-principles-of-animal-nutrition',
    category: 'Farm',
    language: 'English',
    duration: 240,
    points: ['Describe the nutrients animals need', 'Evaluate feeds by their cost and quality', 'Plan balanced rations for farm animals'],
    skills: 'Animal nutrition, livestock farming, feed management, poultry',
    license: 'CC BY 4.0',
  },
  {
    title: 'Genetics, Agriculture, and Biotechnology',
    author: 'Walter Suza and Donald Lee, Iowa State University',
    description: 'How genetics underpins modern agriculture: plant and animal breeding, genetic modification, and how biotechnology is applied on real farms.',
    source: 'https://iastate.pressbooks.pub/genagbiotech/',
    pdf: 'https://iastate.pressbooks.pub/genagbiotech/open/download?type=pdf',
    cover: 'https://iastate.pressbooks.pub/app/uploads/sites/49/2021/09/suza-genetics-cover-1.png',
    coverName: 'real-genetics-agriculture-biotechnology',
    category: 'Farm',
    language: 'English',
    duration: 240,
    points: ['Explain the basics of plant and animal genetics', 'Understand breeding and seed improvement', 'Discuss the benefits and concerns of GM crops'],
    skills: 'Genetics, agribusiness, plant breeding, biotechnology',
    license: 'CC BY 4.0',
  },
  {
    title: 'The Gardeners Handbook',
    author: 'Virginia Tech',
    description: 'A practical reference for growing food: soil preparation, seeds and seedlings, watering, pests and disease, and harvesting vegetable crops.',
    source: 'https://pressbooks.lib.vt.edu/emgtraining/',
    pdf: 'https://pressbooks.lib.vt.edu/emgtraining/open/download?type=pdf',
    cover: 'https://pressbooks.lib.vt.edu/app/uploads/sites/55/2023/02/Front-cover-PB.png',
    coverName: 'real-gardeners-handbook',
    category: 'Farm',
    language: 'English',
    duration: 180,
    points: ['Prepare beds and choose suitable crops', 'Manage watering, feeding, and weeds', 'Identify common pests and diseases'],
    skills: 'Gardening, horticulture, crop production, pest management',
    license: 'CC BY 4.0',
  },
] as const;

async function downloadPdf(url: string, destination: string) {
  if (fs.existsSync(destination)) return;
  // Without a timeout a single stalled host hangs the whole import indefinitely.
  const response = await fetch(url, { redirect: 'follow', headers: browserHeaders(url), signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`PDF download failed (${response.status}): ${url}`);
  if (!/pdf/i.test(response.headers.get('content-type') || 'pdf')) throw new Error(`Expected a PDF but got ${response.headers.get('content-type')}: ${url}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 100 * 1024 * 1024) throw new Error(`Refusing oversized PDF (${length} bytes): ${url}`);
  const temporary = `${destination}.${process.pid}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(temporary, { flags: 'w' }));
    const file = await fs.promises.open(temporary, 'r');
    const header = Buffer.alloc(5);
    await file.read(header, 0, header.length, 0);
    await file.close();
    if (header.toString('ascii') !== '%PDF-') throw new Error(`Downloaded file is not a PDF: ${url}`);
    await fs.promises.rename(temporary, destination);
  } catch (error) {
    await fs.promises.rm(temporary, { force: true });
    throw error;
  }
}

async function saveCover(url: string, name: string) {
  const full = path.join(publicDir, name + '.webp');
  const small = path.join(publicDir, name + '-480.webp');
  const isSvg = /svg/i.test(url);
  // The full-size cover is cached, but SVG cards were previously cropped, so always re-render those.
  if (fs.existsSync(full) && fs.existsSync(small) && !isSvg) return;
  const response = await fetch(url, { redirect: 'follow', headers: browserHeaders(url) });
  if (!response.ok) throw new Error(`Cover download failed (${response.status}): ${url}`);
  const image = Buffer.from(await response.arrayBuffer());
  // OpenStax cover cards are SVG; BCcampus/archive.org covers are raster. sharp rasterises the SVG at a higher density.
  const svgOptions = /svg/i.test(response.headers.get('content-type') || '') || isSvg ? { density: 300 } : {};
  // Cards are 16/10 in the UI. `contain` keeps the whole OpenStax cover title readable instead of centre-cropping it.
  const fit = isSvg ? 'contain' : 'cover';
  await sharp(image, svgOptions).resize({ width: 1200, height: 750, fit, background: '#ffffff' }).webp({ quality: 82 }).toFile(full);
  await sharp(image, svgOptions).resize({ width: 480, height: 300, fit, background: '#ffffff' }).webp({ quality: 78 }).toFile(small);
}

const LICENSE_URLS: Record<string, string> = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-NC-SA 4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
};

/** Every book here is given away free (GHS/NGN 0), so licences that forbid commercial use are still safe. */
const PUBLISHABLE_LICENSES = new Set(Object.keys(LICENSE_URLS));

/** Attribution string required by the source's Creative Commons licence. */
function attributionFor(book: { title: string; author: string; source: string; license: string }) {
  const url = LICENSE_URLS[book.license] ?? LICENSE_URLS['CC BY 4.0'];
  return `${book.title} by ${book.author}. Source: ${book.source} License: Creative Commons ${book.license}, ${url}`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  await Promise.all([fs.promises.mkdir(privateDir, { recursive: true }), fs.promises.mkdir(publicDir, { recursive: true })]);
  const categoryIdFor = async (name: string | null) => {
    if (!name) return null;
    const category = await prisma.category.findFirst({ where: { name } })
      ?? await prisma.category.create({ data: { name, description: `${name} courses and eBooks.` } });
    return category.id;
  };

  for (const book of books) {
    if (!PUBLISHABLE_LICENSES.has(book.license)) {
      const existing = await prisma.course.findFirst({ where: { title: book.title } });
      if (existing?.description?.includes(book.source)) {
        await prisma.course.update({
          where: { id: existing.id },
          data: { published: false, description: `${book.description}\n\n${attributionFor(book)}` },
        });
        console.log(`Unpublished (unrecognised licence): ${book.title}`);
      }
      continue;
    }
    const assetId = crypto.createHash('sha256').update(book.pdf).digest('hex').slice(0, 32);
    try {
      await downloadPdf(book.pdf, path.join(privateDir, assetId + '.pdf'));
    } catch (error) {
      // One unreachable or oversized book should not abort the whole import.
      console.error(`Skipped ${book.title}: ${(error as Error).message}`);
      continue;
    }
    await saveCover(book.cover, book.coverName);

    const attribution = attributionFor(book);
    const existing = await prisma.course.findFirst({ where: { title: book.title } });
    const course = existing ?? await prisma.course.create({
      data: {
        title: book.title,
        author: book.author,
        description: `${book.description}\n\n${attribution}`,
        coverUrl: `/uploads/${book.coverName}.webp`,
        categoryId: await categoryIdFor(book.category),
        minutes: book.duration,
        level: 'Beginner',
        language: book.language,
        learnPoints: [...book.points],
        skills: book.skills,
        priceGhs: 0,
        priceNgn: 0,
        published: true,
      },
    });
    if (existing?.description?.includes(book.source) && (existing.coverUrl !== `/uploads/${book.coverName}.webp` || !existing.published)) {
      await prisma.course.update({ where: { id: existing.id }, data: { coverUrl: `/uploads/${book.coverName}.webp`, published: true } });
    }

    const lessonTitle = `Read ${book.title} (PDF)`;
    const lesson = await prisma.lesson.findFirst({ where: { courseId: course.id, title: lessonTitle } });
    if (!lesson) await prisma.lesson.create({
      data: { courseId: course.id, title: lessonTitle, kind: 'pdf', url: `private:${assetId}.pdf`, minutes: book.duration, preview: true, sort: 1 },
    });
    console.log(`${existing ? 'Already present' : 'Imported'}: ${book.title}`);
  }

  const samples = await prisma.course.findMany({
    where: { title: { startsWith: 'Sample eBook ' }, published: true },
    select: { id: true, _count: { select: { enrollments: true, reviews: true, payments: true, bookmarks: true } } },
  });
  const unused = samples.filter(({ _count }) => Object.values(_count).every(count => count === 0));
  if (unused.length) await prisma.course.updateMany({ where: { id: { in: unused.map(course => course.id) } }, data: { published: false } });
  if (unused.length) console.log(`Unpublished ${unused.length} unused sample course${unused.length === 1 ? '' : 's'}.`);
}

main().finally(() => prisma.$disconnect());
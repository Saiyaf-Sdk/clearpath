const University = require('../models/University');
const User = require('../models/User');
const EnrolledStudent = require('../models/EnrolledStudent');
const { asyncHandler, ApiError } = require('../middleware/error');
const { universityForEmail, universityForPortal, publicUniversity, publicFaculty, facultyForPortal, emailBelongsTo, RESERVED } = require('../utils/policy');
const Faculty = require('../models/Faculty');
const { audit } = require('../utils/helpers');
const { saveUpload, removeByUrl } = require('../utils/files');
const { bundledFor, isBundled, LOGO_PREFIX } = require('../utils/logos');
const { uniOf } = require('../middleware/auth');

// Platform admin works on /platform/universities/:id; a university admin only on their own university
const logoTarget = (req) => (req.user.role === 'superadmin' ? req.params.id : uniOf(req));

/* ---------- Public ---------- */

// GET /api/universities  – active universities (names + logos) for the home page
exports.listPublic = asyncHandler(async (req, res) => {
  const list = await University.find({ isActive: true }).sort('name');
  res.json(list.map(publicUniversity));
});

// GET /api/universities/lookup?email=name@ruh.ac.lk  – which university portal an email belongs to
exports.lookup = asyncHandler(async (req, res) => {
  const university = await universityForEmail(req.query.email);
  if (!university) return res.status(404).json({ message: 'No university on ClearPath uses this email domain' });
  res.json(publicUniversity(university));
});

// GET /api/universities/:portal  – one university's portal details (logo, name, email domains)
exports.getPortal = asyncHandler(async (req, res) => {
  const university = await universityForPortal(req.params.portal);
  if (!university) throw new ApiError(404, 'We could not find this university portal');
  if (!university.isActive) throw new ApiError(403, `${university.name} is not active on ClearPath yet`);
  const faculties = await Faculty.find({ university: university._id, isActive: true }).sort('order name');
  res.json({ ...publicUniversity(university), faculties: faculties.map(publicFaculty) });
});

// GET /api/universities/:portal/:faculty  – one faculty portal (or "central" for Central administration)
exports.getFacultyPortal = asyncHandler(async (req, res) => {
  const university = await universityForPortal(req.params.portal);
  if (!university) throw new ApiError(404, 'We could not find this university portal');
  if (!university.isActive) throw new ApiError(403, `${university.name} is not active on ClearPath yet`);
  const found = await facultyForPortal(university._id, req.params.faculty);
  if (!found) throw new ApiError(404, `We could not find this faculty at ${university.name}`);
  res.json({
    ...publicUniversity(university),
    faculty: found.central ? { slug: 'central', name: 'Central administration', central: true } : publicFaculty(found.faculty),
  });
});

/* ---------- Platform admin ---------- */

const pick = (b) => {
  const out = {};
  ['name', 'shortName', 'code', 'website', 'isActive'].forEach((k) => { if (b[k] !== undefined) out[k] = b[k]; });
  if (b.slug !== undefined) {
    out.slug = String(b.slug).toLowerCase().trim().replace(/\s+/g, '-') || undefined;
    if (out.slug && RESERVED.includes(out.slug)) throw new ApiError(400, `"${out.slug}" can't be used as a portal address`);
  }
  if (b.domains !== undefined) {
    out.domains = Array.isArray(b.domains) ? b.domains : String(b.domains).split(',');
  }
  return out;
};

// A domain may only belong to one university
const checkDomains = async (domains = [], exceptId) => {
  const clean = domains.map((d) => String(d).toLowerCase().trim().replace(/^@/, '')).filter(Boolean);
  const clash = await University.findOne({ domains: { $in: clean }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw new ApiError(409, `A domain is already used by ${clash.name}`);
};

// GET /api/platform/universities
exports.listAll = asyncHandler(async (req, res) => {
  const [unis, counts, roster, facs] = await Promise.all([
    University.find().sort('name').lean(),
    User.aggregate([{ $match: { university: { $ne: null } } }, { $group: { _id: { u: '$university', role: '$role' }, n: { $sum: 1 } } }]),
    EnrolledStudent.aggregate([{ $group: { _id: '$university', n: { $sum: 1 } } }]),
    Faculty.aggregate([{ $group: { _id: '$university', n: { $sum: 1 } } }]),
  ]);
  const count = (id, role) => counts.find((c) => String(c._id.u) === String(id) && c._id.role === role)?.n || 0;
  res.json(unis.map((u) => ({
    ...u,
    stats: { students: count(u._id, 'student'), officers: count(u._id, 'officer'), admins: count(u._id, 'admin'), facultyAdmins: count(u._id, 'facultyadmin'), faculties: facs.find((f) => String(f._id) === String(u._id))?.n || 0, onList: roster.find((r) => String(r._id) === String(u._id))?.n || 0 },
  })));
});

// POST /api/platform/universities
exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (!data.name || !data.code) throw new ApiError(400, 'Name and code are required');
  if (!data.slug) data.slug = String(data.code).toLowerCase();
  if (!data.domains?.length) throw new ApiError(400, 'Add at least one email domain (e.g. ruh.ac.lk)');
  await checkDomains(data.domains);
  const uni = await University.create(data);
  await audit(req.user, 'UNIVERSITY_CREATED', uni._id, uni.name);
  res.status(201).json(uni);
});

// PATCH /api/platform/universities/:id
exports.update = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (data.domains) await checkDomains(data.domains, req.params.id);
  const uni = await University.findById(req.params.id);
  if (!uni) throw new ApiError(404, 'University not found');
  Object.assign(uni, data);
  await uni.save();
  await audit(req.user, 'UNIVERSITY_UPDATED', uni._id, uni.name);
  res.json(uni);
});

// POST /api/platform/universities/:id/logo and POST /api/admin/logo  (multipart field "logo")
exports.uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Please choose a PNG, JPG, WebP or SVG logo');
  const uni = await University.findById(logoTarget(req));
  if (!uni) throw new ApiError(404, 'University not found');
  const url = await saveUpload(req.file, { kind: 'logo', owner: req.user._id, university: uni._id });
  await removeByUrl(uni.logoUrl);
  uni.logoUrl = url;
  await uni.save();
  await audit(req.user, 'UNIVERSITY_LOGO_UPDATED', uni._id, uni.name);
  res.json(uni);
});

// DELETE /api/platform/universities/:id/logo and DELETE /api/admin/logo
// Removes an uploaded logo; the official bundled logo (if the project has one) comes back.
exports.removeLogo = asyncHandler(async (req, res) => {
  const uni = await University.findById(logoTarget(req));
  if (!uni) throw new ApiError(404, 'University not found');
  if (!uni.logoUrl || isBundled(uni.logoUrl)) throw new ApiError(400, 'There is no uploaded logo to remove');
  await removeByUrl(uni.logoUrl);
  const bundled = bundledFor(uni.slug);
  uni.logoUrl = bundled ? `${LOGO_PREFIX}${bundled}` : undefined;
  await uni.save();
  await audit(req.user, 'UNIVERSITY_LOGO_REMOVED', uni._id, uni.name);
  res.json(uni);
});

// GET /api/platform/universities/:id/admins
exports.listAdmins = asyncHandler(async (req, res) => {
  res.json(await User.find({ university: req.params.id, role: 'admin' }).select('name email isActive createdAt'));
});

// POST /api/platform/universities/:id/admins  body: { name, email, password }
exports.createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  const uni = await University.findById(req.params.id);
  if (!uni) throw new ApiError(404, 'University not found');
  if (!emailBelongsTo(email, uni)) throw new ApiError(400, `The admin's email must be a ${uni.name} email (${uni.domains.map((d) => '@' + d).join(' or ')})`);
  const user = await User.create({ name, email, password, role: 'admin', university: uni._id });
  await audit(req.user, 'UNIVERSITY_ADMIN_CREATED', user._id, `${uni.code}: ${email}`);
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, isActive: user.isActive });
});

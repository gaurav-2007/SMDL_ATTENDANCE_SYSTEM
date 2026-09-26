const express = require('express');
const protect = require('../middleware/auth');
const { restrictTo, restrictToActiveOnly } = require('../middleware/roles');
const {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController');

const router = express.Router();

router.use(protect);

router.get('/', getAnnouncements);
router.post('/', restrictTo('teacher', 'admin'), restrictToActiveOnly, createAnnouncement);
router.delete('/:id', restrictTo('teacher', 'admin'), restrictToActiveOnly, deleteAnnouncement);

module.exports = router;

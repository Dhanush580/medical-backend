const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

router.get('/', planController.listPlans);
router.get('/:slug', planController.getPlan);
router.post('/', planController.createPlan);
router.put('/:id', planController.updatePlan);
router.delete('/:id', planController.deletePlan);

module.exports = router;

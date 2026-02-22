/**
 * health module - route map
 *
 */
import { Router } from "express";
import {
  getHealth,
  getReady,
  getRobots,
  getRoot,
  getSitemap,
} from "@/modules/health/controllers/health.controller.js";

const router = Router();

router.get("/", getRoot);
router.get("/robots.txt", getRobots);
router.get("/health", getHealth);
router.get("/ready", getReady);
router.get("/sitemap.xml", getSitemap);

export default router;

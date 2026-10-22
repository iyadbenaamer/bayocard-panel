import { Router } from "express";

import {
  search,
  searchCardTypes,
  searchCards,
} from "../controllers/search.controller.js";

const router = Router();

router.get("/", search);
router.get("/cards", searchCards);
router.get("/card-types", searchCardTypes);

export default router;

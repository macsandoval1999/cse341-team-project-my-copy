import { Router } from "express";
import apiRoutes from "./api-routes.js";
import ejsRoutes from "./ejs-routes.js";

const router = Router();

router.use("/", ejsRoutes);
router.use("/", apiRoutes);

export default router;

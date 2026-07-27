import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { createResourceController } from "../controllers/resourceController.js";
import { createTeacher, updateTeacher } from "../controllers/teacherController.js";
import { teacherValidation, subjectValidation, classValidation, allocationValidation } from "../middleware/validator.js";
import db from "../db.js";

const router = Router();

const teachersCtrl = createResourceController("teachers", {
  onDelete: async (id, userId) => {
    await db.run(
      "UPDATE allocations SET teacherId = NULL WHERE teacherId = ? AND userId = ?",
      id,
      userId
    );
  },
});

router.get("/teachers", authenticate, teachersCtrl.list);
router.post("/teachers", authenticate, teacherValidation.create, createTeacher);
router.put("/teachers/:id", authenticate, teacherValidation.update, updateTeacher);
router.delete("/teachers/:id", authenticate, teachersCtrl.remove);

const subjectsCtrl = createResourceController("subjects", {
  onDelete: async (id, userId) => {
    await db.run(
      "DELETE FROM allocations WHERE subjectId = ? AND userId = ?",
      id,
      userId
    );
  },
});

router.get("/subjects", authenticate, subjectsCtrl.list);
router.post("/subjects", authenticate, subjectValidation.create, subjectsCtrl.create);
router.put("/subjects/:id", authenticate, subjectValidation.update, subjectsCtrl.update);
router.delete("/subjects/:id", authenticate, subjectsCtrl.remove);

const classesCtrl = createResourceController("classes", {
  onDelete: async (id, userId) => {
    await db.run(
      "DELETE FROM allocations WHERE classId = ? AND userId = ?",
      id,
      userId
    );
  },
});

router.get("/classes", authenticate, classesCtrl.list);
router.post("/classes", authenticate, classValidation.create, classesCtrl.create);
router.put("/classes/:id", authenticate, classValidation.update, classesCtrl.update);
router.delete("/classes/:id", authenticate, classesCtrl.remove);

const allocationsCtrl = createResourceController("allocations", {
  onDelete: async () => {},
});

router.get("/allocations", authenticate, allocationsCtrl.list);
router.post("/allocations", authenticate, allocationValidation.create, allocationsCtrl.create);
router.put("/allocations/:id", authenticate, allocationValidation.update, allocationsCtrl.update);
router.delete("/allocations/:id", authenticate, allocationsCtrl.remove);

export default router;

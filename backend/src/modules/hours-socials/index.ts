import { Router } from 'express';
import authRouter from './auth/routes/index.js';  
import dashboardRouter from './dashboard/routes/index.js';
import institutionsRouter from './institutions/routes/index.js';
import projectsRouter from './projects/routes/index.js';
import studentsRouter from './students/routes/index.js';
import facultiesRouter from './faculties/routes/index.js';
import careersRouter from './careers/routes/index.js';

export const hoursSocialsRouter = Router();

hoursSocialsRouter.use('/auth', authRouter);  
hoursSocialsRouter.use('/dashboard', dashboardRouter);
hoursSocialsRouter.use('/institutions', institutionsRouter);
hoursSocialsRouter.use('/projects', projectsRouter);
hoursSocialsRouter.use('/students', studentsRouter);
hoursSocialsRouter.use('/faculties', facultiesRouter);
hoursSocialsRouter.use('/careers', careersRouter);
